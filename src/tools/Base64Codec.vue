<script setup lang="ts">
import { h, ref } from "vue";
import { NButton, NSpace, useMessage } from "naive-ui";
import { ArrowLeftRight, Copy, Eraser } from "lucide-vue-next";
import type { Component } from "vue";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 状态 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

const input = ref("Hello, 你好世界！");
const output = ref("");

/* ---- 工具 ---- */
function renderIcon(icon: Component, size = 14) {
  return h(icon, { size, strokeWidth: 2.1 });
}

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
  } catch (err) {
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
  <section class="tool-panel split-panel">
    <!-- ====== 左：输入 ====== -->
    <div class="editor-pane">
      <div class="pane-head">
        <h2>原始内容</h2>
      </div>
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
    </div>

    <!-- ====== 右：结果 ====== -->
    <div class="editor-pane">
      <div class="pane-head">
        <h2>结果</h2>
        <div class="pane-head-actions">
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" @click="copyResult">复制</n-button>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(ArrowLeftRight)" @click="swap" title="交换输入和结果" />
        </div>
      </div>
      <CodeEditor v-model="output" language="plain" readonly placeholder="点击编码或解码查看结果" />
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
  margin-bottom: 8px;
}

.pane-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.pane-head-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.action-bar {
  flex-shrink: 0;
  margin-bottom: 8px;
}

:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

@media (max-width: 860px) {
  .split-panel {
    grid-template-columns: 1fr;
  }
}
</style>
