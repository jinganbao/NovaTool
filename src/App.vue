<script setup lang="ts">
import { computed, watch } from "vue";
import { NConfigProvider, NMessageProvider } from "naive-ui";
import AppWorkspace from "@/components/layout/AppWorkspace.vue";
import { getNaiveTheme, getThemeOverrides, getThemeVars } from "@/config/theme";
import { useConfig } from "@/composables/useConfig";
import "@/assets/theme.css";

const config = useConfig();
const naiveTheme = computed(() => getNaiveTheme(config.themeMode));
const themeOverrides = computed(() => getThemeOverrides(config));
const themeVars = computed(() => getThemeVars(config));

watch(themeVars, (vars) => {
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
  document.documentElement.dataset.theme = config.themeMode;
}, { immediate: true });
</script>

<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <AppWorkspace />
    </n-message-provider>
  </n-config-provider>
</template>
