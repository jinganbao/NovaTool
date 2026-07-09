import { reactive, ref, watch } from "vue";

export interface AppConfig {
  themeAccent: string;
  themeMode: "dark" | "light" | "auto";
  defaultTool: string;
  editorFontSize: number;
  autoCheckUpdate: boolean;
}

const STORAGE_KEY = "NovaTool-config";

const defaults: AppConfig = {
  themeAccent: "#3DD6C6",
  themeMode: "dark",
  defaultTool: "json-format",
  editorFontSize: 13,
  autoCheckUpdate: true,
};

function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return { ...defaults, ...JSON.parse(stored) };
  } catch {
    // localStorage 数据损坏时回退到默认值
  }
  return { ...defaults };
}

const config = reactive<AppConfig>(loadConfig());

/* ---- 解析 auto 模式：跟随系统 prefers-color-scheme ---- */
const systemDark = ref(
  typeof window !== "undefined" && window.matchMedia
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : true,
);

if (typeof window !== "undefined" && window.matchMedia) {
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
    systemDark.value = e.matches;
  });
}

export const resolvedThemeMode = ref<"dark" | "light">(
  config.themeMode === "auto" ? (systemDark.value ? "dark" : "light") : config.themeMode,
);

watch(
  () => config.themeMode,
  (mode) => {
    resolvedThemeMode.value =
      mode === "auto" ? (systemDark.value ? "dark" : "light") : mode;
  },
);

watch(systemDark, (dark) => {
  if (config.themeMode === "auto") {
    resolvedThemeMode.value = dark ? "dark" : "light";
  }
});

watch(
  () => ({ ...config }),
  (value) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  },
  { deep: true },
);

export function useConfig() {
  return config;
}
