<script setup lang="ts">
import { ref, onMounted } from "vue";
import { NModal, NSpace, NText, NButton, NInputNumber, NProgress, NSelect, NSwitch } from "naive-ui";
import { getVersion } from "@tauri-apps/api/app";
import { Rocket } from "lucide-vue-next";
import { themeModeOptions, themePresets } from "@/config/theme";
import { allTools } from "@/config/tools";
import { useConfig } from "@/composables/useConfig";
import { useAppUpdate } from "@/composables/useAppUpdate";
import { useMessage } from "naive-ui";

const show = defineModel<boolean>("show", { required: true });
const config = useConfig();
const message = useMessage();
const appVersion = ref("...");

onMounted(async () => {
  try {
    appVersion.value = await getVersion();
  } catch {
    appVersion.value = "unknown";
  }
});

const {
  checkingUpdate,
  showUpdateModal,
  updateInfo,
  installingUpdate,
  updateProgressLabel,
  updateProgressPercentage,
  updateTotal,
  checkForUpdates,
  handleUpdateDownload,
} = useAppUpdate(message);

function setThemeMode(mode: "dark" | "light" | "auto") {
  config.themeMode = mode;
}
</script>

<template>
  <!-- ====== 配置弹窗 ====== -->
  <n-modal v-model:show="show" preset="card" title="配置" class="nova-modal" style="max-width: 520px; width: 90vw">
    <n-space vertical :size="16">
      <div class="config-modal-row">
        <n-text class="config-modal-label">主题色</n-text>
        <div class="theme-picker">
          <button
            v-for="preset in themePresets"
            :key="preset.name"
            class="theme-swatch"
            :class="{ active: config.themeAccent.toLowerCase() === preset.color.toLowerCase() }"
            :style="{ '--swatch-color': preset.color }"
            :title="preset.name"
            type="button"
            @click="config.themeAccent = preset.color"
          >
            <span class="theme-swatch-dot"></span>
            <span>{{ preset.name }}</span>
          </button>
        </div>
      </div>

      <div class="config-modal-row">
        <n-text class="config-modal-label">外观模式</n-text>
        <div class="theme-picker">
          <button
            v-for="option in themeModeOptions"
            :key="option.value"
            class="theme-mode-button"
            :class="{ active: config.themeMode === option.value }"
            type="button"
            @click="setThemeMode(option.value)"
          >
            {{ option.label }}
          </button>
        </div>
      </div>

      <div class="config-modal-row">
        <n-text class="config-modal-label">版本更新</n-text>
        <div style="display:flex;align-items:center;gap:8px">
          <n-switch v-model:value="config.autoCheckUpdate" size="small" />
          <span style="font-size:12px;color:var(--text-muted)">启动时自动检查</span>
          <n-button size="small" :loading="checkingUpdate" @click="checkForUpdates()">
            检查更新
          </n-button>
          <span class="version-text">v{{ appVersion }}</span>
        </div>
      </div>

      <div class="config-modal-row">
        <n-text class="config-modal-label">默认工具</n-text>
        <n-select
          v-model:value="config.defaultTool"
          size="small"
          style="width: 200px"
          :options="allTools.map((t) => ({ label: t.title, value: t.key }))"
        />
      </div>

      <div class="config-modal-row">
        <n-text class="config-modal-label">编辑器字号</n-text>
        <n-input-number
          v-model:value="config.editorFontSize"
          size="small"
          style="width: 100px"
          :min="10"
          :max="22"
          :step="1"
        />
      </div>
    </n-space>
  </n-modal>

  <!-- ====== 更新弹窗 ====== -->
  <n-modal v-model:show="showUpdateModal" preset="card" title="版本更新" class="nova-modal" style="width: 420px">
    <n-spin :show="checkingUpdate && !updateInfo">
      <!-- 下载中 -->
      <template v-if="installingUpdate">
        <n-space vertical :size="16">
          <n-text>{{ updateProgressLabel }}</n-text>
          <n-progress
            v-if="updateTotal > 0"
            type="line"
            :percentage="updateProgressPercentage"
            :show-indicator="true"
            :color="'var(--brand)'"
          />
          <n-progress v-else type="line" :show-indicator="false" status="info" processing />
        </n-space>
      </template>

      <!-- 有更新 -->
      <template v-else-if="updateInfo?.hasUpdate">
        <n-space vertical :size="10">
          <n-text>
            发现新版本 <strong>v{{ updateInfo.version }}</strong>（当前 v{{ updateInfo.currentVersion }}）
          </n-text>
          <n-text v-if="updateInfo.date" depth="3">发布日期：{{ updateInfo.date }}</n-text>
          <div v-if="updateInfo.body" class="update-body">
            <n-text depth="3">{{ updateInfo.body }}</n-text>
          </div>
        </n-space>
      </template>

      <!-- 无更新 -->
      <template v-else-if="updateInfo">
        <div style="text-align:center;padding:12px 0">
          <Rocket :size="32" style="color:var(--brand);margin-bottom:8px" />
          <n-text>当前已是最新版本</n-text>
        </div>
      </template>

      <!-- 检查中 -->
      <template v-else>
        <n-text depth="3">正在检查更新...</n-text>
      </template>
    </n-spin>

    <template #footer>
      <n-space justify="end">
        <template v-if="installingUpdate">
          <n-button @click="showUpdateModal = false">后台下载</n-button>
        </template>
        <template v-else>
          <n-button @click="showUpdateModal = false">关闭</n-button>
          <n-button v-if="updateInfo?.hasUpdate" type="primary" @click="handleUpdateDownload">
            下载并安装
          </n-button>
        </template>
      </n-space>
    </template>
  </n-modal>
</template>

<style scoped>
/* ---- 弹窗统一外观 ---- */
:deep(.nova-modal) {
  border-radius: 12px;
  box-shadow: var(--shadow-lg);
}

.config-modal-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.config-modal-label {
  width: 100px;
  font-size: 13px;
  flex-shrink: 0;
}

.theme-picker {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.theme-swatch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 9px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
}

.theme-swatch:hover,
.theme-swatch.active {
  border-color: var(--swatch-color);
  color: var(--text-primary);
  background: var(--bg-panel-hover);
}

.theme-swatch.active {
  box-shadow: 0 0 0 2px var(--brand-soft);
}

.theme-swatch-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--swatch-color);
  box-shadow: 0 0 0 2px var(--swatch-ring);
}

.theme-mode-button {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg-input);
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 12px;
}

.theme-mode-button:hover,
.theme-mode-button.active {
  border-color: var(--brand);
  color: var(--text-primary);
  background: var(--brand-soft);
}

.version-text {
  color: var(--text-muted);
  font-size: 12px;
  font-family: "SFMono-Regular", Consolas, monospace;
}

.update-body {
  max-height: 120px;
  overflow-y: auto;
  white-space: pre-wrap;
  padding: 8px;
  border-radius: 5px;
  background: var(--bg-input);
}
</style>
