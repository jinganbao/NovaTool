<script setup lang="ts">
import { computed, h, ref, watch, defineAsyncComponent, type Component } from "vue";
import { Loader2 } from "lucide-vue-next";
import { allTools } from "@/config/tools";
import { getThemeVars } from "@/config/theme";
import { useConfig, resolvedThemeMode } from "@/composables/useConfig";
import type { ToolItem, ToolKey } from "@/types/tools";
import AppIconBar from "@/components/layout/AppIconBar.vue";
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

const currentTool = computed<ToolItem>(() =>
  allTools.find((tool) => tool.key === activeTool.value) ?? allTools[0],
);
const themeVars = computed(() => getThemeVars(config, resolvedThemeMode.value));
const activeComponent = computed(() => toolComponents[activeTool.value]);

const errorBoundaryRef = ref<InstanceType<typeof ErrorBoundary> | null>(null);

function selectTool(key: ToolKey) {
  activeTool.value = key;
  recordUse(key);
}

// 切换工具时重置错误边界，避免上一个工具的错误遮挡新工具
watch(activeTool, () => {
  errorBoundaryRef.value?.reset();
});
</script>

<template>
  <div class="app-shell" :style="themeVars">
    <AppIconBar
      :active-tool="activeTool"
      @update:active-tool="selectTool"
      @settings="showSettings = true"
    />

    <main class="workspace">
      <WorkspaceHeader
        :tool="currentTool"
        @command="showPalette = true"
        @settings="showSettings = true"
      />

      <ErrorBoundary ref="errorBoundaryRef">
        <KeepAlive>
          <component
            :is="activeComponent"
            :key="activeTool"
            v-if="activeComponent"
            class="tool-panel"
          />
        </KeepAlive>
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
  grid-template-columns: 56px minmax(0, 1fr);
  background: var(--bg-app);
  color: var(--text-primary);
  overflow: hidden;
}

.workspace {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace :deep(.tool-panel) {
  padding: 12px;
  flex: 1;
  min-height: 0;
}

/* 异步加载动画 */
:deep(.async-loading) {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-muted);
  font-size: 13px;
}

:deep(.async-spinner) {
  animation: async-spin 0.9s linear infinite;
  color: var(--brand);
}

@keyframes async-spin {
  to {
    transform: rotate(360deg);
  }
}

:deep(.async-loading-text) {
  color: var(--text-muted);
}
</style>
