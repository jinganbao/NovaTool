import { computed, ref, watch } from "vue";
import type { ToolKey } from "@/types/tools";
import { loadJson, saveJson } from "@/utils/storage";

interface HistoryState {
  recent: ToolKey[];
  favorites: ToolKey[];
}

const STORAGE_KEY = "NovaTool-tool-history";

const state = ref<HistoryState>(loadJson(STORAGE_KEY, { recent: [], favorites: [] }));

watch(state, (v) => saveJson(STORAGE_KEY, v), { deep: true });

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
