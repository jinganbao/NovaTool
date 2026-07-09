<script setup lang="ts">
import { h, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { NButton, NSpace, useMessage } from "naive-ui";
import { ArrowLeftRight, Copy, Eraser, GitCompare, Pencil } from "lucide-vue-next";
import type { Component } from "vue";
import CodeEditor, { type LineDecoration } from "@/components/editor/CodeEditor.vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 模式 ---- */
type Mode = "edit" | "compare";
const mode = ref<Mode>("edit");
const computing = ref(false);

/* ---- 输入 ---- */
const leftText = ref("Hello World\nThis is a test\nLine 3 original\nLine 4\nLine 5");
const rightText = ref("Hello World\nThis is a test modified\nLine 3 changed\nLine 4\nLine 6 added");

/* ---- Rust 返回的标记数据 ---- */
type LineMark = { from: number; to: number; type: string };

interface DiffResult {
  leftMarks: LineMark[];
  rightMarks: LineMark[];
}

const leftMarks = ref<LineDecoration[]>([]);
const rightMarks = ref<LineDecoration[]>([]);
const stats = ref({ added: 0, removed: 0 });

/* ---- 同步滚动 ---- */
const leftRef = ref<HTMLElement | null>(null);
const rightRef = ref<HTMLElement | null>(null);
let syncing = false;

function syncLeft() {
  if (syncing) return;
  syncing = true;
  if (rightRef.value && leftRef.value) {
    const cm = rightRef.value.querySelector(".cm-scroller") as HTMLElement | null;
    const lm = leftRef.value.querySelector(".cm-scroller") as HTMLElement | null;
    if (cm && lm) cm.scrollTop = lm.scrollTop;
  }
  syncing = false;
}

function syncRight() {
  if (syncing) return;
  syncing = true;
  if (leftRef.value && rightRef.value) {
    const lm = leftRef.value.querySelector(".cm-scroller") as HTMLElement | null;
    const rm = rightRef.value.querySelector(".cm-scroller") as HTMLElement | null;
    if (lm && rm) lm.scrollTop = rm.scrollTop;
  }
  syncing = false;
}

/* ---- 工具 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

function renderIcon(icon: Component, size = 14) {
  return h(icon, { size, strokeWidth: 2.1 });
}

/* ---- 调用 Rust 计算 diff ---- */
async function compare() {
  computing.value = true;
  try {
    const result = await invoke<DiffResult>("text_diff", {
      left: leftText.value,
      right: rightText.value,
    });

    const toDecos = (marks: LineMark[], cls: string) =>
      marks.map((m) => ({ from: m.from, to: m.to, class: cls }));

    leftMarks.value = [
      ...toDecos(result.leftMarks.filter((m) => m.type === "changed"), "diff-changed"),
      ...toDecos(result.leftMarks.filter((m) => m.type === "removed"), "diff-removed"),
    ];
    rightMarks.value = [
      ...toDecos(result.rightMarks.filter((m) => m.type === "changed"), "diff-changed"),
      ...toDecos(result.rightMarks.filter((m) => m.type === "added"), "diff-added"),
    ];

    const rightAdded = result.rightMarks.filter((m) => m.type === "added").length;
    const rightChanged = result.rightMarks.filter((m) => m.type === "changed").length;
    const leftRemoved = result.leftMarks.filter((m) => m.type === "removed").length;
    const leftChanged = result.leftMarks.filter((m) => m.type === "changed").length;

    stats.value = {
      added: rightAdded + rightChanged,
      removed: leftRemoved + leftChanged,
    };

    mode.value = "compare";
  } catch (err) {
    message.error("Diff 计算失败：" + (err instanceof Error ? err.message : String(err)));
  } finally {
    computing.value = false;
  }
}

function backToEdit() {
  mode.value = "edit";
}

function swapTexts() {
  const tmp = leftText.value;
  leftText.value = rightText.value;
  rightText.value = tmp;
}

function clearAll() {
  leftText.value = "";
  rightText.value = "";
  leftMarks.value = [];
  rightMarks.value = [];
}

function copyDiff() {
  const lines: string[] = [];
  // 简单输出：逐行标注
  const leftLines = leftText.value.split("\n");
  const rightLines = rightText.value.split("\n");

  const addedSet = new Set(rightMarks.value.flatMap((m) => {
    const arr: number[] = [];
    for (let i = m.from; i <= m.to; i++) arr.push(i);
    return arr;
  }));
  const removedSet = new Set(leftMarks.value.flatMap((m) => {
    const arr: number[] = [];
    for (let i = m.from; i <= m.to; i++) arr.push(i);
    return arr;
  }));

  for (let i = 0; i < leftLines.length; i++) {
    const ln = i + 1;
    if (removedSet.has(ln)) lines.push(`- ${leftLines[i]}`);
    else lines.push(`  ${leftLines[i]}`);
  }
  for (let i = 0; i < rightLines.length; i++) {
    const ln = i + 1;
    if (addedSet.has(ln)) lines.push(`+ ${rightLines[i]}`);
  }

  void copyText(lines.join("\n"));
}
</script>

<template>
  <section class="tool-panel diff-tool">
    <!-- ====== 操作栏 ====== -->
    <div class="action-bar">
      <n-space :size="8" align="center">
        <n-button
          v-if="mode === 'edit'"
          size="small"
          type="primary"
          :loading="computing"
          :render-icon="() => renderIcon(GitCompare)"
          @click="compare"
          >比较</n-button
        >
        <n-button
          v-else
          size="small"
          secondary
          :render-icon="() => renderIcon(Pencil)"
          @click="backToEdit"
          >返回编辑</n-button
        >
        <n-button size="small" secondary :render-icon="() => renderIcon(ArrowLeftRight)" @click="swapTexts">交换</n-button>
        <n-button
          v-if="mode === 'compare'"
          size="small"
          secondary
          :render-icon="() => renderIcon(Copy)"
          @click="copyDiff"
          >复制差异</n-button
        >
        <n-button size="small" secondary :render-icon="() => renderIcon(Eraser)" @click="clearAll">清空</n-button>
        <span v-if="mode === 'compare'" class="stats">
          <span class="stat-added">+{{ stats.added }}</span>
          <span class="stat-removed">-{{ stats.removed }}</span>
        </span>
      </n-space>
    </div>

    <!-- ====== 主体 ====== -->
    <div class="main-area">
      <!-- 编辑模式 -->
      <template v-if="mode === 'edit'">
        <div class="editor-pane">
          <div class="pane-head">
            <h2>原始文本</h2>
            <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="leftText = ''">清空</n-button>
          </div>
          <CodeEditor v-model="leftText" language="plain" placeholder="粘贴原始文本…" />
        </div>
        <div class="editor-pane">
          <div class="pane-head">
            <h2>修改后文本</h2>
            <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="rightText = ''">清空</n-button>
          </div>
          <CodeEditor v-model="rightText" language="plain" placeholder="粘贴修改后文本…" />
        </div>
      </template>

      <!-- 对比模式：只读 CodeEditor + 行装饰 -->
      <template v-else>
        <div class="editor-pane" ref="leftRef" @scroll="syncLeft">
          <div class="pane-head">
            <h2>原始文本</h2>
          </div>
          <CodeEditor
            :modelValue="leftText"
            language="plain"
            readonly
            :lineDecorations="leftMarks"
          />
        </div>
        <div class="editor-pane" ref="rightRef" @scroll="syncRight">
          <div class="pane-head">
            <h2>修改后文本</h2>
          </div>
          <CodeEditor
            :modelValue="rightText"
            language="plain"
            readonly
            :lineDecorations="rightMarks"
          />
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.diff-tool {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.action-bar {
  flex-shrink: 0;
}

.stats {
  font-size: 12px;
  font-weight: 600;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

.stat-added { color: var(--success); margin-right: 8px; }
.stat-removed { color: var(--danger); }

/* ---- 主体 ---- */
.main-area {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.editor-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 10px;
}

.pane-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.pane-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ---- CodeMirror 行装饰颜色 ---- */
:deep(.diff-removed) {
  background: var(--danger-soft) !important;
}
:deep(.diff-added) {
  background: rgba(74, 222, 128, 0.1) !important;
}
:deep(.diff-changed) {
  background: rgba(245, 158, 11, 0.1) !important;
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

@media (max-width: 860px) {
  .main-area {
    grid-template-columns: 1fr;
  }
}
</style>
