<script setup lang="ts">
import { computed, ref } from "vue";
import { Settings } from "lucide-vue-next";
import { NPopover, NTooltip } from "naive-ui";
import appIcon from "@/assets/app-icon.png";
import { toolGroups } from "@/config/tools";
import type { ToolKey } from "@/types/tools";

const props = defineProps<{ activeTool: ToolKey }>();
const emit = defineEmits<{
  "update:active-tool": [key: ToolKey];
  settings: [];
}>();

const isMac = ref(typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent));
const openGroup = ref<string | null>(null);
const activeGroupKey = computed(
  () => toolGroups.find((group) => group.tools.some((tool) => tool.key === props.activeTool))?.key,
);

function setGroupOpen(groupKey: string, show: boolean) {
  openGroup.value = show ? groupKey : null;
}

function selectTool(key: ToolKey) {
  emit("update:active-tool", key);
  openGroup.value = null;
}
</script>

<template>
  <aside class="icon-bar" :class="{ mac: isMac }">
    <div class="brand-mark" title="NovaTool">
      <img :src="appIcon" alt="" />
    </div>

    <nav class="group-nav" aria-label="工具分类">
      <n-popover
        v-for="group in toolGroups"
        :key="group.key"
        trigger="click"
        placement="right-start"
        :show-arrow="false"
        :show="openGroup === group.key"
        raw
        @update:show="setGroupOpen(group.key, $event)"
      >
        <template #trigger>
          <n-tooltip
            placement="right"
            :show-arrow="false"
            :disabled="openGroup === group.key"
          >
            <template #trigger>
              <button
                class="rail-btn"
                :class="{ active: activeGroupKey === group.key }"
                type="button"
                :aria-label="group.title"
                :aria-expanded="openGroup === group.key"
              >
                <component :is="group.icon" :size="18" stroke-width="2" />
              </button>
            </template>
            {{ group.title }}
          </n-tooltip>
        </template>

        <div class="tool-menu" role="menu" :aria-label="group.title">
          <div class="tool-menu-title">{{ group.title }}</div>
          <button
            v-for="tool in group.tools"
            :key="tool.key"
            class="tool-menu-item"
            :class="{ active: activeTool === tool.key }"
            type="button"
            role="menuitem"
            @click="selectTool(tool.key)"
          >
            <component :is="tool.icon" :size="16" />
            <span class="tool-menu-copy">
              <strong>{{ tool.title }}</strong>
              <small>{{ tool.desc }}</small>
            </span>
          </button>
        </div>
      </n-popover>
    </nav>

    <div class="rail-footer">
      <n-tooltip placement="right" :show-arrow="false">
        <template #trigger>
          <button class="rail-btn" type="button" aria-label="设置" @click="emit('settings')">
            <Settings :size="18" />
          </button>
        </template>
        设置
      </n-tooltip>
    </div>
  </aside>
</template>

<style scoped>
.icon-bar {
  width: 56px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-sider);
  z-index: 10;
}

.icon-bar.mac {
  padding-top: 40px;
}

.brand-mark {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 9px;
  overflow: hidden;
  box-shadow: 0 3px 10px var(--shadow-strong);
}

.brand-mark img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.group-nav {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding-top: 8px;
}

.rail-footer {
  width: 100%;
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding-top: 10px;
  border-top: 1px solid var(--border-subtle);
}

.rail-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
}

.rail-btn:hover,
.rail-btn[aria-expanded="true"] {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.rail-btn.active {
  color: var(--brand);
  background: var(--brand-soft);
}

.rail-btn.active::before {
  content: "";
  position: absolute;
  left: -10px;
  width: 3px;
  height: 18px;
  border-radius: 0 3px 3px 0;
  background: var(--brand);
}

.tool-menu {
  width: 260px;
  padding: 6px;
  border: 1px solid var(--border-strong);
  border-radius: 7px;
  background: var(--bg-panel);
  box-shadow: var(--shadow-lg);
}

.tool-menu-title {
  padding: 6px 8px 8px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
}

.tool-menu-item {
  width: 100%;
  min-height: 42px;
  display: grid;
  grid-template-columns: 20px minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 0;
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  text-align: left;
  cursor: pointer;
}

.tool-menu-item:hover,
.tool-menu-item.active {
  background: var(--brand-soft);
  color: var(--brand);
}

.tool-menu-copy {
  min-width: 0;
  display: grid;
  gap: 2px;
}

.tool-menu-copy strong {
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
}

.tool-menu-copy small {
  overflow: hidden;
  color: var(--text-muted);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
