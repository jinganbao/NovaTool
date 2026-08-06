<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from "vue";
import { NButton, NCheckbox, NInput, NSpace, NTag, useMessage } from "naive-ui";
import { Copy, Eraser, Regex } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
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

/* ---- 防护限制 ---- */
const MAX_TEST_LENGTH = 1_000_000; // 测试文本上限（约 1MB）
const MAX_MATCH_RESULTS = 5000; // 匹配结果上限
const MATCH_TIMEOUT_MS = 2000; // 执行超时（毫秒），超时 terminate Worker 中止
const MAX_REPLACE_WITH_LENGTH = 64 * 1024; // 替换内容上限

type MatchStatus = "idle" | "running" | "done" | "timeout" | "too-large" | "error";

const matches = ref<MatchResult[]>([]);
const decorations = ref<LineDecoration[]>([]);
const matchStatus = ref<MatchStatus>("idle");
const matchError = ref("");
const truncated = ref(false);

/* ---- Worker 管理：正则放 Worker 执行，灾难性回溯可通过 terminate 强制中止 ---- */
let worker: Worker | null = null;
let workerSeq = 0; // 消息序号（递增，避免随机数碰撞）
let matchGen = 0; // 匹配请求代际：新匹配请求使旧请求回调失效
let replaceGen = 0; // 替换请求代际：与匹配分离，替换不影响匹配状态

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("../utils/regexWorker.ts", import.meta.url), { type: "module" });
  }
  return worker;
}

function runInWorker<T>(payload: Record<string, unknown>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const w = getWorker();
    const seq = ++workerSeq;
    let settled = false;

    const handler = (e: MessageEvent) => {
      if (e.data?.seq !== seq || settled) return;
      settled = true;
      window.clearTimeout(timer);
      w.removeEventListener("message", handler);
      if (e.data?.ok) {
        resolve(e.data as T);
      } else {
        reject(new Error(e.data?.error ?? "未知错误"));
      }
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      // 超时：terminate 并重建，后续请求使用新 Worker
      w.removeEventListener("message", handler);
      w.terminate();
      if (worker === w) worker = null;
      reject(new Error("timeout"));
    }, MATCH_TIMEOUT_MS);

    w.addEventListener("message", handler);
    w.postMessage({ seq, ...payload });
  });
}

onUnmounted(() => {
  window.clearTimeout(debounceTimer);
  worker?.terminate();
  worker = null;
});

/* ---- 计算匹配 ---- */
async function computeMatches() {
  const gen = ++matchGen;
  const re = regex.value;
  if (!re || !testText.value) {
    matches.value = [];
    decorations.value = [];
    truncated.value = false;
    matchError.value = "";
    matchStatus.value = "idle";
    return;
  }

  if (testText.value.length > MAX_TEST_LENGTH) {
    matches.value = [];
    decorations.value = [];
    matchStatus.value = "too-large";
    return;
  }

  matchStatus.value = "running";
  try {
    const result = await runInWorker<{
      matches: MatchResult[];
      decorations: LineDecoration[];
      truncated: boolean;
    }>({
      type: "match",
      pattern: re.source,
      flags: flagString(),
      text: testText.value,
      maxResults: MAX_MATCH_RESULTS,
    });
    if (gen !== matchGen) return; // 已被更新的匹配请求取代，丢弃过期结果
    matches.value = result.matches;
    decorations.value = result.decorations;
    truncated.value = result.truncated;
    matchError.value = "";
    matchStatus.value = "done";
  } catch (err) {
    if (gen !== matchGen) return;
    matches.value = [];
    decorations.value = [];
    if (err instanceof Error && err.message === "timeout") {
      matchStatus.value = "timeout";
    } else {
      matchStatus.value = "error";
      matchError.value = err instanceof Error ? err.message : String(err);
    }
  }
}

/* ---- 实时计算：防抖 150ms，避免每次击键都执行匹配 ---- */
let debounceTimer: number | undefined;
watch([pattern, testText, flags], () => {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(() => {
    void computeMatches();
  }, 150);
}, { deep: true, immediate: true });

/* ---- 替换 ---- */
const replacing = ref(false);

async function doReplace() {
  const gen = ++replaceGen;
  const re = regex.value;
  if (!re) {
    message.warning("正则表达式无效");
    return;
  }
  if (testText.value.length > MAX_TEST_LENGTH) {
    message.warning(`测试文本超过 ${MAX_TEST_LENGTH / 1_000_000}MB 上限`);
    return;
  }
  if (replaceWith.value.length > MAX_REPLACE_WITH_LENGTH) {
    message.warning(`替换内容超过 ${MAX_REPLACE_WITH_LENGTH / 1024}KB 上限`);
    return;
  }
  replacing.value = true;
  try {
    const result = await runInWorker<{ replaced: string }>({
      type: "replace",
      pattern: re.source,
      flags: flagString(),
      text: testText.value,
      replaceWith: replaceWith.value,
    });
    if (gen !== replaceGen) return;
    replacedText.value = result.replaced;
    message.success("替换完成");
  } catch (err) {
    if (gen !== replaceGen) return;
    if (err instanceof Error && err.message === "timeout") {
      message.error("替换超时，正则可能存在灾难性回溯");
    } else {
      message.error("替换失败：" + (err instanceof Error ? err.message : String(err)));
    }
  } finally {
    replacing.value = false;
  }
}

/* ---- 工具 ---- */
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
            <n-tag v-if="matchStatus === 'running'" type="info" :bordered="false" size="small">计算中…</n-tag>
            <n-tag v-else-if="matchStatus === 'timeout'" type="error" :bordered="false" size="small">执行超时，已中止（可能存在灾难性回溯）</n-tag>
            <n-tag v-else-if="matchStatus === 'too-large'" type="error" :bordered="false" size="small">文本超过 1MB 限制</n-tag>
            <n-tag v-else-if="matchStatus === 'error'" type="error" :bordered="false" size="small">匹配出错</n-tag>
            <n-tag v-else-if="matchStatus === 'done' && truncated" type="warning" :bordered="false" size="small">结果过多，仅显示前 {{ MAX_MATCH_RESULTS }} 条</n-tag>
            <n-tag v-else-if="matchStatus === 'done' && matches.length > 0" type="info" :bordered="false" size="small">{{ matches.length }} 处匹配</n-tag>
            <n-tag v-else-if="matchStatus === 'done'" :bordered="false" size="small">无匹配</n-tag>
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
        <div v-if="matches.length === 0 && matchStatus === 'idle'" class="results-empty">
          <Regex :size="20" />
          <span>输入正则和测试文本查看匹配</span>
        </div>
        <div v-else-if="matches.length === 0 && matchStatus === 'running'" class="results-empty">
          <span>计算中…</span>
        </div>
        <div v-else-if="matchStatus === 'error'" class="results-empty">
          <span>{{ matchError }}</span>
        </div>
        <div v-else-if="matchStatus === 'timeout'" class="results-empty">
          <span>执行超时（{{ MATCH_TIMEOUT_MS / 1000 }}s），已中止 —— 正则可能存在灾难性回溯</span>
        </div>
        <div v-else-if="matchStatus === 'too-large'" class="results-empty">
          <span>测试文本超过 1MB 限制，请缩小文本</span>
        </div>
        <div v-else-if="matches.length > 0" class="results-list">
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
        <n-button size="small" type="primary" @click="doReplace" :disabled="!regex || testText.length === 0 || replacing" :loading="replacing">执行替换</n-button>
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
  font-size: 14px;
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
  background: var(--success-soft, rgba(74, 222, 128, 0.15)) !important;
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
