<script setup lang="ts">
import { computed, ref } from "vue";
import { Moon, Search, Settings, Sun } from "lucide-vue-next";
import { NTooltip } from "naive-ui";
import type { ToolItem } from "@/types/tools";
import { useConfig, resolvedThemeMode } from "@/composables/useConfig";

defineProps<{ tool: ToolItem }>();
const emit = defineEmits<{
  command: [];
  settings: [];
}>();

const config = useConfig();

const isDark = computed(() => resolvedThemeMode.value === "dark");
// macOS Overlay 标题栏：红绿灯悬浮在左上角，内容需要避让
const isMac = ref(typeof navigator !== "undefined" && /Mac/i.test(navigator.userAgent));

function toggleTheme() {
  config.themeMode = isDark.value ? "light" : "dark";
}

/* ---- 手动窗口拖拽：比 data-tauri-drag-region 更可靠（子元素不会拦截） ---- */
async function onDragStart(e: MouseEvent) {
  if (e.button !== 0) return;
  const target = e.target as HTMLElement;
  // 可交互元素不触发拖拽
  if (target.closest("button, input, a, [data-no-drag]")) return;
  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().startDragging();
  } catch {
    // 非 Tauri 环境（纯浏览器调试）忽略
  }
}
</script>

<template>
  <header class="top-bar" :class="{ mac: isMac }" @mousedown="onDragStart">
    <!-- 左：工具信息（空白区域可拖拽） -->
    <div class="title-block">
      <div class="tool-icon">
        <component :is="tool.icon" :size="15" stroke-width="2.2" />
      </div>
      <h1>{{ tool.title }}</h1>
      <span class="tool-desc">{{ tool.desc }}</span>
    </div>

    <!-- 右：全局操作 -->
    <div class="head-actions">
      <n-tooltip placement="bottom" :show-arrow="false">
        <template #trigger>
          <button class="action-btn search-btn" type="button" @click="emit('command')">
            <Search :size="13" />
            <span>搜索工具</span>
            <kbd>⌘K</kbd>
          </button>
        </template>
        命令面板
      </n-tooltip>

      <n-tooltip placement="bottom" :show-arrow="false">
        <template #trigger>
          <button class="action-btn icon-only" type="button" :aria-label="isDark ? '切换亮色' : '切换暗色'" @click="toggleTheme">
            <Sun v-if="isDark" :size="15" />
            <Moon v-else :size="15" />
          </button>
        </template>
        {{ isDark ? "切换亮色" : "切换暗色" }}
      </n-tooltip>

      <n-tooltip placement="bottom" :show-arrow="false">
        <template #trigger>
          <button class="action-btn icon-only" type="button" aria-label="配置" @click="emit('settings')">
            <Settings :size="15" />
          </button>
        </template>
        配置
      </n-tooltip>
    </div>
  </header>
</template>

<style scoped>
.top-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  height: 48px;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-panel);
  z-index: 5;
}

/* macOS Overlay：红绿灯区域避让 */
.top-bar.mac {
  padding-left: 78px;
}

/* ---- 工具信息 ---- */
.title-block {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 10px;
}

.tool-icon {
  width: 28px;
  height: 28px;
  border-radius: 7px;
  display: grid;
  place-items: center;
  color: var(--brand);
  background: var(--brand-soft);
  flex-shrink: 0;
}

h1 {
  margin: 0;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.tool-desc {
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
}

/* ---- 操作区 ---- */
.head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.action-btn {
  height: 30px;
  border: 1px solid var(--border-subtle);
  border-radius: 7px;
  background: var(--bg-input);
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 0 10px;
  font-size: 12px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, background-color 0.15s;
}

.action-btn:hover {
  border-color: var(--border-strong);
  color: var(--text-primary);
  background: var(--bg-panel-hover);
}

.action-btn.icon-only {
  width: 30px;
  padding: 0;
}

.search-btn kbd {
  font-family: inherit;
  font-size: 10px;
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  padding: 1px 4px;
  background: var(--bg-panel);
}

@media (max-width: 700px) {
  .tool-desc {
    display: none;
  }

  .search-btn span {
    display: none;
  }

  .search-btn kbd {
    display: none;
  }
}
</style>
