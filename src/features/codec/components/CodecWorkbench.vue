<script setup lang="ts">
import CodeEditor from "@/components/editor/CodeEditor.vue";

defineProps<{
  input: string;
  output: string;
  inputTitle?: string;
  outputTitle?: string;
  inputPlaceholder?: string;
  outputPlaceholder?: string;
}>();

defineEmits<{ "update:input": [value: string] }>();

defineSlots<{
  controls?: () => unknown;
  "input-actions"?: () => unknown;
  "output-actions"?: () => unknown;
  status?: () => unknown;
}>();
</script>

<template>
  <section class="codec-workbench">
    <div class="codec-toolbar">
      <div class="toolbar-controls"><slot name="controls" /></div>
      <div class="toolbar-status"><slot name="status" /></div>
    </div>

    <div class="codec-editors">
      <section class="codec-pane">
        <header>
          <div><h2>{{ inputTitle || "输入" }}</h2><span>{{ input.length }} 字符</span></div>
          <div class="pane-actions"><slot name="input-actions" /></div>
        </header>
        <CodeEditor
          :model-value="input"
          language="plain"
          :placeholder="inputPlaceholder || '输入内容'"
          @update:model-value="$emit('update:input', $event)"
        />
      </section>

      <section class="codec-pane">
        <header>
          <div><h2>{{ outputTitle || "结果" }}</h2><span>{{ output.length }} 字符</span></div>
          <div class="pane-actions"><slot name="output-actions" /></div>
        </header>
        <CodeEditor :model-value="output" language="plain" readonly :placeholder="outputPlaceholder || '转换结果'" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.codec-workbench { flex: 1; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; }
.codec-toolbar { min-height: 38px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 6px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.toolbar-controls, .toolbar-status, .pane-actions { min-width: 0; display: flex; align-items: center; gap: 6px; }
.toolbar-status { color: var(--text-muted); font-size: 10px; }
.codec-editors { min-height: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.codec-pane { min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 10px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.codec-pane header { min-height: 28px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.codec-pane header > div:first-child { display: flex; align-items: baseline; gap: 8px; }
.codec-pane h2 { margin: 0; color: var(--text-primary); font-size: 13px; }
.codec-pane header span { color: var(--text-muted); font-size: 10px; }
:deep(.n-button) { height: 27px; font-size: 11px; }
@media (max-width: 860px) {
  .codec-workbench { overflow-y: auto; }
  .codec-toolbar { align-items: flex-start; flex-direction: column; }
  .codec-editors { grid-template-columns: 1fr; }
  .codec-pane { min-height: 320px; }
}
</style>
