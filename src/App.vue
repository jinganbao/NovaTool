<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, watch } from "vue";
import { NConfigProvider, NMessageProvider } from "naive-ui";
import AppWorkspace from "@/components/layout/AppWorkspace.vue";
import { getNaiveTheme, getThemeOverrides, getThemeVars } from "@/config/theme";
import { useConfig, resolvedThemeMode } from "@/composables/useConfig";
import "@/assets/theme.css";

const config = useConfig();
const naiveTheme = computed(() => getNaiveTheme(resolvedThemeMode.value));
const themeOverrides = computed(() => getThemeOverrides(config, resolvedThemeMode.value));
const themeVars = computed(() => getThemeVars(config, resolvedThemeMode.value));

function disableDefaultContextMenu(event: MouseEvent) {
  const target = event.target as HTMLElement | null;
  if (target?.closest("[data-custom-context-menu]")) return;
  event.preventDefault();
}

onMounted(() => window.addEventListener("contextmenu", disableDefaultContextMenu, true));
onBeforeUnmount(() => window.removeEventListener("contextmenu", disableDefaultContextMenu, true));

watch(themeVars, (vars) => {
  for (const [key, value] of Object.entries(vars)) {
    document.documentElement.style.setProperty(key, value);
  }
  document.documentElement.dataset.theme = resolvedThemeMode.value;
}, { immediate: true });
</script>

<template>
  <n-config-provider :theme="naiveTheme" :theme-overrides="themeOverrides">
    <n-message-provider>
      <AppWorkspace />
    </n-message-provider>
  </n-config-provider>
</template>
