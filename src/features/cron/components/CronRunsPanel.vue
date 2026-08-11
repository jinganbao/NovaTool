<script setup lang="ts">
import { NButton } from "naive-ui";
import { Copy, RefreshCw } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";

defineProps<{ dates: Date[]; valid: boolean }>();
defineEmits<{ copy: [] }>();

function formatDate(date: Date) {
  const parts = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ];
  const time = [date.getHours(), date.getMinutes(), date.getSeconds()].map((value) => String(value).padStart(2, "0"));
  const weekday = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][date.getDay()];
  return `${parts.join("-")} ${time.join(":")} ${weekday}`;
}
</script>

<template>
  <section class="runs-panel">
    <header>
      <div>
        <h2>最近运行时间</h2>
        <span>按当前系统时区计算</span>
      </div>
      <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" :disabled="dates.length === 0" @click="$emit('copy')">复制</n-button>
    </header>
    <div v-if="!valid" class="empty"><RefreshCw :size="18" /><span>修正表达式后查看结果</span></div>
    <div v-else-if="dates.length === 0" class="empty"><span>未找到未来运行时间</span></div>
    <div v-else class="runs-list">
      <div v-for="(date, index) in dates" :key="date.getTime()" class="run-row">
        <span>{{ String(index + 1).padStart(2, "0") }}</span>
        <code>{{ formatDate(date) }}</code>
      </div>
    </div>
  </section>
</template>

<style scoped>
.runs-panel { min-height: 0; display: flex; flex-direction: column; border-left: 1px solid var(--border-subtle); padding-left: 14px; }
header { display: flex; align-items: center; justify-content: space-between; min-height: 34px; margin-bottom: 8px; }
header > div { display: flex; align-items: baseline; gap: 8px; }
h2 { margin: 0; color: var(--text-primary); font-size: 13px; }
header span { color: var(--text-muted); font-size: 11px; }
.runs-list { min-height: 0; overflow-y: auto; display: grid; align-content: start; gap: 3px; }
.run-row { min-height: 28px; display: grid; grid-template-columns: 24px minmax(0, 1fr); align-items: center; padding: 0 8px; border-radius: 4px; background: var(--bg-input); }
.run-row > span { color: var(--text-muted); font-size: 10px; }
.run-row code { color: var(--text-primary); font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 11px; }
.empty { flex: 1; min-height: 120px; display: grid; place-content: center; justify-items: center; gap: 6px; color: var(--text-muted); font-size: 12px; }
</style>
