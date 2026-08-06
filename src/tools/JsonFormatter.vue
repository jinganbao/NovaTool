<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { NButton, NSpace, useMessage } from "naive-ui";
import { Copy, Eraser, Minimize2, Sparkles } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import DualPaneTool from "@/components/layout/DualPaneTool.vue";
import { useClipboard } from "@/composables/useClipboard";

const message = useMessage();
const { copyText } = useClipboard(message);
const input = ref('{"name":"NovaTool","stack":["Tauri","Vue3","Naive UI"],"scene":"Developer Toolbox"}');
const output = ref("");
const error = ref("");

function toErrorMessage(err: unknown): string {
  return typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
}

async function format(space = 2) {
  try {
    // 格式化在 Rust 端执行（serde_json），错误自带行列号，大输入不阻塞 UI
    output.value = await invoke<string>("json_format", {
      input: input.value,
      mode: space === 0 ? "compact" : "pretty",
    });
    error.value = "";
    message.success(space === 0 ? "JSON 已压缩" : "JSON 已格式化");
  } catch (err) {
    output.value = "";
    error.value = toErrorMessage(err);
    message.error("JSON 校验失败");
  }
}

function clear() {
  input.value = "";
  output.value = "";
  error.value = "";
}

function copy() {
  void copyText(output.value);
}

</script>

<template>
  <DualPaneTool>
    <template #left-title>原始 JSON</template>
    <template #left-actions>
      <n-space :size="6">
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="clear">清空</n-button>
        <n-button size="tiny" type="primary" :render-icon="() => renderIcon(Sparkles)" @click="format(2)">格式化</n-button>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Minimize2)" @click="format(0)">压缩</n-button>
      </n-space>
    </template>
    <template #left>
      <CodeEditor v-model="input" language="json" placeholder="输入 JSON 字符串" />
      <div v-if="error" class="error-line">{{ error }}</div>
    </template>

    <template #right-title>解析结果</template>
    <template #right-actions>
      <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" @click="copy">复制</n-button>
    </template>
    <template #right>
      <CodeEditor
        v-model="output"
        language="json"
        readonly
        placeholder="点击格式化查看结果"
      />
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
