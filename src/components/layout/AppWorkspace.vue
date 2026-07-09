<script setup lang="ts">
import { computed, ref } from "vue";
import { allTools } from "@/config/tools";
import { getThemeVars } from "@/config/theme";
import { useConfig } from "@/composables/useConfig";
import type { ToolItem, ToolKey } from "@/types/tools";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import SettingsModal from "@/components/layout/SettingsModal.vue";
import WorkspaceHeader from "@/components/layout/WorkspaceHeader.vue";
import Base64Codec from "@/tools/Base64Codec.vue";
import CronTool from "@/tools/CronTool.vue";
import HashCalculator from "@/tools/HashCalculator.vue";
import JsonFormatter from "@/tools/JsonFormatter.vue";
import PasswordGenerator from "@/tools/PasswordGenerator.vue";
import PlaceholderTool from "@/tools/PlaceholderTool.vue";
import PortChecker from "@/tools/PortChecker.vue";
import QRCodeGenerator from "@/tools/QRCodeGenerator.vue";
import RadixConverter from "@/tools/RadixConverter.vue";
import RegexTester from "@/tools/RegexTester.vue";
import TextDiff from "@/tools/TextDiff.vue";
import TimestampConverter from "@/tools/TimestampConverter.vue";
import TcpClient from "@/tools/TcpClient.vue";
import TcpServer from "@/tools/TcpServer.vue";
import UrlCodec from "@/tools/UrlCodec.vue";
import UUIDGenerator from "@/tools/UUIDGenerator.vue";
import XmlFormatter from "@/tools/XmlFormatter.vue";

const activeTool = ref<ToolKey>("json-format");
const showSettings = ref(false);
const config = useConfig();

const currentTool = computed<ToolItem>(() =>
  allTools.find((tool) => tool.key === activeTool.value) ?? allTools[0],
);
const themeVars = computed(() => getThemeVars(config));
</script>

<template>
  <div class="app-shell" :style="themeVars">
    <AppSidebar v-model:active-tool="activeTool" @settings="showSettings = true" />

    <main class="workspace">
      <WorkspaceHeader :tool="currentTool" />
      <KeepAlive>
        <JsonFormatter v-if="activeTool === 'json-format'" />
        <XmlFormatter v-else-if="activeTool === 'xml-format'" />
        <TextDiff v-else-if="activeTool === 'text-diff'" />
        <RegexTester v-else-if="activeTool === 'regex'" />
        <TcpClient v-else-if="activeTool === 'tcp-client'" />
        <TcpServer v-else-if="activeTool === 'tcp-server'" />
        <PortChecker v-else-if="activeTool === 'port-check'" />
        <TimestampConverter v-else-if="activeTool === 'timestamp'" />
        <UrlCodec v-else-if="activeTool === 'url-codec'" />
        <HashCalculator v-else-if="activeTool === 'hash'" />
        <Base64Codec v-else-if="activeTool === 'base64'" />
        <RadixConverter v-else-if="activeTool === 'radix'" />
        <CronTool v-else-if="activeTool === 'cron'" />
        <PasswordGenerator v-else-if="activeTool === 'password'" />
        <QRCodeGenerator v-else-if="activeTool === 'qrcode'" />
        <UUIDGenerator v-else-if="activeTool === 'uuid'" />
        <PlaceholderTool v-else :tool="currentTool" />
      </KeepAlive>
    </main>

    <SettingsModal v-model:show="showSettings" />
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
}
</style>
