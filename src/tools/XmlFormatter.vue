<script setup lang="ts">
import { ref } from "vue";
import { NButton, NSpace, useMessage } from "naive-ui";
import { Copy, Minimize2, Sparkles } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import { useClipboard } from "@/composables/useClipboard";
import { compressXml, formatXml } from "@/utils/formatters";

const message = useMessage();
const { copyText } = useClipboard(message);
const input = ref("<root><name>NovaTool</name><stack>Tauri + Vue3</stack></root>");
const output = ref("");
const error = ref("");

function format() {
  try {
    output.value = formatXml(input.value);
    error.value = "";
    message.success("XML 已格式化");
  } catch (err) {
    output.value = "";
    error.value = err instanceof Error ? err.message : String(err);
    message.error("XML 格式化失败");
  }
}

function compress() {
  output.value = compressXml(input.value);
  error.value = "";
}

function copy() {
  void copyText(output.value);
}

</script>

<template>
  <section class="tool-panel split-panel">
    <div class="editor-pane">
      <div class="pane-head">
        <h2>原始 XML</h2>
        <n-space :size="6">
          <n-button size="tiny" type="primary" :render-icon="() => renderIcon(Sparkles)" @click="format">格式化</n-button>
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Minimize2)" @click="compress">压缩</n-button>
        </n-space>
      </div>
      <CodeEditor v-model="input" language="xml" placeholder="输入 XML 字符串" />
      <div v-if="error" class="error-line">{{ error }}</div>
    </div>

    <div class="editor-pane">
      <div class="pane-head">
        <h2>格式化结果</h2>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" @click="copy">复制</n-button>
      </div>
      <CodeEditor v-model="output" language="xml" readonly placeholder="点击格式化查看结果" />
    </div>
  </section>
</template>

<style scoped>
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.split-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.editor-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.pane-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.pane-head h2 {
  margin: 0;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 700;
  white-space: nowrap;
}

.pane-head :deep(.n-button) {
  min-width: 58px;
  height: 28px;
  font-size: 12px;
}

.error-line {
  flex-shrink: 0;
  margin-top: 10px;
  color: var(--danger);
  font-size: 12px;
}

@media (max-width: 860px) {
  .split-panel {
    grid-template-columns: 1fr;
  }
}
</style>
