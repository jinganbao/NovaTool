<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from "vue";
import { NButton, NInput, NSelect, useMessage } from "naive-ui";
import { Copy, RefreshCw } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 工具函数 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

function pad(n: number, width = 2) {
  return String(n).padStart(width, "0");
}

function formatLocal(d: Date) {
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  return `${y}-${mo}-${day} ${h}:${mi}:${s}`;
}

function formatUTC(d: Date) {
  const y = d.getUTCFullYear();
  const mo = pad(d.getUTCMonth() + 1);
  const day = pad(d.getUTCDate());
  const h = pad(d.getUTCHours());
  const mi = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());
  return `${y}-${mo}-${day}T${h}:${mi}:${s}Z`;
}

function formatISO(d: Date) {
  const y = d.getFullYear();
  const mo = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const h = pad(d.getHours());
  const mi = pad(d.getMinutes());
  const s = pad(d.getSeconds());
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absOff = Math.abs(offset);
  const offH = pad(Math.floor(absOff / 60));
  const offM = pad(absOff % 60);
  return `${y}-${mo}-${day}T${h}:${mi}:${s}${sign}${offH}:${offM}`;
}

function weekDay(d: Date) {
  return ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][d.getDay()];
}

function dayOfYear(d: Date) {
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d.getTime() - start.getTime();
  return Math.floor(diff / 86400000);
}

function detectUnit(ts: number): "s" | "ms" {
  // > 10000000000 大约是 2286 年的秒级时间戳，之后都是毫秒
  return ts > 10_000_000_000 ? "ms" : "s";
}

/* ---- 当前时间（每秒刷新） ---- */
const now = ref(new Date());

const nowSec = computed(() => Math.floor(now.value.getTime() / 1000));
const nowMs = computed(() => now.value.getTime());

const timer = setInterval(() => {
  now.value = new Date();
}, 1000);

onBeforeUnmount(() => clearInterval(timer));

const localDisplay = computed(() => formatLocal(now.value));
const utcDisplay = computed(() => formatUTC(now.value));
const isoDisplay = computed(() => formatISO(now.value));

/* ---- 时间戳 → 日期 ---- */
const tsInput = ref("");
const tsUnit = ref<"auto" | "s" | "ms">("auto");
const tsDate = ref<Date | null>(null);

function convertTsToDate() {
  const raw = tsInput.value.trim();
  if (!raw) {
    message.warning("请输入时间戳");
    return;
  }
  const num = Number(raw);
  if (!Number.isInteger(num) || num < 0) {
    message.warning("请输入合法的时间戳（非负整数）");
    return;
  }
  let ms: number;
  if (tsUnit.value === "auto") {
    ms = detectUnit(num) === "ms" ? num : num * 1000;
  } else {
    ms = tsUnit.value === "ms" ? num : num * 1000;
  }
  tsDate.value = new Date(ms);
}

/* ---- 日期 → 时间戳 ---- */
const dateInput = ref("");
const timeInput = ref("");
const dtSec = ref<number | null>(null);
const dtMs = ref<number | null>(null);

function initDateTimeNow() {
  const n = new Date();
  dateInput.value = `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  timeInput.value = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
}

initDateTimeNow();

function convertDateToTs() {
  const dateStr = dateInput.value.trim();
  const timeStr = timeInput.value.trim();
  if (!dateStr || !timeStr) {
    message.warning("请填写日期和时间");
    return;
  }
  const iso = `${dateStr}T${timeStr}`;
  const d = new Date(iso);
  if (isNaN(d.getTime())) {
    message.warning("日期或时间格式不正确");
    return;
  }
  dtSec.value = Math.floor(d.getTime() / 1000);
  dtMs.value = d.getTime();
}

/* ---- 快捷操作 ---- */
function useNowForTs() {
  tsInput.value = String(nowSec.value);
  tsUnit.value = "s";
  convertTsToDate();
}

function useNowForDate() {
  initDateTimeNow();
  dtSec.value = null;
  dtMs.value = null;
}
</script>

<template>
  <section class="tool-panel timestamp-tool">
    <!-- ====== 卡片 1：当前时间 ====== -->
    <div class="card">
      <div class="card-head">
        <span class="card-title">当前时间</span>
        <span class="card-sub">实时刷新</span>
      </div>
      <div class="output-grid">
        <div class="output-row">
          <span class="output-label">本地时间</span>
          <code class="output-value">{{ localDisplay }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(localDisplay)" />
        </div>
        <div class="output-row">
          <span class="output-label">秒级时间戳</span>
          <code class="output-value">{{ nowSec }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(String(nowSec))" />
        </div>
        <div class="output-row">
          <span class="output-label">毫秒时间戳</span>
          <code class="output-value">{{ nowMs }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(String(nowMs))" />
        </div>
        <div class="output-row">
          <span class="output-label">UTC</span>
          <code class="output-value">{{ utcDisplay }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(utcDisplay)" />
        </div>
        <div class="output-row">
          <span class="output-label">ISO 8601</span>
          <code class="output-value">{{ isoDisplay }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(isoDisplay)" />
        </div>
      </div>
    </div>

    <!-- ====== 卡片 2：时间戳 → 日期 ====== -->
    <div class="card">
      <div class="card-head">
        <span class="card-title">时间戳 → 日期</span>
        <n-button size="tiny" quaternary :render-icon="() => renderIcon(RefreshCw)" @click="useNowForTs">填入当前</n-button>
      </div>
      <div class="convert-row">
        <n-input
          v-model:value="tsInput"
          size="small"
          placeholder="输入时间戳，如 1702345678"
          class="ts-input"
          @keyup.enter="convertTsToDate"
        />
        <n-select
          v-model:value="tsUnit"
          size="small"
          :options="[
            { label: '自动', value: 'auto' },
            { label: '秒', value: 's' },
            { label: '毫秒', value: 'ms' },
          ]"
          class="unit-select"
        />
        <n-button size="small" type="primary" @click="convertTsToDate">转换</n-button>
      </div>
      <div v-if="tsDate" class="output-grid">
        <div class="output-row">
          <span class="output-label">本地时间</span>
          <code class="output-value">{{ formatLocal(tsDate) }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(formatLocal(tsDate))" />
        </div>
        <div class="output-row">
          <span class="output-label">UTC</span>
          <code class="output-value">{{ formatUTC(tsDate) }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(formatUTC(tsDate))" />
        </div>
        <div class="output-row">
          <span class="output-label">ISO 8601</span>
          <code class="output-value">{{ formatISO(tsDate) }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(formatISO(tsDate))" />
        </div>
        <div class="output-row">
          <span class="output-label">星期</span>
          <code class="output-value">{{ weekDay(tsDate) }}</code>
        </div>
        <div class="output-row">
          <span class="output-label">年内天数</span>
          <code class="output-value">第 {{ dayOfYear(tsDate) }} 天</code>
        </div>
      </div>
    </div>

    <!-- ====== 卡片 3：日期 → 时间戳 ====== -->
    <div class="card">
      <div class="card-head">
        <span class="card-title">日期 → 时间戳</span>
        <n-button size="tiny" quaternary :render-icon="() => renderIcon(RefreshCw)" @click="useNowForDate">重置为当前</n-button>
      </div>
      <div class="convert-row">
        <n-input v-model:value="dateInput" size="small" placeholder="2024-12-12" class="date-input" />
        <n-input v-model:value="timeInput" size="small" placeholder="10:01:18" class="time-input" @keyup.enter="convertDateToTs" />
        <n-button size="small" type="primary" @click="convertDateToTs">转换</n-button>
      </div>
      <div v-if="dtSec !== null" class="output-grid">
        <div class="output-row">
          <span class="output-label">秒级时间戳</span>
          <code class="output-value">{{ dtSec }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(String(dtSec))" />
        </div>
        <div class="output-row">
          <span class="output-label">毫秒时间戳</span>
          <code class="output-value">{{ dtMs }}</code>
          <n-button size="tiny" quaternary :render-icon="() => renderIcon(Copy)" @click="copyText(String(dtMs))" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.timestamp-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

/* ---- 卡片 ---- */
.card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.card-sub {
  font-size: 11px;
  color: var(--text-muted);
}

/* ---- 转换行 ---- */
.convert-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.ts-input {
  flex: 1;
  min-width: 180px;
}

.unit-select {
  width: 90px;
  flex-shrink: 0;
}

.date-input {
  width: 140px;
  flex-shrink: 0;
}

.time-input {
  width: 110px;
  flex-shrink: 0;
}

/* ---- 输出网格 ---- */
.output-grid {
  display: grid;
  gap: 6px;
}

.output-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 5px;
  background: var(--bg-input);
  padding: 6px 10px;
}

.output-label {
  width: 90px;
  flex-shrink: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.output-value {
  flex: 1;
  min-width: 0;
  color: var(--brand);
  font-size: 13px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

/* ---- 响应式 ---- */
@media (max-width: 600px) {
  .output-label {
    width: 70px;
    font-size: 11px;
  }

  .ts-input {
    min-width: 0;
  }

  .date-input,
  .time-input {
    width: auto;
    flex: 1;
    min-width: 100px;
  }
}
</style>
