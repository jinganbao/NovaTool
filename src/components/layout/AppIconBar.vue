<script setup lang="ts">
import { Hammer } from "lucide-vue-next";
import { NTooltip } from "naive-ui";
import { toolGroups } from "@/config/tools";
import type { ToolKey } from "@/types/tools";
import { ref } from "vue";

defineProps<{ activeTool: ToolKey }>();
const emit = defineEmits<{
  "update:active-tool": [key: ToolKey];
}>();

// macOS Overlay 标题栏：红绿灯覆盖图标栏顶部
const isMac = ref(typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent));
</script>

<template>
  <aside class="icon-bar" :class="{ mac: isMac }">
    <!-- 品牌 -->
    <div class="brand-mark" title="NovaTool">
      <Hammer :size="20" stroke-width="2.2" />
    </div>

    <!-- 工具图标 -->
    <nav class="icon-nav" aria-label="工具">
      <template v-for="group in toolGroups" :key="group.key">
        <div v-if="group.tools.length > 0" class="group-sep" />
        <n-tooltip
          v-for="tool in group.tools"
          :key="tool.key"
          placement="right"
          :show-arrow="false"
        >
          <template #trigger>
            <button
              class="icon-btn"
              :class="{ active: activeTool === tool.key }"
              :aria-label="tool.title"
              :aria-current="activeTool === tool.key ? 'page' : undefined"
              type="button"
              @click="emit('update:active-tool', tool.key)"
            >
              <component :is="tool.icon" :size="18" stroke-width="2" />
              <span v-if="tool.status === 'draft'" class="draft-dot" />
            </button>
          </template>
          <span class="tooltip-label">
            {{ tool.title }}
            <small v-if="tool.status === 'draft'">设计中</small>
          </span>
        </n-tooltip>
      </template>
    </nav>
  </aside>
</template>

<style scoped>
.icon-bar {
  width: 56px;
  flex-shrink: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0;
  border-right: 1px solid var(--border-subtle);
  background: var(--bg-sider);
  gap: 8px;
  z-index: 10;
}

/* macOS Overlay：红绿灯区域避让，品牌 Logo 下移 */
.icon-bar.mac {
  padding-top: 40px;
}

/* ---- 品牌 ---- */
.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  color: #fff;
  background: var(--brand-gradient);
  box-shadow: 0 2px 8px var(--shadow-strong);
  margin-bottom: 4px;
}

/* ---- 导航 ---- */
.icon-nav {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 4px 0;
  scrollbar-width: none;
}

.icon-nav::-webkit-scrollbar {
  display: none;
}

.group-sep {
  width: 24px;
  height: 1px;
  background: var(--border-subtle);
  margin: 6px 0;
  flex-shrink: 0;
}

/* ---- 图标按钮 ---- */
.icon-btn {
  position: relative;
  width: 38px;
  height: 38px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-secondary);
  display: grid;
  place-items: center;
  cursor: pointer;
  flex-shrink: 0;
  transition: background-color 0.15s, color 0.15s, transform 0.1s;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn:active {
  transform: scale(0.92);
}

.icon-btn.active {
  background: var(--brand-soft);
  color: var(--brand);
  box-shadow: inset 0 0 0 1px var(--brand-soft);
}

/* 激活指示条 */
.icon-btn.active::before {
  content: "";
  position: absolute;
  left: -9px;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 18px;
  border-radius: 0 3px 3px 0;
  background: var(--brand);
}

/* ---- draft 标识 ---- */
.draft-dot {
  position: absolute;
  top: 5px;
  right: 5px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--warning);
  border: 1px solid var(--bg-sider);
}

/* ---- tooltip ---- */
.tooltip-label {
  font-size: 12px;
}

.tooltip-label small {
  color: var(--text-muted);
  margin-left: 4px;
}
</style>
