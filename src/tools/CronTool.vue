<script setup lang="ts">
import { computed, reactive, ref } from "vue";
import { NButton, NInput, NInputNumber, useMessage } from "naive-ui";
import { Play, RotateCcw } from "lucide-vue-next";
import CronFieldEditor from "@/features/cron/components/CronFieldEditor.vue";
import CronRunsPanel from "@/features/cron/components/CronRunsPanel.vue";
import { CRON_FIELDS, DEFAULT_QUARTZ_FIELDS, QUARTZ_PRESETS } from "@/features/cron/config";
import {
  describeQuartzCron,
  fieldsToExpression,
  nextQuartzRuns,
  parseQuartzCron,
} from "@/features/cron/quartzCron";
import type { CronFieldKey, QuartzCronFields } from "@/features/cron/types";
import { useClipboard } from "@/composables/useClipboard";
import { renderIcon } from "@/utils/render";

const message = useMessage();
const { copyText } = useClipboard(message);

const activeField = ref<CronFieldKey>("second");
const includeYear = ref(false);
const fields = reactive<QuartzCronFields>({ ...DEFAULT_QUARTZ_FIELDS });
const expressionDraft = ref(fieldsToExpression(fields, includeYear.value));
const runCount = ref(10);

const parseResult = computed(() => parseQuartzCron(expressionDraft.value));
const isValid = computed(() => parseResult.value.fields !== null);
const description = computed(() => parseResult.value.fields ? describeQuartzCron(parseResult.value.fields) : "");
const nextDates = computed(() => {
  if (!parseResult.value.fields) return [];
  try {
    return nextQuartzRuns(parseResult.value.fields, runCount.value);
  } catch {
    return [];
  }
});

function syncExpression() {
  expressionDraft.value = fieldsToExpression(fields, includeYear.value);
}

function updateField(key: CronFieldKey, value: string) {
  fields[key] = value.trim() || "*";
  if (key === "dayOfMonth") {
    if (fields.dayOfMonth !== "?") fields.dayOfWeek = "?";
    else if (fields.dayOfWeek === "?") fields.dayOfWeek = "*";
  }
  if (key === "dayOfWeek") {
    if (fields.dayOfWeek !== "?") fields.dayOfMonth = "?";
    else if (fields.dayOfMonth === "?") fields.dayOfMonth = "*";
  }
  if (key === "year" && fields.year !== "*") includeYear.value = true;
  syncExpression();
}

function applyExpression(showSuccess = true) {
  const result = parseQuartzCron(expressionDraft.value);
  if (!result.fields) {
    message.error(result.error);
    return;
  }
  Object.assign(fields, result.fields);
  includeYear.value = expressionDraft.value.trim().split(/\s+/).length === 7;
  syncExpression();
  if (showSuccess) message.success("已反解析到字段编辑器");
}

function applyPreset(value: string) {
  expressionDraft.value = value;
  applyExpression(false);
}

function calculate() {
  if (!isValid.value) {
    message.error(parseResult.value.error);
    return;
  }
  message.success(`已计算最近 ${nextDates.value.length} 次运行时间`);
}

function formatDate(date: Date) {
  const dateText = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((value, index) => index === 0 ? String(value) : String(value).padStart(2, "0"))
    .join("-");
  const timeText = [date.getHours(), date.getMinutes(), date.getSeconds()]
    .map((value) => String(value).padStart(2, "0"))
    .join(":");
  return `${dateText} ${timeText}`;
}

function copyRuns() {
  void copyText(nextDates.value.map((date, index) => `${index + 1}. ${formatDate(date)}`).join("\n"));
}
</script>

<template>
  <section class="cron-tool">
    <section class="builder-panel">
      <div class="field-tabs" role="tablist" aria-label="Cron 字段">
        <button
          v-for="field in CRON_FIELDS"
          :key="field.key"
          type="button"
          role="tab"
          :aria-selected="activeField === field.key"
          :class="{ active: activeField === field.key }"
          @click="activeField = field.key"
        >
          {{ field.label }}
        </button>
      </div>

      <CronFieldEditor
        :key="activeField"
        :field-key="activeField"
        :model-value="fields[activeField]"
        @update:model-value="updateField(activeField, $event)"
      />
    </section>

    <section class="expression-panel">
      <header class="section-head compact">
        <div>
          <h2>表达式</h2>
          <span>修改字段或输入完整表达式</span>
        </div>
      </header>

      <div class="field-values">
        <label v-for="field in CRON_FIELDS" :key="field.key">
          <span>{{ field.label }}</span>
          <n-input
            :value="fields[field.key]"
            size="small"
            :placeholder="field.key === 'year' ? '可选' : '*'"
            @update:value="updateField(field.key, $event)"
          />
        </label>
      </div>

      <div class="expression-row">
        <n-input
          v-model:value="expressionDraft"
          size="small"
          class="expression-input"
          :status="expressionDraft && !isValid ? 'error' : undefined"
          placeholder="0 0 9 ? * 2-6"
          @keyup.enter="applyExpression()"
        />
        <n-input-number
          v-model:value="runCount"
          size="small"
          :min="1"
          :max="50"
          :show-button="false"
          class="count-input"
        />
        <span class="count-unit">次</span>
        <n-button size="small" secondary :render-icon="() => renderIcon(RotateCcw)" @click="applyExpression()">反解析</n-button>
        <n-button size="small" type="primary" :render-icon="() => renderIcon(Play)" @click="calculate">计算</n-button>
      </div>

      <div v-if="isValid" class="validation valid"><span class="status-dot" />{{ description }}</div>
      <div v-else class="validation invalid">{{ parseResult.error }}</div>
    </section>

    <div class="output-area">
      <section class="preset-panel">
        <header class="section-head compact">
          <div><h2>常用模板</h2><span>Quartz 表达式</span></div>
        </header>
        <div class="preset-list">
          <button
            v-for="preset in QUARTZ_PRESETS"
            :key="preset.value"
            type="button"
            :class="{ active: expressionDraft === preset.value }"
            @click="applyPreset(preset.value)"
          >
            <span>{{ preset.label }}</span>
            <code>{{ preset.value }}</code>
          </button>
        </div>
      </section>

      <CronRunsPanel :dates="nextDates" :valid="isValid" @copy="copyRuns" />
    </div>
  </section>
</template>

<style scoped>
.cron-tool { flex: 1; min-height: 0; overflow: hidden; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.builder-panel, .expression-panel { min-height: 0; padding: 8px 12px; }
.builder-panel { border-bottom: 1px solid var(--border-subtle); }
.expression-panel { border-bottom: 1px solid var(--border-subtle); }
.section-head { min-height: 27px; display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 5px; }
.section-head > div { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
.section-head h2 { margin: 0; color: var(--text-primary); font-size: 13px; font-weight: 700; }
.section-head span { color: var(--text-muted); font-size: 11px; }
.section-head > code { padding: 3px 6px; border: 1px solid var(--border-subtle); border-radius: 4px; color: var(--brand); background: var(--brand-soft); font-size: 10px; }
.section-head.compact { min-height: 20px; margin-bottom: 5px; }
.field-tabs { display: grid; grid-template-columns: repeat(7, minmax(72px, 1fr)); border-bottom: 1px solid var(--border-strong); margin-bottom: 6px; }
.field-tabs button { height: 27px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--text-muted); font-size: 11px; cursor: pointer; }
.field-tabs button:hover { color: var(--text-primary); background: var(--bg-hover); }
.field-tabs button.active { color: var(--brand); border-bottom-color: var(--brand); font-weight: 600; }
.field-tabs button:focus { outline: none; }
.field-tabs button:focus-visible { box-shadow: inset 0 0 0 1px var(--brand); }
.field-values { display: grid; grid-template-columns: repeat(7, minmax(72px, 1fr)); gap: 8px; }
.field-values label { min-width: 0; display: grid; gap: 4px; }
.field-values label > span { color: var(--text-muted); font-size: 10px; line-height: 1; }
.field-values label:focus-within > span { color: var(--brand); }
.expression-row { display: flex; align-items: center; gap: 7px; margin-top: 6px; }
.expression-input { flex: 1; min-width: 0; font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
.count-input { width: 58px; flex-shrink: 0; }
.count-unit { min-width: 12px; flex-shrink: 0; color: var(--text-muted); font-size: 11px; }
.validation { min-height: 21px; display: flex; align-items: center; gap: 7px; margin-top: 5px; padding: 0 8px; border-radius: 4px; font-size: 11px; }
.validation.valid { color: var(--success); background: var(--success-soft); }
.validation.invalid { color: var(--danger); background: var(--danger-soft); }
.status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.output-area { min-height: 0; overflow: hidden; display: grid; grid-template-columns: minmax(260px, 0.72fr) minmax(380px, 1.28fr); padding: 8px 12px; }
.preset-panel { min-height: 0; display: flex; flex-direction: column; padding-right: 14px; }
.preset-list { flex: 1; min-height: 0; overflow-y: auto; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-content: start; gap: 4px; }
.preset-list button { min-width: 0; min-height: 31px; display: grid; align-content: center; gap: 1px; padding: 3px 7px; border: 1px solid var(--border-subtle); border-radius: 5px; background: var(--bg-input); text-align: left; cursor: pointer; }
.preset-list button:hover, .preset-list button.active { border-color: var(--brand); background: var(--brand-soft); }
.preset-list span { color: var(--text-secondary); font-size: 11px; }
.preset-list code { overflow: hidden; color: var(--text-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
@media (max-width: 900px) {
  .cron-tool { overflow-y: auto; display: flex; }
  .field-tabs, .field-values { grid-template-columns: repeat(4, minmax(72px, 1fr)); }
  .output-area { grid-template-columns: 1fr; gap: 14px; }
  .preset-panel { padding-right: 0; }
  :deep(.runs-panel) { border-left: 0; border-top: 1px solid var(--border-subtle); padding: 12px 0 0; }
}
</style>
