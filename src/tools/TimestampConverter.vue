<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { NButton, NInput, useMessage } from "naive-ui";
import { ArrowRight, Clock3, Copy, RefreshCw } from "lucide-vue-next";
import TimeValueRow from "@/features/timestamp/components/TimeValueRow.vue";
import {
  dateToTimestampValues,
  dayOfYear,
  formatDateTimeInput,
  formatLocalDate,
  formatLocalIso,
  formatLocalRfc2822,
  formatOffset,
  formatUtcDate,
  parseDateTimeInput,
  parseTimestamp,
  weekdayText,
} from "@/features/timestamp/conversion";
import type {
  DateTimeMode,
  ParsedTimestamp,
  TimestampUnit,
  TimestampUnitOption,
} from "@/features/timestamp/conversion";
import { useClipboard } from "@/composables/useClipboard";
import { renderIcon } from "@/utils/render";

const message = useMessage();
const { copyText } = useClipboard(message);

const UNIT_OPTIONS: Array<{ label: string; value: TimestampUnitOption }> = [
  { label: "自动", value: "auto" },
  { label: "秒", value: "s" },
  { label: "毫秒", value: "ms" },
  { label: "微秒", value: "us" },
  { label: "纳秒", value: "ns" },
];

const UNIT_LABELS: Record<TimestampUnit, string> = {
  s: "秒",
  ms: "毫秒",
  us: "微秒",
  ns: "纳秒",
};

const now = ref(new Date());
const initialNow = new Date();
const nowValues = computed(() => dateToTimestampValues(now.value));
const timezoneName = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
const timer = setInterval(() => { now.value = new Date(); }, 1000);
onBeforeUnmount(() => clearInterval(timer));

const timestampInput = ref(dateToTimestampValues(initialNow).seconds);
const timestampUnit = ref<TimestampUnitOption>("auto");
const timestampOutputMode = ref<"local" | "utc">("local");
const timestampResult = ref<ParsedTimestamp | null>(parseTimestamp(timestampInput.value, "auto"));
const timestampError = ref("");

const dateTimeMode = ref<DateTimeMode>("local");
const dateTimeInput = ref(formatDateTimeInput(initialNow, "local"));
const dateTimeResult = ref<Date>(initialNow);
const dateTimeError = ref("");

const convertedValues = computed(() => dateToTimestampValues(dateTimeResult.value));

function convertTimestamp() {
  try {
    timestampResult.value = parseTimestamp(timestampInput.value, timestampUnit.value);
    timestampError.value = "";
  } catch (error) {
    timestampError.value = error instanceof Error ? error.message : "时间戳格式错误";
  }
}

function fillCurrentTimestamp() {
  timestampInput.value = nowValues.value.seconds;
  timestampUnit.value = "s";
  convertTimestamp();
}

function convertDateTime() {
  try {
    dateTimeResult.value = parseDateTimeInput(dateTimeInput.value, dateTimeMode.value);
    dateTimeError.value = "";
  } catch (error) {
    dateTimeError.value = error instanceof Error ? error.message : "日期格式错误";
  }
}

function fillCurrentDateTime() {
  const current = new Date();
  dateTimeInput.value = formatDateTimeInput(current, dateTimeMode.value);
  dateTimeResult.value = current;
  dateTimeError.value = "";
}

function changeDateTimeMode(mode: DateTimeMode) {
  let instant = dateTimeResult.value;
  try {
    instant = parseDateTimeInput(dateTimeInput.value, dateTimeMode.value);
  } catch {
    // 输入未完成时保留上一次合法结果。
  }
  dateTimeMode.value = mode;
  dateTimeInput.value = formatDateTimeInput(instant, mode);
  dateTimeResult.value = instant;
  dateTimeError.value = "";
}
</script>

<template>
  <section class="timestamp-tool">
    <section class="current-strip">
      <div class="live-clock">
        <div class="clock-icon"><Clock3 :size="18" /></div>
        <div>
          <code>{{ formatLocalDate(now, false) }}</code>
          <span>{{ timezoneName }} · {{ formatOffset(now) }} · {{ weekdayText(now) }}</span>
        </div>
      </div>

      <button type="button" class="live-value" @click="copyText(nowValues.seconds)">
        <span>Unix 秒</span><code>{{ nowValues.seconds }}</code><Copy :size="12" />
      </button>
      <button type="button" class="live-value" @click="copyText(nowValues.milliseconds)">
        <span>Unix 毫秒</span><code>{{ nowValues.milliseconds }}</code><Copy :size="12" />
      </button>
      <button type="button" class="live-value iso" @click="copyText(now.toISOString())">
        <span>ISO 8601 UTC</span><code>{{ now.toISOString() }}</code><Copy :size="12" />
      </button>
    </section>

    <div class="converter-grid">
      <section class="converter-panel">
        <header class="panel-head">
          <div>
            <h2>时间戳转日期</h2>
            <span>支持 10 / 13 / 16 / 19 位 Epoch</span>
          </div>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(RefreshCw)" @click="fillCurrentTimestamp">当前时间</n-button>
        </header>

        <div class="input-block">
          <label for="timestamp-input">时间戳</label>
          <div class="primary-input-row">
            <n-input
              id="timestamp-input"
              v-model:value="timestampInput"
              size="small"
              placeholder="例如 1700000000"
              class="mono-input"
              @keyup.enter="convertTimestamp"
            />
            <n-button size="small" type="primary" :render-icon="() => renderIcon(ArrowRight)" @click="convertTimestamp">转换</n-button>
          </div>

          <div class="option-row">
            <span>输入精度</span>
            <div class="segmented" role="radiogroup" aria-label="时间戳精度">
              <button
                v-for="option in UNIT_OPTIONS"
                :key="option.value"
                type="button"
                role="radio"
                :aria-checked="timestampUnit === option.value"
                :class="{ active: timestampUnit === option.value }"
                @click="timestampUnit = option.value"
              >
                {{ option.label }}
              </button>
            </div>
            <span v-if="timestampResult && timestampUnit === 'auto'" class="detected">
              已识别：{{ UNIT_LABELS[timestampResult.unit] }}
            </span>
          </div>
          <div class="option-row">
            <span>输出时区</span>
            <div class="segmented" role="radiogroup" aria-label="结果时区">
              <button type="button" role="radio" :aria-checked="timestampOutputMode === 'local'" :class="{ active: timestampOutputMode === 'local' }" @click="timestampOutputMode = 'local'">本地</button>
              <button type="button" role="radio" :aria-checked="timestampOutputMode === 'utc'" :class="{ active: timestampOutputMode === 'utc' }" @click="timestampOutputMode = 'utc'">UTC</button>
            </div>
            <span v-if="timestampResult" class="detected">
              {{ timestampOutputMode === "local" ? `${timezoneName} · ${formatOffset(timestampResult.date)}` : "UTC+00:00" }}
            </span>
          </div>
          <div v-if="timestampError" class="error-line">{{ timestampError }}</div>
        </div>

        <div v-if="timestampResult" class="result-block">
          <TimeValueRow label="日期时间" :value="formatLocalDate(timestampResult.date, false)" @copy="copyText" />
          <TimeValueRow label="UTC" :value="formatUtcDate(timestampResult.date)" @copy="copyText" />
          <TimeValueRow label="ISO 8601" :value="timestampOutputMode === 'local' ? formatLocalIso(timestampResult.date) : timestampResult.date.toISOString()" @copy="copyText" />
          <TimeValueRow label="RFC 2822" :value="timestampOutputMode === 'local' ? formatLocalRfc2822(timestampResult.date) : timestampResult.date.toUTCString()" @copy="copyText" />
          <div class="result-meta">
            <span>{{ weekdayText(timestampResult.date) }}</span>
            <span>当年第 {{ dayOfYear(timestampResult.date) }} 天</span>
            <span>{{ timezoneName }} {{ formatOffset(timestampResult.date) }}</span>
          </div>
        </div>
      </section>

      <section class="converter-panel">
        <header class="panel-head">
          <div>
            <h2>日期转时间戳</h2>
            <span>明确日期输入采用的时区语义</span>
          </div>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(RefreshCw)" @click="fillCurrentDateTime">当前时间</n-button>
        </header>

        <div class="input-block">
          <label for="datetime-input">日期与时间</label>
          <div class="primary-input-row">
            <n-input
              id="datetime-input"
              v-model:value="dateTimeInput"
              size="small"
              placeholder="YYYY-MM-DD HH:mm:ss.SSS"
              class="mono-input"
              @keyup.enter="convertDateTime"
            />
            <n-button size="small" type="primary" :render-icon="() => renderIcon(ArrowRight)" @click="convertDateTime">转换</n-button>
          </div>

          <div class="option-row">
            <span>输入时区</span>
            <div class="segmented" role="radiogroup" aria-label="日期输入时区">
              <button type="button" role="radio" :aria-checked="dateTimeMode === 'local'" :class="{ active: dateTimeMode === 'local' }" @click="changeDateTimeMode('local')">本地</button>
              <button type="button" role="radio" :aria-checked="dateTimeMode === 'utc'" :class="{ active: dateTimeMode === 'utc' }" @click="changeDateTimeMode('utc')">UTC</button>
            </div>
            <span class="detected">{{ dateTimeMode === "local" ? `${timezoneName} · ${formatOffset(dateTimeResult)}` : "UTC+00:00" }}</span>
          </div>
          <div v-if="dateTimeError" class="error-line">{{ dateTimeError }}</div>
        </div>

        <div class="result-block">
          <TimeValueRow label="秒" :value="convertedValues.seconds" @copy="copyText" />
          <TimeValueRow label="毫秒" :value="convertedValues.milliseconds" @copy="copyText" />
          <TimeValueRow label="微秒" :value="convertedValues.microseconds" @copy="copyText" />
          <TimeValueRow label="纳秒" :value="convertedValues.nanoseconds" @copy="copyText" />
          <div class="result-meta">
            <span>{{ formatUtcDate(dateTimeResult, false) }}</span>
            <span>{{ dateTimeResult.toISOString() }}</span>
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.timestamp-tool { flex: 1; min-height: 0; display: grid; grid-template-rows: 82px minmax(0, 1fr); gap: 10px; overflow: hidden; }
.current-strip { min-width: 0; display: grid; grid-template-columns: minmax(260px, 1.2fr) minmax(150px, 0.7fr) minmax(170px, 0.8fr) minmax(230px, 1fr); align-items: stretch; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.live-clock { min-width: 0; display: flex; align-items: center; gap: 10px; padding: 10px 12px; }
.clock-icon { width: 34px; height: 34px; flex-shrink: 0; display: grid; place-items: center; border-radius: 6px; color: var(--brand); background: var(--brand-soft); }
.live-clock > div:last-child { min-width: 0; display: grid; gap: 3px; }
.live-clock code { overflow: hidden; color: var(--text-primary); font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 15px; text-overflow: ellipsis; white-space: nowrap; }
.live-clock span { overflow: hidden; color: var(--text-muted); font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.live-value { position: relative; min-width: 0; display: grid; align-content: center; gap: 4px; padding: 9px 32px 9px 12px; border: 0; border-left: 1px solid var(--border-subtle); background: transparent; text-align: left; cursor: pointer; }
.live-value:hover { background: var(--bg-hover); }
.live-value span { color: var(--text-muted); font-size: 10px; }
.live-value code { overflow: hidden; color: var(--brand); font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.live-value > svg { position: absolute; top: 50%; right: 11px; color: var(--text-muted); opacity: 0.55; transform: translateY(-50%); }
.live-value:hover > svg { color: var(--brand); opacity: 1; }
.converter-grid { min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.converter-panel { min-width: 0; min-height: 0; display: flex; flex-direction: column; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); overflow: hidden; }
.panel-head { min-height: 52px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 12px; border-bottom: 1px solid var(--border-subtle); }
.panel-head > div { min-width: 0; display: grid; gap: 2px; }
.panel-head h2 { margin: 0; color: var(--text-primary); font-size: 13px; }
.panel-head span { color: var(--text-muted); font-size: 10px; }
.input-block { flex-shrink: 0; padding: 11px 12px; border-bottom: 1px solid var(--border-subtle); }
.input-block > label { display: block; margin-bottom: 5px; color: var(--text-secondary); font-size: 11px; font-weight: 600; }
.primary-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; }
.mono-input { font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; }
.option-row { min-height: 30px; display: flex; align-items: center; gap: 8px; margin-top: 7px; }
.option-row > span:first-child { flex-shrink: 0; color: var(--text-muted); font-size: 10px; }
.segmented { display: flex; align-items: center; gap: 2px; padding: 2px; border-radius: 5px; background: var(--bg-input); }
.segmented button { min-width: 42px; height: 23px; padding: 0 8px; border: 0; border-radius: 4px; background: transparent; color: var(--text-muted); font-size: 10px; cursor: pointer; }
.segmented button:hover { color: var(--text-primary); background: var(--bg-hover); }
.segmented button.active { color: var(--brand); background: var(--brand-soft); font-weight: 600; }
.segmented button:focus { outline: none; }
.segmented button:focus-visible { box-shadow: inset 0 0 0 1px var(--brand); }
.detected { min-width: 0; overflow: hidden; color: var(--brand) !important; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.error-line { min-height: 24px; display: flex; align-items: center; margin-top: 6px; padding: 0 8px; border-radius: 4px; color: var(--danger); background: var(--danger-soft); font-size: 10px; }
.result-block { flex: 1; min-height: 0; overflow-y: auto; padding: 5px 8px 8px; }
.result-meta { min-height: 34px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-top: 6px; padding: 6px 10px; border-radius: 5px; color: var(--text-muted); background: var(--bg-input); font-size: 10px; }
:deep(.n-button) { height: 28px; font-size: 11px; }
@media (max-width: 960px) {
  .timestamp-tool { overflow-y: auto; display: flex; flex-direction: column; }
  .current-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .live-value:nth-child(3) { border-top: 1px solid var(--border-subtle); }
  .live-value.iso { border-top: 1px solid var(--border-subtle); }
  .converter-grid { grid-template-columns: 1fr; }
  .converter-panel { min-height: 360px; }
}
</style>
