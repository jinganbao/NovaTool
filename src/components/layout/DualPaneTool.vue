<script setup lang="ts">
/**
 * 双栏工具容器：左右对称面板 + 共享样式
 * 插槽：left-title / left-actions / left | right-title / right-actions / right
 */
defineSlots<{
  "left-title"?: () => unknown;
  "left-actions"?: () => unknown;
  "left"?: () => unknown;
  "right-title"?: () => unknown;
  "right-actions"?: () => unknown;
  "right"?: () => unknown;
}>();
</script>

<template>
  <section class="tool-panel split-panel">
    <div class="editor-pane">
      <div class="pane-head">
        <h2><slot name="left-title" /></h2>
        <div class="pane-actions"><slot name="left-actions" /></div>
      </div>
      <slot name="left" />
    </div>

    <div class="editor-pane">
      <div class="pane-head">
        <h2><slot name="right-title" /></h2>
        <div class="pane-actions"><slot name="right-actions" /></div>
      </div>
      <slot name="right" />
    </div>
  </section>
</template>

<style scoped>
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.split-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

.editor-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.pane-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.pane-head h2 {
  margin: 0;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 700;
  white-space: nowrap;
}

.pane-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.pane-head :deep(.n-button) {
  min-width: 58px;
}

@media (max-width: 860px) {
  .split-panel {
    grid-template-columns: 1fr;
  }
}
</style>
