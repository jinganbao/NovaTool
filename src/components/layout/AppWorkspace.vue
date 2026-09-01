<script setup lang="ts">
import { computed, h, onBeforeUnmount, onMounted, ref, watch, defineAsyncComponent, type Component } from "vue";
import { Loader2 } from "lucide-vue-next";
import { useMessage } from "naive-ui";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { allTools } from "@/config/tools";
import { getThemeVars } from "@/config/theme";
import { useConfig, resolvedThemeMode } from "@/composables/useConfig";
import { useAppUpdate } from "@/composables/useAppUpdate";
import type { ToolItem, ToolKey } from "@/types/tools";
import AboutModal from "@/components/layout/AboutModal.vue";
import AppIconBar from "@/components/layout/AppIconBar.vue";
import CommandPalette from "@/components/layout/CommandPalette.vue";
import ErrorBoundary from "@/components/layout/ErrorBoundary.vue";
import HelpModal from "@/components/layout/HelpModal.vue";
import SettingsModal from "@/components/layout/SettingsModal.vue";
import UpdateModal from "@/components/layout/UpdateModal.vue";
import WorkspaceHeader from "@/components/layout/WorkspaceHeader.vue";
import { useToolHistory } from "@/composables/useToolHistory";
import { loadVersionedJson, saveVersionedJson } from "@/utils/storage";

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
  "data-query": defineAsyncComponent({ loader: () => import("@/tools/DataQuery.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "http-client": defineAsyncComponent({ loader: () => import("@/tools/HttpClient.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
  "udp-client": defineAsyncComponent({ loader: () => import("@/tools/UdpClient.vue"), ...asyncOptions, errorComponent: ErrorBoundary }),
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
const message = useMessage();

/* ---- 更新机制（统一入口：设置弹窗按钮 / 系统菜单「检查更新」/ 启动自动检查）---- */
const {
  checkingUpdate,
  showUpdateModal,
  updateInfo,
  updateError,
  installingUpdate,
  updateDownloaded,
  updateTotal,
  updateProgressLabel,
  updateProgressPercentage,
  checkForUpdates,
  handleUpdateDownload,
} = useAppUpdate(message);

/* ---- 系统菜单事件（Rust 菜单栏 → 前端）---- */
const showAboutModal = ref(false);
let unlistenMenu: UnlistenFn | null = null;

onMounted(async () => {
  if (!isTauri()) return;
  // 菜单「检查更新…」/「关于 NovaTool…」
  unlistenMenu = await listen("novatool-check-update", () => {
    void checkForUpdates();
  });
  const unlistenAbout = await listen("novatool-about", () => {
    showAboutModal.value = true;
  });
  const unlistenAll = [unlistenMenu, unlistenAbout];
  unlistenMenu = () => {
    for (const fn of unlistenAll) fn?.();
  };

  // 启动时静默自动检查（失败静默，不打扰用户）
  if (config.autoCheckUpdate) {
    void checkForUpdates({ silent: true });
  }
});

onBeforeUnmount(() => {
  unlistenMenu?.();
});

const workspaceState = loadVersionedJson("NovaTool-workspace", { activeTool: "" }, 1, (value) => {
  const stored = value && typeof value === "object" ? value as { activeTool?: unknown } : {};
  return { activeTool: typeof stored.activeTool === "string" ? stored.activeTool : "" };
});
const rememberedTool = allTools.some((tool) => tool.key === workspaceState.activeTool)
  ? workspaceState.activeTool as ToolKey
  : null;
const activeTool = ref<ToolKey>(rememberedTool ?? (config.defaultTool as ToolKey) ?? "json-format");
const showSettings = ref(false);
const showPalette = ref(false);
const showHelp = ref(false);

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

watch(activeTool, (key) => {
  saveVersionedJson("NovaTool-workspace", { activeTool: key }, 1);
});

// 切换工具时重置错误边界，避免上一个工具的错误遮挡新工具
watch(activeTool, () => {
  errorBoundaryRef.value?.reset();
});
</script>

<template>
  <div class="app-shell" :style="themeVars">
    <WorkspaceHeader
      class="workspace-header"
      :tool="currentTool"
      @command="showPalette = true"
      @help="showHelp = true"
    />

    <AppIconBar
      class="workspace-rail"
      :active-tool="activeTool"
      @update:active-tool="selectTool"
      @settings="showSettings = true"
    />

    <main class="workspace">
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
    <HelpModal v-model:show="showHelp" />
    <UpdateModal
      v-model:show="showUpdateModal"
      :checking="checkingUpdate"
      :installing="installingUpdate"
      :info="updateInfo"
      :error="updateError"
      :downloaded="updateDownloaded"
      :total="updateTotal"
      :progress-label="updateProgressLabel"
      :progress-percentage="updateProgressPercentage"
      @download="handleUpdateDownload"
      @retry="checkForUpdates()"
    />
    <AboutModal v-model:show="showAboutModal" />
    <CommandPalette v-model:open="showPalette" @select="selectTool" />
  </div>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  min-width: 960px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  grid-template-columns: 56px minmax(0, 1fr);
  background: var(--bg-app);
  color: var(--text-primary);
  overflow: hidden;
}

.workspace-header {
  grid-column: 1 / -1;
  grid-row: 1;
}

.workspace-rail {
  grid-column: 1;
  grid-row: 2;
}

.workspace {
  grid-column: 2;
  grid-row: 2;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.workspace :deep(.tool-panel) {
  padding: 12px 14px 14px;
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
