<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NCheckbox, useMessage } from "naive-ui";
import { ArrowLeftRight, ArrowRight, Copy, Eraser } from "lucide-vue-next";
import CodecWorkbench from "@/features/codec/components/CodecWorkbench.vue";
import { decodeUrl, encodeUrl } from "@/features/url/urlCodecService";
import type { UrlCodecScope } from "@/features/url/urlCodecService";
import { useClipboard } from "@/composables/useClipboard";
import { renderIcon } from "@/utils/render";

type Operation = "encode" | "decode";

const message = useMessage();
const { copyText } = useClipboard(message);
const operation = ref<Operation>("encode");
const scope = ref<UrlCodecScope>("component");
const spaceAsPlus = ref(false);
const input = ref("https://example.com/search?q=你好世界&lang=zh");
const output = ref("");
const standardLabel = computed(() => scope.value === "uri" ? "WHATWG URI · 保留结构字符" : spaceAsPlus.value ? "application/x-www-form-urlencoded" : "ECMAScript URI Component");

function convert() {
  try {
    const options = { scope: scope.value, spaceAsPlus: spaceAsPlus.value };
    output.value = operation.value === "encode" ? encodeUrl(input.value, options) : decodeUrl(input.value, options);
  } catch (error) {
    output.value = "";
    message.error(error instanceof Error ? error.message : "URL 转换失败");
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
    input-placeholder="输入完整 URL 或需要处理的参数值"
    output-placeholder="点击转换查看结果"
    @update:input="input = $event"
  >
    <template #controls>
      <div class="segmented" role="radiogroup" aria-label="URL 操作">
        <button type="button" role="radio" :aria-checked="operation === 'encode'" :class="{ active: operation === 'encode' }" @click="operation = 'encode'">编码</button>
        <button type="button" role="radio" :aria-checked="operation === 'decode'" :class="{ active: operation === 'decode' }" @click="operation = 'decode'">解码</button>
      </div>
      <span class="toolbar-divider" />
      <div class="segmented" role="radiogroup" aria-label="URL 编码范围">
        <button type="button" role="radio" :aria-checked="scope === 'component'" :class="{ active: scope === 'component' }" @click="scope = 'component'">参数值</button>
        <button type="button" role="radio" :aria-checked="scope === 'uri'" :class="{ active: scope === 'uri' }" @click="scope = 'uri'">完整 URL</button>
      </div>
      <n-checkbox v-if="scope === 'component'" v-model:checked="spaceAsPlus" size="small">空格使用 +</n-checkbox>
      <n-button size="small" type="primary" :render-icon="() => renderIcon(ArrowRight)" @click="convert">转换</n-button>
    </template>

    <template #status>{{ standardLabel }}</template>
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
