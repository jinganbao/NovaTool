<script setup lang="ts">
import { FolderSearch } from "lucide-vue-next";
import type { ToolItem } from "@/types/tools";

defineProps<{ tool: ToolItem }>();
</script>

<template>
  <section class="tool-panel empty-tool">
    <FolderSearch :size="44" />
    <h2>{{ tool.title }}</h2>
    <p>这个工具已经进入导航体系，后续可以按同一套面板结构接入具体实现。</p>
  </section>
</template>

<style scoped>
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.empty-tool {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 10px;
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-panel);
}

.empty-tool h2 {
  margin: 0;
  color: var(--text-primary);
  font-size: 20px;
}

.empty-tool p {
  margin: 0;
  max-width: 360px;
  text-align: center;
  line-height: 1.7;
}
</style>
