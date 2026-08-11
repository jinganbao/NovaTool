<script setup lang="ts">
import { NInputNumber, NModal, NSelect, NSpace, NSwitch, NText } from "naive-ui";
import { themeModeOptions, themePresets } from "@/config/theme";
import { allTools } from "@/config/tools";
import { useConfig } from "@/composables/useConfig";

const show = defineModel<boolean>("show", { required: true });

const config = useConfig();

function setThemeMode(mode: "dark" | "light" | "auto") {
  config.themeMode = mode;
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

</style>
