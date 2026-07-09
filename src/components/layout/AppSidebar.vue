<script setup lang="ts">
import { computed, ref } from "vue";
import { ChevronDown, ChevronRight, Hammer, Search, Settings } from "lucide-vue-next";
import { toolGroups } from "@/config/tools";
import type { ToolKey } from "@/types/tools";

const props = defineProps<{ activeTool: ToolKey }>();
const emit = defineEmits<{
  "update:activeTool": [key: ToolKey];
  settings: [];
}>();

const query = ref("");
const collapsedGroups = ref<string[]>([]);

const filteredGroups = computed(() => {
  const keyword = query.value.trim().toLowerCase();
  if (!keyword) return toolGroups;
  return toolGroups
    .map((group) => ({
      ...group,
      tools: group.tools.filter(
        (tool) =>
          tool.title.toLowerCase().includes(keyword) ||
          tool.desc.toLowerCase().includes(keyword) ||
          group.title.toLowerCase().includes(keyword),
      ),
    }))
    .filter((group) => group.tools.length > 0);
});

function toggleGroup(key: string) {
  const index = collapsedGroups.value.indexOf(key);
  if (index >= 0) collapsedGroups.value.splice(index, 1);
  else collapsedGroups.value.push(key);
}
</script>

<template>
  <aside class="sidebar">
    <div class="brand-row">
      <div class="brand-mark"><Hammer :size="22" /></div>
      <div>
        <div class="brand-title">NovaTool</div>
        <div class="brand-subtitle">Developer Toolbox</div>
      </div>
    </div>

    <div class="search-wrap">
      <Search :size="15" />
      <input v-model="query" placeholder="搜索工具" />
    </div>

    <nav class="tool-nav">
      <section v-for="group in filteredGroups" :key="group.key" class="nav-group">
        <button class="group-head" @click="toggleGroup(group.key)">
          <component :is="group.icon" :size="18" />
          <span>{{ group.title }}</span>
          <ChevronRight v-if="collapsedGroups.includes(group.key)" :size="16" />
          <ChevronDown v-else :size="16" />
        </button>
        <div v-if="!collapsedGroups.includes(group.key)" class="tool-list">
          <button
            v-for="tool in group.tools"
            :key="tool.key"
            class="tool-item"
            :class="{ active: props.activeTool === tool.key }"
            @click="emit('update:activeTool', tool.key)"
          >
            <component :is="tool.icon" :size="18" />
            <span>{{ tool.title }}</span>
            <small v-if="tool.status === 'draft'">soon</small>
          </button>
        </div>
      </section>
    </nav>

    <div class="sidebar-footer">
      <button class="settings-button" type="button" @click="emit('settings')">
        <span>
          <Settings :size="15" />
          配置
        </span>
        <i class="settings-accent"></i>
      </button>
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-sider);
  padding: 12px;
}

.brand-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 12px;
}

.brand-mark {
  width: 32px;
  height: 32px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: var(--brand);
  background: var(--brand-soft);
}

.brand-title {
  color: var(--brand);
  font-weight: 700;
  font-size: 15px;
  line-height: 1.1;
}

.brand-subtitle {
  color: var(--text-muted);
  font-size: 11px;
  margin-top: 2px;
}

.search-wrap {
  height: 30px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-muted);
}

.search-wrap input {
  flex: 1;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 12px;
}

.tool-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 10px 0;
}

.nav-group {
  margin-bottom: 6px;
}

.group-head,
.tool-item,
.settings-button {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  cursor: pointer;
  text-align: left;
}

.group-head {
  height: 30px;
  gap: 8px;
  padding: 0 6px;
  font-size: 13px;
  font-weight: 700;
}

.group-head svg:last-child {
  margin-left: auto;
}

.group-head:hover {
  color: var(--text-primary);
}

.tool-list {
  padding: 3px 0 0 20px;
}

.tool-item {
  height: 30px;
  gap: 8px;
  padding: 0 8px;
  border-radius: 5px;
  font-size: 13px;
  margin-bottom: 3px;
}

.tool-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.tool-item.active {
  background: var(--brand-soft);
  color: var(--brand);
}

.tool-item span {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-item small {
  font-size: 10px;
  color: var(--text-muted);
}

.sidebar-footer {
  flex-shrink: 0;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
}

.settings-button {
  height: 30px;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  font-size: 13px;
}

.settings-button:hover {
  color: var(--text-primary);
  background: var(--bg-panel-hover);
}

.settings-button span {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.settings-accent {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--brand);
  box-shadow: 0 0 0 2px var(--brand-soft);
}

@media (max-width: 860px) {
  .sidebar {
    display: none;
  }
}
</style>
