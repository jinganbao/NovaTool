<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { NInputNumber } from "naive-ui";
import { CRON_FIELDS } from "../config";
import type { CronFieldKey, CronFieldMode } from "../types";

const props = defineProps<{
  fieldKey: CronFieldKey;
  modelValue: string;
}>();

const emit = defineEmits<{ "update:model-value": [value: string] }>();

const mode = ref<CronFieldMode>("every");
const start = ref(0);
const end = ref(1);
const step = ref(1);
const nth = ref(1);
const selectedValues = ref<number[]>([]);

const definition = computed(() => CRON_FIELDS.find((field) => field.key === props.fieldKey)!);
const isDay = computed(() => props.fieldKey === "dayOfMonth");
const isWeek = computed(() => props.fieldKey === "dayOfWeek");
const isYear = computed(() => props.fieldKey === "year");
const modeOptions = computed<Array<{ label: string; value: CronFieldMode }>>(() => {
  const options: Array<{ label: string; value: CronFieldMode }> = [];
  if (!isYear.value) options.push({ label: `每${definition.value.label}`, value: "every" });
  if (isDay.value || isWeek.value || isYear.value) options.push({ label: "不指定", value: "unspecified" });
  options.push({ label: "周期", value: "range" });
  if (!isWeek.value && !isYear.value) options.push({ label: "间隔", value: "interval" });
  if (isDay.value) {
    options.push({ label: "最近工作日", value: "nearestWeekday" });
    options.push({ label: "最后一天", value: "last" });
  }
  if (isWeek.value) {
    options.push({ label: "第几个星期", value: "nthWeekday" });
    options.push({ label: "最后一个星期", value: "lastWeekday" });
  }
  options.push({ label: "指定", value: "specific" });
  return options;
});

function clamp(value: number | null, fallback: number): number {
  if (value === null || !Number.isFinite(value)) return fallback;
  return Math.max(definition.value.min, Math.min(definition.value.max, value));
}

function initialize(value: string) {
  start.value = definition.value.min;
  end.value = Math.min(definition.value.max, definition.value.min + 1);
  step.value = 1;
  nth.value = 1;
  selectedValues.value = [];

  if (value === "?") mode.value = "unspecified";
  else if (value === "*") mode.value = isYear.value ? "unspecified" : "every";
  else if (value === "L") mode.value = "last";
  else if (/^\d+W$/.test(value)) {
    mode.value = "nearestWeekday";
    start.value = Number(value.slice(0, -1));
  } else if (/^\d+#\d+$/.test(value)) {
    mode.value = "nthWeekday";
    const [weekday, index] = value.split("#").map(Number);
    start.value = weekday;
    nth.value = index;
  } else if (/^\d+L$/.test(value)) {
    mode.value = "lastWeekday";
    start.value = Number(value.slice(0, -1));
  } else if (value.includes("/")) {
    mode.value = "interval";
    const [from, interval] = value.split("/");
    start.value = from === "*" ? definition.value.min : Number(from);
    step.value = Number(interval);
  } else if (/^\d+-\d+$/.test(value)) {
    mode.value = "range";
    const [from, to] = value.split("-").map(Number);
    start.value = from;
    end.value = to;
  } else {
    mode.value = "specific";
    selectedValues.value = value.split(",").map(Number).filter(Number.isFinite);
    start.value = selectedValues.value[0] ?? definition.value.min;
  }
}

watch(() => [props.fieldKey, props.modelValue], () => initialize(props.modelValue), { immediate: true });

function buildExpression(): string {
  switch (mode.value) {
    case "every": return "*";
    case "unspecified": return isYear.value ? "*" : "?";
    case "range": return `${start.value}-${end.value}`;
    case "interval": return `${start.value}/${step.value}`;
    case "specific": return isYear.value ? String(start.value) : [...selectedValues.value].sort((a, b) => a - b).join(",");
    case "nearestWeekday": return `${start.value}W`;
    case "last": return "L";
    case "nthWeekday": return `${start.value}#${nth.value}`;
    case "lastWeekday": return `${start.value}L`;
  }
}

function commit() {
  const value = buildExpression();
  if (value) emit("update:model-value", value);
}

function chooseMode(nextMode: CronFieldMode) {
  mode.value = nextMode;
  if (nextMode === "specific" && selectedValues.value.length === 0) {
    selectedValues.value = [start.value];
  }
  commit();
}

function updateStart(value: number | null) {
  start.value = clamp(value, definition.value.min);
  if (mode.value === "range" && end.value < start.value) end.value = start.value;
  commit();
}

function updateEnd(value: number | null) {
  end.value = clamp(value, start.value);
  commit();
}

function updateStep(value: number | null) {
  step.value = Math.max(1, Number(value) || 1);
  commit();
}

function updateNth(value: number | null) {
  nth.value = Math.max(1, Math.min(5, Number(value) || 1));
  commit();
}

function toggleValue(value: number, checked: boolean) {
  const nextValues = checked
    ? [...new Set([...selectedValues.value, value])]
    : selectedValues.value.filter((item) => item !== value);
  if (nextValues.length === 0) return;
  selectedValues.value = nextValues;
  commit();
}
</script>

<template>
  <div class="field-editor">
    <div class="field-meta">
      <strong>{{ definition.label }}</strong>
      <span>允许的通配符：{{ definition.allowed }}</span>
    </div>

    <div class="mode-switch" role="radiogroup" :aria-label="`${definition.label}模式`">
      <button
        v-for="option in modeOptions"
        :key="option.value"
        type="button"
        role="radio"
        :aria-checked="mode === option.value"
        :class="{ active: mode === option.value }"
        @click="chooseMode(option.value)"
      >
        {{ option.label }}
      </button>
    </div>

    <div v-if="mode !== 'specific' || isYear" class="mode-config">
      <div v-if="mode === 'every'" class="mode-summary">
        当前字段在每个{{ definition.label }}均会触发
      </div>
      <div v-else-if="mode === 'unspecified'" class="mode-summary">
        {{ isYear ? "不限制年份，完整表达式将省略年份字段" : "当前字段使用 ?，由另一个日期字段决定触发时间" }}
      </div>
      <div v-else-if="mode === 'range'" class="control-line">
        <span>从</span>
        <n-input-number :value="start" size="small" :min="definition.min" :max="definition.max" @update:value="updateStart" />
        <span>至</span>
        <n-input-number :value="end" size="small" :min="start" :max="definition.max" @update:value="updateEnd" />
        <span>{{ definition.label }}之间执行</span>
      </div>
      <div v-else-if="mode === 'interval'" class="control-line">
        <span>从</span>
        <n-input-number :value="start" size="small" :min="definition.min" :max="definition.max" @update:value="updateStart" />
        <span>开始，每</span>
        <n-input-number :value="step" size="small" :min="1" :max="definition.max" @update:value="updateStep" />
        <span>{{ definition.label }}执行一次</span>
      </div>
      <div v-else-if="mode === 'nearestWeekday'" class="control-line">
        <span>每月</span>
        <n-input-number :value="start" size="small" :min="1" :max="31" @update:value="updateStart" />
        <span>号最近的工作日执行</span>
      </div>
      <div v-else-if="mode === 'last'" class="mode-summary">在每月最后一天执行</div>
      <div v-else-if="mode === 'nthWeekday'" class="control-line">
        <span>本月第</span>
        <n-input-number :value="nth" size="small" :min="1" :max="5" @update:value="updateNth" />
        <span>个星期</span>
        <n-input-number :value="start" size="small" :min="1" :max="7" @update:value="updateStart" />
      </div>
      <div v-else-if="mode === 'lastWeekday'" class="control-line">
        <span>本月最后一个星期</span>
        <n-input-number :value="start" size="small" :min="1" :max="7" @update:value="updateStart" />
      </div>
      <div v-else-if="mode === 'specific' && isYear" class="control-line">
        <span>指定年份</span>
        <n-input-number :value="start" size="small" :min="definition.min" :max="definition.max" @update:value="updateStart" />
      </div>
    </div>

    <div v-if="mode === 'specific' && definition.values" class="value-grid">
      <label v-for="item in definition.values" :key="item.value" class="value-option">
        <input
          type="checkbox"
          :checked="selectedValues.includes(item.value)"
          @change="toggleValue(item.value, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ item.label }}</span>
      </label>
    </div>
  </div>
</template>

<style scoped>
.field-editor { min-height: 0; }
.field-meta { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; margin-bottom: 7px; }
.field-meta strong { color: var(--text-primary); font-size: 13px; }
.field-meta span { color: var(--text-muted); font-size: 11px; }
.mode-switch { width: fit-content; max-width: 100%; display: flex; flex-wrap: wrap; align-items: center; gap: 2px; min-height: 30px; padding: 3px; border-radius: 5px; background: var(--bg-input); }
.mode-switch button { min-width: 72px; height: 24px; padding: 0 9px; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; }
.mode-switch button:hover { color: var(--text-primary); background: var(--bg-hover); }
.mode-switch button.active { color: var(--brand); background: var(--brand-soft); font-weight: 600; }
.mode-switch button:focus { outline: none; }
.mode-switch button:focus-visible { box-shadow: inset 0 0 0 1px var(--brand); }
.mode-config { min-height: 38px; display: flex; align-items: center; padding: 5px 8px 0; }
.mode-summary { color: var(--text-secondary); font-size: 11px; }
.control-line { display: flex; align-items: center; gap: 7px; color: var(--text-secondary); font-size: 11px; }
.control-line :deep(.n-input-number) { width: 84px; }
.value-grid { max-height: 112px; overflow-y: auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(66px, 1fr)); align-content: start; gap: 3px 7px; margin-top: 5px; padding: 7px 9px; border: 1px solid var(--border-subtle); border-radius: 5px; background: var(--bg-input); }
.value-option { display: flex; align-items: center; gap: 5px; color: var(--text-secondary); font-size: 11px; cursor: pointer; }
</style>
