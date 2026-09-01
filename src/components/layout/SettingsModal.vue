<script setup lang="ts">
import { ref } from "vue";
import { NButton, NInputNumber, NModal, NSelect, NSpace, NSwitch, NText, useMessage } from "naive-ui";
import { Download, RotateCcw, Upload } from "lucide-vue-next";
import { themeModeOptions, themePresets } from "@/config/theme";
import { allTools } from "@/config/tools";
import { normalizeConfig, useConfig } from "@/composables/useConfig";
import { renderIcon } from "@/utils/render";

const show = defineModel<boolean>("show", { required: true });

const config = useConfig();
const message = useMessage();
const importInput = ref<HTMLInputElement | null>(null);

function setThemeMode(mode: "dark" | "light" | "auto") {
  config.themeMode = mode;
}

function exportSettings() {
  const storage: Record<string, unknown> = {};
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key?.startsWith("NovaTool-")) continue;
    try {
      storage[key] = JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      storage[key] = localStorage.getItem(key);
    }
  }
  const blob = new Blob([JSON.stringify({ version: 2, config: { ...config }, storage }, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "novatool-settings.json";
  anchor.click();
  URL.revokeObjectURL(url);
  message.success("配置已导出");
}

async function importSettings(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  try {
    const data = JSON.parse(await file.text()) as { config?: unknown; storage?: Record<string, unknown> };
    Object.assign(config, normalizeConfig(data.config ?? data));
    for (const [key, value] of Object.entries(data.storage ?? {})) {
      if (key.startsWith("NovaTool-")) localStorage.setItem(key, JSON.stringify(value));
    }
    message.success("配置已导入");
  } catch {
    message.error("配置文件无效");
  }
}

function resetSettings() {
  config.resetConfig();
  message.success("已恢复默认设置");
}
</script>

<template>
  <n-modal v-model:show="show" preset="card" title="设置" class="nova-modal" style="max-width: 520px; width: 90vw">
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

      <div class="config-modal-row">
        <n-text class="config-modal-label">自动更新</n-text>
        <n-switch v-model:value="config.autoCheckUpdate" size="small" />
        <n-text depth="3" class="config-modal-hint">启动时静默检查新版本</n-text>
      </div>

      <div class="config-modal-row settings-actions">
        <n-text class="config-modal-label">配置管理</n-text>
        <n-space :size="8">
          <n-button size="small" secondary :render-icon="() => renderIcon(Upload)" @click="importInput?.click()">导入</n-button>
          <n-button size="small" secondary :render-icon="() => renderIcon(Download)" @click="exportSettings">导出</n-button>
          <n-button size="small" quaternary :render-icon="() => renderIcon(RotateCcw)" @click="resetSettings">恢复默认</n-button>
        </n-space>
        <input ref="importInput" class="settings-file-input" type="file" accept="application/json" @change="importSettings" />
      </div>
    </n-space>
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

.config-modal-hint {
  font-size: 12px;
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

.settings-actions {
  align-items: flex-start;
}

.settings-file-input {
  display: none;
}

</style>
