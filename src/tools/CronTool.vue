<script setup lang="ts">
import { computed, h, ref } from "vue";
import { NButton, NInput, NSpace, NTag, useMessage } from "naive-ui";
import { Clock, Copy, RefreshCw } from "lucide-vue-next";
import type { Component } from "vue";
import { parseCron, nextRuns, describeCron, FIELD_DOCS, PRESETS } from "@/utils/cron";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 状态 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

const expression = ref("0 9 * * 1-5");
const runCount = ref("10");

/* ---- 计算 ---- */
const parsed = computed(() => parseCron(expression.value));
const isValid = computed(() => parsed.value !== null);
const description = computed(() => (parsed.value ? describeCron(parsed.value) : ""));
const runCountNum = computed(() => Math.max(1, Math.min(100, Number(runCount.value) || 10)));
const nextDates = computed(() => {
  if (!parsed.value) return [];
  try {
    return nextRuns(parsed.value, runCountNum.value);
  } catch {
    return [];
  }
});

/* ---- 工具 ---- */
function renderIcon(icon: Component, size = 14) {
  return h(icon, { size, strokeWidth: 2.1 });
}

function applyPreset(value: string) {
  expression.value = value;
}

function formatDate(d: Date) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  const s = String(d.getSeconds()).padStart(2, "0");
  const week = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][d.getDay()];
  return `${y}-${mo}-${day} ${h}:${mi}:${s} ${week}`;
}

function copyAll() {
  const text = nextDates.value.map((d, i) => `${i + 1}. ${formatDate(d)}`).join("\n");
  void copyText(text);
}
</script>

<template>
  <section class="tool-panel cron-tool">
    <!-- ====== 表达式输入 ====== -->
    <div class="expr-card">
      <div class="card-head">
        <h2>Cron 表达式</h2>
      </div>
      <div class="expr-row">
        <n-input
          v-model:value="expression"
          size="small"
          placeholder="输入 Cron 表达式，如 0 9 * * 1-5"
          class="expr-input"
          :status="expression && !isValid ? 'error' : undefined"
        />
        <span class="show-count">显示</span>
        <n-input
          v-model:value="runCount"
          size="small"
          class="count-input"
          placeholder="10"
        />
        <span class="show-count">次</span>
      </div>
      <div v-if="isValid && description" class="expr-desc">
        <Clock :size="14" />
        <span>{{ description }}</span>
      </div>
      <div v-else-if="expression && !isValid" class="expr-error">表达式格式不正确，请检查</div>
    </div>

    <!-- ====== 常用预设 ====== -->
    <div class="preset-card">
      <div class="card-head">
        <h2>常用示例</h2>
      </div>
      <div class="preset-grid">
        <button
          v-for="p in PRESETS"
          :key="p.value"
          class="preset-chip"
          :class="{ active: expression === p.value }"
          type="button"
          @click="applyPreset(p.value)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <!-- ====== 字段说明 + 下次执行 ====== -->
    <div class="bottom-area">
      <!-- 字段说明 -->
      <div class="fields-card">
        <div class="card-head">
          <h2>字段说明</h2>
        </div>
        <div class="field-list">
          <div v-for="f in FIELD_DOCS" :key="f.name" class="field-row">
            <span class="field-name">{{ f.name }}</span>
            <code class="field-range">{{ f.range }}</code>
            <span class="field-desc">{{ f.desc }}</span>
          </div>
        </div>
      </div>

      <!-- 下次执行 -->
      <div class="runs-card">
        <div class="card-head">
          <h2>下次执行时间</h2>
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" :disabled="nextDates.length === 0" @click="copyAll">复制全部</n-button>
        </div>
        <div v-if="!isValid" class="runs-empty">
          <RefreshCw :size="20" />
          <span>输入合法表达式查看结果</span>
        </div>
        <div v-else class="runs-list">
          <div v-for="(d, i) in nextDates" :key="i" class="run-row">
            <span class="run-num">{{ i + 1 }}</span>
            <code class="run-time">{{ formatDate(d) }}</code>
          </div>
          <div v-if="nextDates.length === 0" class="runs-empty">
            <span>未来 5 年内无匹配</span>
          </div>
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

.cron-tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
}

/* ---- 公共卡片 ---- */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.card-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ---- 表达式输入 ---- */
.expr-card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.expr-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.expr-input {
  flex: 1;
  min-width: 0;
}

.count-input {
  width: 56px;
  flex-shrink: 0;
}

.show-count {
  color: var(--text-muted);
  font-size: 12px;
  flex-shrink: 0;
}

.expr-desc {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 5px;
  background: var(--success);
  background: rgba(74, 222, 128, 0.1);
  color: var(--success);
  font-size: 13px;
}

.expr-error {
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 5px;
  background: var(--danger-soft);
  color: var(--danger);
  font-size: 13px;
}

/* ---- 常用预设 ---- */
.preset-card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.preset-chip {
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  background: var(--bg-input);
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}

.preset-chip:hover {
  border-color: var(--brand);
  color: var(--text-primary);
}

.preset-chip.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
  font-weight: 600;
}

/* ---- 底部双栏 ---- */
.bottom-area {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

/* ---- 字段说明 ---- */
.fields-card {
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.field-list {
  display: grid;
  gap: 6px;
}

.field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 5px;
  background: var(--bg-input);
  font-size: 12px;
}

.field-name {
  width: 36px;
  color: var(--text-secondary);
  font-weight: 600;
}

.field-range {
  width: 48px;
  color: var(--brand);
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
}

.field-desc {
  color: var(--text-muted);
}

/* ---- 下次执行 ---- */
.runs-card {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.runs-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--text-muted);
  font-size: 13px;
}

.runs-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  gap: 4px;
}

.run-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 5px;
  background: var(--bg-input);
}

.run-num {
  width: 20px;
  color: var(--text-muted);
  font-size: 11px;
  text-align: right;
}

.run-time {
  font-size: 12px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  color: var(--text-primary);
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

@media (max-width: 700px) {
  .bottom-area {
    grid-template-columns: 1fr;
  }
}
</style>
