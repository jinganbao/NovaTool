<script setup lang="ts">
import { NTag } from "naive-ui";
import type { ToolItem } from "@/types/tools";

defineProps<{ tool: ToolItem }>();
</script>

<template>
  <header class="workspace-head">
    <div class="title-block">
      <div class="tool-icon">
        <component :is="tool.icon" :size="16" />
      </div>
      <h1>{{ tool.title }}</h1>
      <p>{{ tool.desc }}</p>
    </div>
    <div class="head-actions">
      <n-tag :bordered="false" type="success" size="small">
        {{ tool.status === "ready" ? "可用" : "设计中" }}
      </n-tag>
    </div>
  </header>
</template>

<style scoped>
.workspace-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  min-height: 48px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-panel);
}

.title-block {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.tool-icon {
  width: 26px;
  height: 26px;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  display: grid;
  place-items: center;
  color: var(--brand);
  background: var(--bg-input);
}

h1,
p {
  margin: 0;
}

h1 {
  color: var(--text-primary);
  font-size: 14px;
  line-height: 1.2;
  font-weight: 700;
  white-space: nowrap;
}

.title-block p {
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

@media (max-width: 860px) {
  .workspace-head {
    align-items: center;
  }

  h1 {
    font-size: 14px;
  }
}
</style>
