<script setup lang="ts">
import { NModal, NSpace } from "naive-ui";

const show = defineModel<boolean>("show", { required: true });

const shortcuts = [
  ["⌘ K / ⌘ P", "打开工具命令面板"],
  ["↑ / ↓", "在命令面板中移动"],
  ["Enter", "确认当前选择或执行查询"],
  ["⌘ Enter", "执行当前工具操作"],
  ["⌘ L", "清空当前编辑器"],
];
</script>

<template>
  <n-modal v-model:show="show" preset="card" title="快捷键与帮助" class="nova-modal" style="width: 420px">
    <n-space vertical :size="18">
      <section class="help-section">
        <h3>全局操作</h3>
        <div v-for="[key, label] in shortcuts.slice(0, 2)" :key="key" class="help-row">
          <kbd>{{ key }}</kbd><span>{{ label }}</span>
        </div>
      </section>
      <section class="help-section">
        <h3>编辑器操作</h3>
        <div v-for="[key, label] in shortcuts.slice(2)" :key="key" class="help-row">
          <kbd>{{ key }}</kbd><span>{{ label }}</span>
        </div>
      </section>
      <p class="help-note">不同工具会根据功能提供额外的按钮和快捷操作，页面内的图标按钮均支持悬停提示。</p>
    </n-space>
  </n-modal>
</template>

<style scoped>
.help-section { display: grid; gap: 8px; }
.help-section h3 { margin: 0 0 2px; color: var(--text-primary); font-size: 13px; }
.help-row { display: flex; align-items: center; gap: 12px; min-height: 28px; color: var(--text-secondary); font-size: 12px; }
kbd { min-width: 80px; padding: 4px 7px; border: 1px solid var(--border-strong); border-radius: 5px; background: var(--bg-input); color: var(--text-primary); font-family: "SFMono-Regular", Consolas, monospace; font-size: 10px; text-align: center; }
.help-note { margin: 0; color: var(--text-muted); font-size: 11px; line-height: 1.5; }
</style>
