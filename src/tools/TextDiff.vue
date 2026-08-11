<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { NButton, useMessage } from "naive-ui";
import { ArrowLeftRight, Copy, Eraser, GitCompare } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor, { type LineDecoration, type InlineMark } from "@/components/editor/CodeEditor.vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 比较状态 ---- */
const hasCompared = ref(false);
const computing = ref(false);
let editRevision = 0;
let compareRequest = 0;
let compareTimer: ReturnType<typeof setTimeout> | null = null;

/* ---- 输入 ---- */
const leftText = ref("Hello World\nThis is a test\nLine 3 original\nLine 4\nLine 5");
const rightText = ref("Hello World\nThis is a test modified\nLine 3 changed\nLine 4\nLine 6 added");

/* ---- Rust 返回的标记数据 ---- */
type LineMark = { from: number; to: number; type: string };
type CharMark = { line: number; from: number; to: number };

interface DiffResult {
  leftMarks: LineMark[];
  rightMarks: LineMark[];
  leftCharMarks: CharMark[];
  rightCharMarks: CharMark[];
}

const leftMarks = ref<LineDecoration[]>([]);
const rightMarks = ref<LineDecoration[]>([]);
const leftInlineMarks = ref<InlineMark[]>([]);
const rightInlineMarks = ref<InlineMark[]>([]);
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

/* ---- 调用 Rust 计算 diff ---- */
async function compare(showError = true) {
  const request = ++compareRequest;
  const revision = editRevision;
  computing.value = true;
  try {
    const result = await invoke<DiffResult>("text_diff", {
      left: leftText.value,
      right: rightText.value,
    });

    if (request !== compareRequest || revision !== editRevision) return;

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

    // 字符级 diff 由 Rust 端计算（similar 算法），返回 UTF-16 偏移，与 CodeMirror 对齐
    const toInline = (marks: CharMark[]) =>
      marks.map((m) => ({ line: m.line, from: m.from, to: m.to, class: "diff-char-changed" }));
    leftInlineMarks.value = toInline(result.leftCharMarks);
    rightInlineMarks.value = toInline(result.rightCharMarks);

    const rightAdded = result.rightMarks.filter((m) => m.type === "added").length;
    const rightChangedCount = result.rightMarks.filter((m) => m.type === "changed").length;
    const leftRemoved = result.leftMarks.filter((m) => m.type === "removed").length;
    const leftChangedCount = result.leftMarks.filter((m) => m.type === "changed").length;

    stats.value = {
      added: rightAdded + rightChangedCount,
      removed: leftRemoved + leftChangedCount,
    };

    hasCompared.value = true;
  } catch (err) {
    if (showError) message.error("Diff 计算失败：" + (err instanceof Error ? err.message : String(err)));
  } finally {
    if (request === compareRequest) computing.value = false;
  }
}

function scheduleCompare() {
  editRevision += 1;
  if (!hasCompared.value) return;
  if (compareTimer) clearTimeout(compareTimer);
  compareTimer = setTimeout(() => {
    compareTimer = null;
    void compare(false);
  }, 250);
}

watch([leftText, rightText], scheduleCompare);
onBeforeUnmount(() => {
  if (compareTimer) clearTimeout(compareTimer);
});

function swapTexts() {
  const tmp = leftText.value;
  leftText.value = rightText.value;
  rightText.value = tmp;
}

function clearAll() {
  if (compareTimer) {
    clearTimeout(compareTimer);
    compareTimer = null;
  }
  compareRequest += 1;
  leftText.value = "";
  rightText.value = "";
  leftMarks.value = [];
  rightMarks.value = [];
  leftInlineMarks.value = [];
  rightInlineMarks.value = [];
  stats.value = { added: 0, removed: 0 };
  hasCompared.value = false;
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
      <div class="action-group">
        <n-button size="small" type="primary" :loading="computing" :render-icon="() => renderIcon(GitCompare)" @click="compare()">
          {{ hasCompared ? "重新比较" : "比较" }}
        </n-button>
        <n-button size="small" secondary :render-icon="() => renderIcon(ArrowLeftRight)" @click="swapTexts">交换</n-button>
        <n-button size="small" secondary :disabled="!hasCompared" :render-icon="() => renderIcon(Copy)" @click="copyDiff">复制差异</n-button>
        <n-button size="small" secondary :render-icon="() => renderIcon(Eraser)" @click="clearAll">清空</n-button>
        <span v-if="hasCompared" class="stats">
          <span class="stat-added">+{{ stats.added }}</span>
          <span class="stat-removed">-{{ stats.removed }}</span>
        </span>
      </div>
      <span v-if="hasCompared" class="live-hint">编辑后自动更新差异</span>
    </div>

    <!-- ====== 主体 ====== -->
    <div class="main-area">
      <div ref="leftRef" class="editor-pane" @scroll.capture="syncLeft">
        <div class="pane-head">
          <h2>原始文本</h2>
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="leftText = ''">清空</n-button>
        </div>
        <CodeEditor
          v-model="leftText"
          language="plain"
          placeholder="粘贴原始文本…"
          :lineDecorations="leftMarks"
          :inlineMarks="leftInlineMarks"
        />
      </div>
      <div ref="rightRef" class="editor-pane" @scroll.capture="syncRight">
        <div class="pane-head">
          <h2>修改后文本</h2>
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="rightText = ''">清空</n-button>
        </div>
        <CodeEditor
          v-model="rightText"
          language="plain"
          placeholder="粘贴修改后文本…"
          :lineDecorations="rightMarks"
          :inlineMarks="rightInlineMarks"
        />
      </div>
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
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.action-group { display: flex; align-items: center; gap: 8px; }
.live-hint { color: var(--text-muted); font-size: 11px; }

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
  background: var(--success-soft, rgba(74, 222, 128, 0.1)) !important;
}
:deep(.diff-changed) {
  background: var(--warning-soft, rgba(245, 158, 11, 0.1)) !important;
}
:deep(.diff-char-changed) {
  background: var(--warning-soft);
  filter: brightness(1.3);
  border-radius: 2px;
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
