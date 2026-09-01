<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NInput } from "naive-ui";
import { Copy, Eraser, Play } from "lucide-vue-next";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import ToolState from "@/components/common/ToolState.vue";
import { useClipboard } from "@/composables/useClipboard";
import { formatQueryResults, queryJson, queryXml, type QueryMode } from "@/features/query/queryService";
import { renderIcon } from "@/utils/render";
import { useMessage } from "naive-ui";

const message = useMessage();
const { copyText } = useClipboard(message);
const mode = ref<QueryMode>("jsonpath");
const expression = ref("$.users[*].name");
const input = ref('{"users":[{"name":"Nova"},{"name":"Tool"}]}');
const output = ref("");
const error = ref("");
const matchCount = ref(0);
const resultSearch = ref("");

const expressionExamples = computed(() => mode.value === "jsonpath"
  ? ["$", "$.users[*].name", "$..id", "$.users[?(@.active)]"]
  : ["/*", "//item", "//item/text()", "//item/@id"]);

function execute() {
  try {
    const values = mode.value === "jsonpath" ? queryJson(input.value, expression.value) : queryXml(input.value, expression.value);
    output.value = formatQueryResults(mode.value, values);
    matchCount.value = values.length;
    error.value = "";
    message.success(`查询完成，共 ${values.length} 个结果`);
  } catch (cause) {
    output.value = "";
    matchCount.value = 0;
    error.value = cause instanceof Error ? cause.message : String(cause);
    message.error(error.value);
  }
}

function switchMode(next: QueryMode) {
  mode.value = next;
  expression.value = next === "jsonpath" ? "$.users[*].name" : "//item/text()";
  input.value = next === "jsonpath" ? '{"users":[{"name":"Nova"},{"name":"Tool"}]}' : "<root><item>Nova</item><item>Tool</item></root>";
  output.value = "";
  error.value = "";
  resultSearch.value = "";
}

function applyExample(example: string) {
  expression.value = example;
  execute();
}
</script>

<template>
  <section class="tool-panel query-tool">
    <div class="query-toolbar">
      <div class="segmented" role="tablist" aria-label="查询语言">
        <button type="button" :class="{ active: mode === 'jsonpath' }" role="tab" :aria-selected="mode === 'jsonpath'" @click="switchMode('jsonpath')">JSONPath</button>
        <button type="button" :class="{ active: mode === 'xpath' }" role="tab" :aria-selected="mode === 'xpath'" @click="switchMode('xpath')">XPath</button>
      </div>
      <n-input v-model:value="expression" size="small" :placeholder="mode === 'jsonpath' ? '$.users[*].name' : '//item/text()'" class="expression-input" @keyup.enter="execute" />
      <n-button size="small" type="primary" :render-icon="() => renderIcon(Play)" @click="execute">执行查询</n-button>
      <span v-if="output" class="match-count">{{ matchCount }} 个结果</span>
    </div>
    <div class="query-examples" aria-label="常用表达式">
      <span>常用表达式</span>
      <button v-for="example in expressionExamples" :key="example" type="button" @click="applyExample(example)">{{ example }}</button>
    </div>
    <div class="query-layout">
      <section class="query-pane"><header><div><h2>输入数据</h2><span>{{ mode === 'jsonpath' ? 'JSON 文档' : 'XML 文档' }}</span></div><n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="input = ''; output = ''; error = ''">清空</n-button></header><CodeEditor v-model="input" :language="mode === 'jsonpath' ? 'json' : 'xml'" placeholder="粘贴 JSON 或 XML 文档" /></section>
      <section class="query-pane"><header><div><h2>查询结果</h2><span v-if="output">{{ matchCount }} 个匹配项</span></div><div class="result-actions"><n-input v-if="output" v-model:value="resultSearch" size="tiny" clearable placeholder="搜索结果" /><n-button size="tiny" secondary :disabled="!output" :render-icon="() => renderIcon(Copy)" @click="copyText(output)">复制</n-button></div></header><ToolState v-if="error" type="error" title="查询失败" :detail="error" compact /><CodeEditor v-else-if="output" :model-value="output" :language="mode === 'jsonpath' ? 'json' : 'plain'" :search-query="resultSearch" readonly placeholder="暂无结果" /><ToolState v-else title="暂无查询结果" detail="输入表达式后执行查询" /></section>
    </div>
  </section>
</template>

<style scoped>
.query-tool { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.query-toolbar { display: flex; align-items: center; gap: 8px; padding: 8px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.query-examples { display: flex; align-items: center; gap: 6px; min-height: 24px; color: var(--text-muted); font-size: 10px; overflow-x: auto; white-space: nowrap; }
.query-examples button { flex: 0 0 auto; padding: 3px 7px; border: 1px solid var(--border-subtle); border-radius: 4px; background: var(--bg-panel); color: var(--text-secondary); font-family: "SFMono-Regular", Consolas, monospace; font-size: 10px; cursor: pointer; }
.query-examples button:hover { border-color: var(--brand); color: var(--brand); background: var(--brand-soft); }
.segmented { display: flex; gap: 2px; padding: 2px; border-radius: 5px; background: var(--bg-input); }
.segmented button { height: 24px; padding: 0 10px; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; }
.segmented button.active { color: var(--brand); background: var(--brand-soft); font-weight: 600; }
.expression-input { flex: 1; min-width: 160px; font-family: "SFMono-Regular", Consolas, monospace; }
.match-count { color: var(--text-muted); font-size: 10px; white-space: nowrap; }
.query-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.query-pane { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); overflow: hidden; }
.query-pane header { min-height: 30px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.query-pane header > div { display: flex; align-items: baseline; gap: 8px; }
.query-pane header .result-actions { align-items: center; }
.result-actions :deep(.n-input) { width: 120px; }
.query-pane h2 { margin: 0; color: var(--text-primary); font-size: 13px; }
.query-pane header span { color: var(--text-muted); font-size: 10px; }
.query-pane > :deep(.tool-state) { flex: 1; }
:deep(.n-button) { height: 27px; font-size: 11px; }
@media (max-width: 780px) { .query-toolbar { flex-wrap: wrap; } .expression-input { order: 3; flex-basis: 100%; } .query-layout { grid-template-columns: 1fr; overflow-y: auto; } .query-pane { min-height: 360px; } }
</style>
