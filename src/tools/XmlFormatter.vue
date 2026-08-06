<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { NButton, NSpace, useMessage } from "naive-ui";
import { Copy, Minimize2, Sparkles } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import DualPaneTool from "@/components/layout/DualPaneTool.vue";
import { useClipboard } from "@/composables/useClipboard";

const message = useMessage();
const { copyText } = useClipboard(message);
const input = ref("<root><name>NovaTool</name><stack>Tauri + Vue3</stack></root>");
const output = ref("");
const error = ref("");
const formatting = ref(false);

function toErrorMessage(err: unknown): string {
  return typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
}

async function format() {
  formatting.value = true;
  try {
    // 格式化在 Rust 端执行（quick-xml），完整保留 CDATA/注释/DOCTYPE，错误带行列号
    output.value = await invoke<string>("xml_format", { input: input.value, mode: "pretty" });
    error.value = "";
    message.success("XML 已格式化");
  } catch (err) {
    output.value = "";
    error.value = toErrorMessage(err);
    message.error("XML 格式化失败");
  } finally {
    formatting.value = false;
  }
}

async function compress() {
  formatting.value = true;
  try {
    output.value = await invoke<string>("xml_format", { input: input.value, mode: "compact" });
    error.value = "";
    message.success("XML 已压缩");
  } catch (err) {
    output.value = "";
    error.value = toErrorMessage(err);
    message.error("XML 压缩失败");
  } finally {
    formatting.value = false;
  }
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
