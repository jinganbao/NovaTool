<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NCheckbox, NInput, useMessage } from "naive-ui";
import { Copy } from "lucide-vue-next";
import { convertRadix } from "@/features/radix/radixService";
import type { RadixBase, SourceRadix } from "@/features/radix/radixService";
import { useClipboard } from "@/composables/useClipboard";
import { renderIcon } from "@/utils/render";

const BASES: Array<{ value: RadixBase; label: string; short: string }> = [
  { value: 2, label: "二进制", short: "BIN" },
  { value: 8, label: "八进制", short: "OCT" },
  { value: 10, label: "十进制", short: "DEC" },
  { value: 16, label: "十六进制", short: "HEX" },
];

const SOURCE_OPTIONS: Array<{ value: SourceRadix; label: string }> = [
  { value: "auto", label: "自动" },
  ...BASES.map((base) => ({ value: base.value, label: String(base.value) })),
];

const message = useMessage();
const { copyText } = useClipboard(message);
const input = ref("0xFF");
const source = ref<SourceRadix>("auto");
const uppercase = ref(true);
const includePrefix = ref(true);

const conversion = computed(() => {
  try {
    return { data: convertRadix(input.value, source.value, { uppercase: uppercase.value, prefix: includePrefix.value }), error: "" };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : "进制转换失败" };
  }
});

function copyValue(value: string) {
  void copyText(value);
}
</script>

<template>
  <section class="radix-workbench">
    <section class="input-panel">
      <div class="input-head">
        <div><h2>输入整数</h2><span>支持负数、下划线分隔符和任意长度整数</span></div>
        <span v-if="conversion.data" class="detected">识别为 {{ conversion.data.detectedBase }} 进制</span>
      </div>

      <div class="input-row">
        <n-input v-model:value="input" size="small" class="radix-input" placeholder="例如 0xFF、0b1010 或 1_000_000" />
        <div class="segmented" role="radiogroup" aria-label="输入进制">
          <button
            v-for="option in SOURCE_OPTIONS"
            :key="option.value"
            type="button"
            role="radio"
            :aria-checked="source === option.value"
            :class="{ active: source === option.value }"
            @click="source = option.value"
          >{{ option.label }}</button>
        </div>
      </div>

      <div class="options-row">
        <span>输出格式</span>
        <n-checkbox v-model:checked="includePrefix" size="small">包含进制前缀</n-checkbox>
        <n-checkbox v-model:checked="uppercase" size="small">十六进制大写</n-checkbox>
      </div>
      <div v-if="conversion.error" class="error-line">{{ conversion.error }}</div>
    </section>

    <section class="results-panel">
      <header><h2>转换结果</h2><span>输入变化时实时计算</span></header>
      <div class="result-table">
        <div v-for="base in BASES" :key="base.value" class="result-row">
          <span class="base-badge">{{ base.short }}</span>
          <div class="base-label"><strong>{{ base.label }}</strong><small>Base {{ base.value }}</small></div>
          <code :class="{ muted: !conversion.data }">{{ conversion.data?.outputs.find((item) => item.base === base.value)?.value || "—" }}</code>
          <n-button
            size="tiny"
            quaternary
            :aria-label="`复制${base.label}`"
            :disabled="!conversion.data"
            :render-icon="() => renderIcon(Copy)"
            @click="copyValue(conversion.data!.outputs.find((item) => item.base === base.value)!.value)"
          />
        </div>
      </div>
    </section>
  </section>
</template>

<style scoped>
.radix-workbench { flex: 1; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 10px; }
.input-panel, .results-panel { border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.input-panel { padding: 11px 12px; }
.input-head, .results-panel > header { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.input-head > div { display: flex; align-items: baseline; gap: 8px; }
h2 { margin: 0; color: var(--text-primary); font-size: 13px; }
.input-head span, .results-panel > header span { color: var(--text-muted); font-size: 10px; }
.detected { color: var(--brand) !important; }
.input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; margin-top: 9px; }
.radix-input { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
.segmented { display: flex; gap: 2px; padding: 2px; border-radius: 5px; background: var(--bg-input); }
.segmented button { min-width: 38px; height: 24px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); font-size: 10px; cursor: pointer; }
.segmented button:hover { color: var(--text-primary); background: var(--bg-hover); }
.segmented button.active { color: var(--brand); background: var(--brand-soft); font-weight: 600; }
.segmented button:focus { outline: none; }
.segmented button:focus-visible { box-shadow: inset 0 0 0 1px var(--brand); }
.options-row { min-height: 28px; display: flex; align-items: center; gap: 14px; margin-top: 6px; }
.options-row > span { color: var(--text-muted); font-size: 10px; }
:deep(.n-checkbox__label) { color: var(--text-secondary); font-size: 10px; }
.error-line { min-height: 24px; display: flex; align-items: center; margin-top: 5px; padding: 0 8px; border-radius: 4px; color: var(--danger); background: var(--danger-soft); font-size: 10px; }
.results-panel { min-height: 0; display: flex; flex-direction: column; padding: 11px 12px; }
.results-panel > header { min-height: 28px; margin-bottom: 7px; }
.results-panel > header { justify-content: flex-start; }
.result-table { min-height: 0; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: 5px; }
.result-row { min-height: 58px; display: grid; grid-template-columns: 42px 96px minmax(0, 1fr) 28px; align-items: center; gap: 10px; padding: 6px 8px; border-bottom: 1px solid var(--border-subtle); }
.result-row:last-child { border-bottom: 0; }
.result-row:hover { background: var(--bg-hover); }
.base-badge { width: 38px; height: 24px; display: grid; place-items: center; border-radius: 4px; color: var(--brand); background: var(--brand-soft); font-family: "SFMono-Regular", Consolas, monospace; font-size: 10px; font-weight: 700; }
.base-label { display: grid; gap: 2px; }
.base-label strong { color: var(--text-secondary); font-size: 11px; }
.base-label small { color: var(--text-muted); font-size: 9px; }
.result-row code { min-width: 0; overflow-wrap: anywhere; color: var(--text-primary); font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; line-height: 1.45; user-select: all; }
.result-row code.muted { color: var(--text-muted); }
@media (max-width: 700px) {
  .input-row { grid-template-columns: 1fr; }
  .segmented { width: fit-content; }
  .result-row { grid-template-columns: 42px minmax(0, 1fr) 28px; }
  .base-label { display: none; }
}
</style>

