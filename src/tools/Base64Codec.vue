<script setup lang="ts">
import { ref } from "vue";
import { NButton, NSpace, useMessage } from "naive-ui";
import { ArrowLeftRight, Copy, Eraser } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import DualPaneTool from "@/components/layout/DualPaneTool.vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 状态 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

const input = ref("Hello, 你好世界！");
const output = ref("");

/* ---- 编码 ---- */
function encode() {
  try {
    const bytes = new TextEncoder().encode(input.value);
    let binary = "";
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }
    output.value = btoa(binary);
    message.success("Base64 编码完成");
  } catch (err) {
    output.value = "";
    message.error("编码失败：" + (err instanceof Error ? err.message : String(err)));
  }
}

/* ---- 解码 ---- */
function decode() {
  try {
    const binary = atob(input.value.trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    output.value = new TextDecoder("utf-8").decode(bytes);
    message.success("Base64 解码完成");
  } catch {
    output.value = "";
    message.error("解码失败，请检查输入是否为合法 Base64 字符串");
  }
}

/* ---- 清空 / 复制 ---- */
function clearAll() {
  input.value = "";
  output.value = "";
}

function copyResult() {
  void copyText(output.value);
}

/* ---- 交换 ---- */
function swap() {
  const tmp = input.value;
  input.value = output.value;
  output.value = tmp;
}
</script>

<template>
  <DualPaneTool>
    <template #left-title>原始内容</template>
    <template #left>
      <div class="action-bar">
        <n-space :size="6">
          <n-button size="tiny" type="primary" :render-icon="() => renderIcon(ArrowLeftRight)" @click="encode"
            >编码</n-button
          >
          <n-button size="tiny" secondary :render-icon="() => renderIcon(ArrowLeftRight)" @click="decode"
            >解码</n-button
          >
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="clearAll">清空</n-button>
        </n-space>
      </div>
      <CodeEditor v-model="input" language="plain" placeholder="输入要编解码的内容…" />
    </template>

    <template #right-title>结果</template>
    <template #right-actions>
      <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" @click="copyResult">复制</n-button>
      <n-button size="tiny" quaternary :render-icon="() => renderIcon(ArrowLeftRight)" @click="swap" title="交换输入和结果" />
    </template>
    <template #right>
      <CodeEditor v-model="output" language="plain" readonly placeholder="点击编码或解码查看结果" />
    </template>
  </DualPaneTool>
</template>

<style scoped>
.action-bar {
  flex-shrink: 0;
  margin-bottom: 8px;
}

:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}
</style>
