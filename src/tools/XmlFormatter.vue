<script setup lang="ts">
import { ref } from "vue";
import { NButton, NSpace, useMessage } from "naive-ui";
import { Copy, Minimize2, Sparkles } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import DualPaneTool from "@/components/layout/DualPaneTool.vue";
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
  <DualPaneTool>
    <template #left-title>原始 XML</template>
    <template #left-actions>
      <n-space :size="6">
        <n-button size="tiny" type="primary" :render-icon="() => renderIcon(Sparkles)" @click="format">格式化</n-button>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Minimize2)" @click="compress">压缩</n-button>
      </n-space>
    </template>
    <template #left>
      <CodeEditor v-model="input" language="xml" placeholder="输入 XML 字符串" />
      <div v-if="error" class="error-line">{{ error }}</div>
    </template>

    <template #right-title>格式化结果</template>
    <template #right-actions>
      <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" @click="copy">复制</n-button>
    </template>
    <template #right>
      <CodeEditor v-model="output" language="xml" readonly placeholder="点击格式化查看结果" />
    </template>
  </DualPaneTool>
</template>

<style scoped>
.error-line {
  flex-shrink: 0;
  margin-top: 10px;
  color: var(--danger);
  font-size: 12px;
}
</style>
