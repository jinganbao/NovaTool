<script setup lang="ts">
import { computed, h, ref, watch } from "vue";
import { NButton, NCheckbox, NInput, NSpace, NTag, useMessage } from "naive-ui";
import { Copy, Eraser, Regex } from "lucide-vue-next";
import type { Component } from "vue";
import CodeEditor, { type LineDecoration } from "@/components/editor/CodeEditor.vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 状态 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

const pattern = ref("\\w+");
const flags = ref({ g: true, i: false, m: false, s: false, u: false });
const testText = ref("Hello World\nThis is a test\nRegex is powerful\nLine 4 for testing");

const replaceWith = ref("[$&]");
const replacedText = ref("");

/* ---- 正则 ---- */
function flagString() {
  let s = "";
  if (flags.value.g) s += "g";
  if (flags.value.i) s += "i";
  if (flags.value.m) s += "m";
  if (flags.value.s) s += "s";
  if (flags.value.u) s += "u";
  return s;
}

const regex = computed(() => {
  try {
    return new RegExp(pattern.value, flagString());
  } catch {
    return null;
  }
});

interface MatchResult {
  index: number;
  text: string;
  length: number;
  groups: Record<string, string>;
}

const matches = ref<MatchResult[]>([]);
const decorations = ref<LineDecoration[]>([]);

/* ---- 计算匹配 ---- */
function computeMatches() {
  const re = regex.value;
  if (!re || !testText.value) {
    matches.value = [];
    decorations.value = [];
    return;
  }

  const results: MatchResult[] = [];
  const decos: LineDecoration[] = [];

  // 按行处理来生成 decorations
  const lines = testText.value.split("\n");
  let offset = 0;

  // 全局匹配
  let m: RegExpExecArray | null;
  const reGlobal = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");

  while ((m = reGlobal.exec(testText.value)) !== null) {
    results.push({
      index: m.index,
      text: m[0],
      length: m[0].length,
      groups: m.groups || {},
    });

    // 找到匹配在哪个行
    const matchStart = m.index;
    const matchEnd = m.index + m[0].length;

    // 找出涉及的行
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      const lineStart = charCount;
      const lineEnd = charCount + lines[i].length;
      charCount = lineEnd + 1; // +1 for \n

      if (matchEnd > lineStart && matchStart < lineEnd) {
        const relStart = Math.max(0, matchStart - lineStart);
        const relEnd = Math.min(lines[i].length, matchEnd - lineStart);
        // 添加行内标记：用 mark 装饰
        decos.push({
          from: i + 1,
          to: i + 1,
          class: "regex-match",
        });
      }
    }

    if (!re.flags.includes("g")) break;
  }

  matches.value = results;
  decorations.value = decos;
  // 行级装饰只是高亮整行，我们也需要字符级...但 CodeMirror Decoration.line 是行级别的
  // 这里我们用行高亮作为简化方案，配合下面列表显示详情
}

/* ---- 实时计算 ---- */
watch([pattern, testText, flags], () => {
  computeMatches();
}, { deep: true, immediate: true });

/* ---- 替换 ---- */
function doReplace() {
  const re = regex.value;
  if (!re) {
    message.warning("正则表达式无效");
    return;
  }
  try {
    const reWithG = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
    replacedText.value = testText.value.replace(reWithG, replaceWith.value);
    message.success("替换完成");
  } catch (err) {
    message.error("替换失败：" + (err instanceof Error ? err.message : String(err)));
  }
}

/* ---- 工具 ---- */
function renderIcon(icon: Component, size = 14) {
  return h(icon, { size, strokeWidth: 2.1 });
}

function clearAll() {
  pattern.value = "";
  testText.value = "";
  replaceWith.value = "";
  replacedText.value = "";
  matches.value = [];
  decorations.value = [];
}

function copyMatches() {
  const text = matches.value
    .map((m, i) => `${i + 1}. "${m.text}" (位置 ${m.index}, 长度 ${m.length})`)
    .join("\n");
  void copyText(text);
}
</script>

<template>
  <section class="tool-panel regex-tool">
    <!-- ====== 正则表达式 ====== -->
    <div class="pattern-card">
      <div class="card-head">
        <h2>正则表达式</h2>
      </div>
      <div class="pattern-row">
        <span class="pattern-delimiter">/</span>
        <n-input
          v-model:value="pattern"
          size="small"
          placeholder="输入正则，如 \w+"
          class="pattern-input"
          :status="pattern && !regex ? 'error' : undefined"
        />
        <span class="pattern-delimiter">/</span>
        <n-checkbox v-model:checked="flags.g">g</n-checkbox>
        <n-checkbox v-model:checked="flags.i">i</n-checkbox>
        <n-checkbox v-model:checked="flags.m">m</n-checkbox>
        <n-checkbox v-model:checked="flags.s">s</n-checkbox>
        <n-checkbox v-model:checked="flags.u">u</n-checkbox>
      </div>
      <div v-if="pattern && !regex" class="pattern-error">正则表达式无效</div>
    </div>

    <!-- ====== 测试文本 ====== -->
    <div class="test-area">
      <div class="editor-pane">
        <div class="pane-head">
          <h2>测试文本</h2>
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="testText = ''">清空</n-button>
        </div>
        <CodeEditor
          v-model="testText"
          language="plain"
          placeholder="粘贴要测试的文本…"
          :lineDecorations="decorations"
        />
      </div>

      <!-- ====== 匹配结果 ====== -->
      <div class="results-pane">
        <div class="pane-head">
          <h2>匹配结果</h2>
          <n-space :size="6">
            <n-tag v-if="matches.length > 0" type="info" :bordered="false" size="small">{{ matches.length }} 处匹配</n-tag>
            <n-tag v-else-if="regex" :bordered="false" size="small">无匹配</n-tag>
            <n-button
              size="tiny"
              secondary
              :render-icon="() => renderIcon(Copy)"
              :disabled="matches.length === 0"
              @click="copyMatches"
              >复制</n-button
            >
          </n-space>
        </div>
        <div v-if="matches.length === 0" class="results-empty">
          <Regex :size="20" />
          <span>输入正则和测试文本查看匹配</span>
        </div>
        <div v-else class="results-list">
          <div v-for="(m, i) in matches" :key="i" class="match-row">
            <span class="match-num">{{ i + 1 }}</span>
            <code class="match-text">"{{ m.text }}"</code>
            <span class="match-pos">位置 {{ m.index }}, 长度 {{ m.length }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ====== 替换 ====== -->
    <div class="replace-card">
      <div class="card-head">
        <h2>替换</h2>
      </div>
      <div class="replace-row">
        <span class="replace-label">替换为</span>
        <n-input
          v-model:value="replaceWith"
          size="small"
          placeholder="替换内容，如 [$&] 引用匹配"
          class="replace-input"
        />
        <n-button size="small" type="primary" @click="doReplace" :disabled="!regex || matches.length === 0">执行替换</n-button>
      </div>
      <div v-if="replacedText" class="replace-result">
        <div class="replace-result-head">
          <span>替换结果</span>
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" @click="copyText(replacedText)">复制</n-button>
        </div>
        <pre class="replace-text">{{ replacedText }}</pre>
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

.regex-tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow-y: auto;
}

/* ---- 公共 ---- */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.card-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
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
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ---- 正则输入 ---- */
.pattern-card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 10px 12px;
}

.pattern-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.pattern-delimiter {
  color: var(--brand);
  font-size: 16px;
  font-weight: 700;
  font-family: "SFMono-Regular", Consolas, monospace;
}

.pattern-input {
  flex: 1;
  min-width: 120px;
}

.pattern-error {
  margin-top: 8px;
  color: var(--danger);
  font-size: 12px;
}

/* ---- 测试区双栏 ---- */
.test-area {
  flex: 1 1 55%;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 280px);
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

/* ---- 匹配结果 ---- */
.results-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 10px;
}

.results-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 12px;
}

.results-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 4px;
}

.match-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 5px;
  background: var(--bg-input);
}

.match-num {
  width: 20px;
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
  text-align: right;
}

.match-text {
  font-size: 12px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.match-pos {
  color: var(--text-muted);
  font-size: 11px;
  margin-left: auto;
  white-space: nowrap;
}

/* ---- 替换 ---- */
.replace-card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 10px 12px;
}

.replace-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.replace-label {
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

.replace-input {
  flex: 1;
  min-width: 0;
}

.replace-result {
  margin-top: 10px;
}

.replace-result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.replace-text {
  margin: 0;
  padding: 10px;
  border-radius: 5px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  white-space: pre-wrap;
  word-break: break-all;
  max-height: 120px;
  overflow-y: auto;
}

/* ---- 匹配高亮 ---- */
:deep(.regex-match) {
  background: rgba(74, 222, 128, 0.15) !important;
  border-left: 3px solid var(--success) !important;
}

/* ---- 按钮 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

:deep(.n-checkbox) {
  font-size: 12px;
  font-weight: 600;
}

@media (max-width: 800px) {
  .test-area {
    grid-template-columns: 1fr;
  }
}
</style>
