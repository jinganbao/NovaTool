import { computed, ref, watch } from "vue";
import { allTools } from "@/config/tools";
import type { ToolKey } from "@/types/tools";
import { loadVersionedJson, saveVersionedJson } from "@/utils/storage";

interface HistoryState {
  recent: ToolKey[];
  favorites: ToolKey[];
}

const STORAGE_KEY = "NovaTool-tool-history";
const validToolKeys = new Set<ToolKey>(allTools.map((tool) => tool.key));

const state = ref<HistoryState>(loadVersionedJson(STORAGE_KEY, { recent: [], favorites: [] }, 1, (value) => {
  const raw = value && typeof value === "object" ? value as Partial<HistoryState> : {};
  return {
    recent: Array.isArray(raw.recent)
      ? raw.recent.filter((key): key is ToolKey => typeof key === "string" && validToolKeys.has(key as ToolKey)).slice(0, 10)
      : [],
    favorites: Array.isArray(raw.favorites)
      ? raw.favorites.filter((key): key is ToolKey => typeof key === "string" && validToolKeys.has(key as ToolKey))
      : [],
  };
}));

watch(state, (v) => saveVersionedJson(STORAGE_KEY, v, 1), { deep: true });

export function useToolHistory() {
  function recordUse(key: ToolKey) {
    const recent = state.value.recent.filter((k) => k !== key);
    recent.unshift(key);
    state.value.recent = recent.slice(0, 10);
  }

  function toggleFavorite(key: ToolKey) {
    const idx = state.value.favorites.indexOf(key);
    if (idx >= 0) {
      state.value.favorites.splice(idx, 1);
    } else {
      state.value.favorites.push(key);
    }
  }

  function isFavorite(key: ToolKey) {
    return state.value.favorites.includes(key);
  }

  return {
    recent: computed(() => state.value.recent),
    favorites: computed(() => state.value.favorites),
    recordUse,
    toggleFavorite,
    isFavorite,
  };
}
