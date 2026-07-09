import { reactive, watch } from "vue";

export interface AppConfig {
  themeAccent: string;
  themeMode: "dark" | "light";
}

const STORAGE_KEY = "NovaTool-config";

const defaults: AppConfig = {
  themeAccent: "#3DD6C6",
  themeMode: "dark",
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
