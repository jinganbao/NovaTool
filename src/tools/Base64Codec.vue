<script setup lang="ts">
import { ref } from "vue";
import { NButton, NCheckbox, useMessage } from "naive-ui";
import { ArrowLeftRight, ArrowRight, Copy, Eraser } from "lucide-vue-next";
import CodecWorkbench from "@/features/codec/components/CodecWorkbench.vue";
import { decodeBase64, encodeBase64 } from "@/features/base64/base64Service";
import { useClipboard } from "@/composables/useClipboard";
import { renderIcon } from "@/utils/render";

type Operation = "encode" | "decode";
type Variant = "standard" | "url";

const message = useMessage();
const { copyText } = useClipboard(message);
const operation = ref<Operation>("encode");
const variant = ref<Variant>("standard");
const padding = ref(true);
const input = ref("Hello, 你好世界！");
const output = ref("");

function convert() {
  try {
    output.value = operation.value === "encode"
      ? encodeBase64(input.value, { urlSafe: variant.value === "url", padding: padding.value })
      : decodeBase64(input.value);
  } catch (error) {
    output.value = "";
    message.error(error instanceof Error ? error.message : "Base64 转换失败");
  }
}

function swap() {
  input.value = output.value;
  output.value = "";
  operation.value = operation.value === "encode" ? "decode" : "encode";
}

function clearAll() {
  input.value = "";
  output.value = "";
}
</script>

<template>
  <CodecWorkbench
    :input="input"
    :output="output"
    input-title="原始内容"
    output-title="转换结果"
    input-placeholder="输入 UTF-8 文本或 Base64 字符串"
    output-placeholder="点击转换查看结果"
    @update:input="input = $event"
  >
    <template #controls>
      <div class="segmented" role="radiogroup" aria-label="Base64 操作">
        <button type="button" role="radio" :aria-checked="operation === 'encode'" :class="{ active: operation === 'encode' }" @click="operation = 'encode'">编码</button>
        <button type="button" role="radio" :aria-checked="operation === 'decode'" :class="{ active: operation === 'decode' }" @click="operation = 'decode'">解码</button>
      </div>
      <span class="toolbar-divider" />
      <div class="segmented" role="radiogroup" aria-label="Base64 变体">
        <button type="button" role="radio" :aria-checked="variant === 'standard'" :class="{ active: variant === 'standard' }" @click="variant = 'standard'">标准</button>
        <button type="button" role="radio" :aria-checked="variant === 'url'" :class="{ active: variant === 'url' }" @click="variant = 'url'">URL Safe</button>
      </div>
      <n-checkbox v-model:checked="padding" size="small">保留填充</n-checkbox>
      <n-button size="small" type="primary" :render-icon="() => renderIcon(ArrowRight)" @click="convert">转换</n-button>
    </template>

    <template #status>UTF-8 · {{ variant === "url" ? "Base64URL" : "RFC 4648 Base64" }}</template>
    <template #input-actions>
      <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="clearAll">清空</n-button>
    </template>
    <template #output-actions>
      <n-button size="tiny" quaternary :disabled="!output" :render-icon="() => renderIcon(ArrowLeftRight)" title="交换并反向转换" @click="swap" />
      <n-button size="tiny" secondary :disabled="!output" :render-icon="() => renderIcon(Copy)" @click="copyText(output)">复制</n-button>
    </template>
  </CodecWorkbench>
</template>

<style scoped>
.segmented { display: flex; gap: 2px; padding: 2px; border-radius: 5px; background: var(--bg-input); }
.segmented button { height: 23px; padding: 0 10px; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); font-size: 10px; cursor: pointer; }
.segmented button:hover { color: var(--text-primary); background: var(--bg-hover); }
.segmented button.active { color: var(--brand); background: var(--brand-soft); font-weight: 600; }
.segmented button:focus { outline: none; }
.segmented button:focus-visible { box-shadow: inset 0 0 0 1px var(--brand); }
.toolbar-divider { width: 1px; height: 18px; background: var(--border-subtle); }
:deep(.n-checkbox__label) { color: var(--text-secondary); font-size: 10px; }
</style>

