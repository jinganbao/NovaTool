import { reactive, ref, watch } from "vue";
import { allTools } from "@/config/tools";

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

function normalizeConfig(value: unknown): AppConfig {
  if (!value || typeof value !== "object") return { ...defaults };
  const stored = value as Partial<AppConfig>;
  const validTools = new Set<string>(allTools.map((tool) => tool.key));
  const themeMode = stored.themeMode === "light" || stored.themeMode === "dark" || stored.themeMode === "auto"
    ? stored.themeMode
    : defaults.themeMode;
  const themeAccent = typeof stored.themeAccent === "string" && /^#[0-9a-f]{6}$/i.test(stored.themeAccent)
    ? stored.themeAccent
    : defaults.themeAccent;
  const editorFontSize = typeof stored.editorFontSize === "number" && Number.isFinite(stored.editorFontSize)
    ? Math.min(22, Math.max(10, Math.round(stored.editorFontSize)))
    : defaults.editorFontSize;

  return {
    themeAccent,
    themeMode,
    defaultTool: typeof stored.defaultTool === "string" && validTools.has(stored.defaultTool)
      ? stored.defaultTool
      : defaults.defaultTool,
    editorFontSize,
    autoCheckUpdate: typeof stored.autoCheckUpdate === "boolean"
      ? stored.autoCheckUpdate
      : defaults.autoCheckUpdate,
  };
}

function loadConfig(): AppConfig {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeConfig(JSON.parse(stored));
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
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      console.warn("[config] 配置保存失败，可能已超出本地存储配额");
    }
  },
  { deep: true },
);

export function useConfig() {
  return config;
}
