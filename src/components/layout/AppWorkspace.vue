<script setup lang="ts">
import { computed, h, ref, defineAsyncComponent, type Component } from "vue";
import { Menu, Loader2 } from "lucide-vue-next";
import { allTools } from "@/config/tools";
import { getThemeVars } from "@/config/theme";
import { useConfig, resolvedThemeMode } from "@/composables/useConfig";
import type { ToolItem, ToolKey } from "@/types/tools";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import CommandPalette from "@/components/layout/CommandPalette.vue";
import ErrorBoundary from "@/components/layout/ErrorBoundary.vue";
import SettingsModal from "@/components/layout/SettingsModal.vue";
import WorkspaceHeader from "@/components/layout/WorkspaceHeader.vue";
import { useToolHistory } from "@/composables/useToolHistory";

/* ---- 异步加载工具组件，减少首屏包体积 ---- */
const asyncOptions = {
  loadingComponent: {
    setup() {
      return () =>
        h("div", { class: "async-loading" }, [
          h(Loader2, { size: 20, class: "async-spinner" }),
          h("span", { class: "async-loading-text" }, "加载中..."),
        ]);
    },
  },
};

const toolComponents: Partial<Record<ToolKey, Component>> = {
  "json-format": defineAsyncComponent({ loader: () => import("@/tools/JsonFormatter.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "xml-format": defineAsyncComponent({ loader: () => import("@/tools/XmlFormatter.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "text-diff": defineAsyncComponent({ loader: () => import("@/tools/TextDiff.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "regex": defineAsyncComponent({ loader: () => import("@/tools/RegexTester.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "tcp-client": defineAsyncComponent({ loader: () => import("@/tools/TcpClient.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "tcp-server": defineAsyncComponent({ loader: () => import("@/tools/TcpServer.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "port-check": defineAsyncComponent({ loader: () => import("@/tools/PortChecker.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "timestamp": defineAsyncComponent({ loader: () => import("@/tools/TimestampConverter.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "url-codec": defineAsyncComponent({ loader: () => import("@/tools/UrlCodec.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "hash": defineAsyncComponent({ loader: () => import("@/tools/HashCalculator.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "base64": defineAsyncComponent({ loader: () => import("@/tools/Base64Codec.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "radix": defineAsyncComponent({ loader: () => import("@/tools/RadixConverter.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "cron": defineAsyncComponent({ loader: () => import("@/tools/CronTool.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "password": defineAsyncComponent({ loader: () => import("@/tools/PasswordGenerator.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "qrcode": defineAsyncComponent({ loader: () => import("@/tools/QRCodeGenerator.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "uuid": defineAsyncComponent({ loader: () => import("@/tools/UUIDGenerator.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
};

const config = useConfig();
const { recordUse } = useToolHistory();

const activeTool = ref<ToolKey>((config.defaultTool as ToolKey) || "json-format");
const showSettings = ref(false);
const showPalette = ref(false);
const mobileNavOpen = ref(false);

const currentTool = computed<ToolItem>(() =>
  allTools.find((tool) => tool.key === activeTool.value) ?? allTools[0],
);
const themeVars = computed(() => getThemeVars(config, resolvedThemeMode.value));
const activeComponent = computed(() => toolComponents[activeTool.value]);

function selectTool(key: ToolKey) {
  activeTool.value = key;
  recordUse(key);
  mobileNavOpen.value = false;
}
</script>

<template>
  <div class="app-shell" :style="themeVars">
    <!-- 小屏导航触发器 -->
    <button class="mobile-nav-toggle" aria-label="打开工具菜单" @click="mobileNavOpen = true">
      <Menu :size="20" />
    </button>

    <!-- 小屏遮罩 -->
    <div v-if="mobileNavOpen" class="mobile-nav-overlay" @click="mobileNavOpen = false" />

    <AppSidebar
      :class="{ 'mobile-open': mobileNavOpen }"
      :active-tool="activeTool"
      @update:active-tool="selectTool"
      @settings="showSettings = true; mobileNavOpen = false"
    />

    <main class="workspace">
      <WorkspaceHeader :tool="currentTool" />
      <ErrorBoundary>
        <component :is="activeComponent" v-if="activeComponent" class="tool-panel" />
      </ErrorBoundary>
    </main>

    <SettingsModal v-model:show="showSettings" />
    <CommandPalette v-model:open="showPalette" @select="selectTool" @settings="showSettings = true" />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  min-width: 960px;
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  background: var(--bg-app);
  color: var(--text-primary);
  overflow: hidden;
}

.workspace {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
}

.workspace :deep(.tool-panel) {
  padding: 12px;
}

/* 异步组件加载状态 */
.workspace :deep(.async-loading) {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

.workspace :deep(.async-spinner) {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.workspace :deep(.async-loading-text) {
  color: var(--text-muted);
}

.mobile-nav-toggle {
  display: none;
}

@media (max-width: 1160px) {
  .app-shell {
    grid-template-columns: 224px minmax(0, 1fr);
    min-width: 760px;
  }
}

@media (max-width: 860px) {
  .app-shell {
    grid-template-columns: 1fr;
    min-width: 0;
  }

  .workspace {
    padding: 0;
  }

  .mobile-nav-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    position: fixed;
    top: 8px;
    left: 8px;
    z-index: 200;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border-strong);
    border-radius: 6px;
    background: var(--bg-panel);
    color: var(--text-primary);
    cursor: pointer;
  }

  .mobile-nav-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: var(--overlay, rgba(0, 0, 0, 0.4));
  }
}
</style>
