<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Search, CornerDownLeft, Star } from "lucide-vue-next";
import { allTools } from "@/config/tools";
import type { ToolKey } from "@/types/tools";
import { useToolHistory } from "@/composables/useToolHistory";

const emit = defineEmits<{
  (e: "select", key: ToolKey): void;
  (e: "close"): void;
}>();

const { recent, favorites, toggleFavorite, isFavorite } = useToolHistory();
const open = defineModel<boolean>("open", { required: true });
const query = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const activeIndex = ref(0);
// 打开前焦点元素：关闭时归还，保证键盘导航不被打断
let lastFocused: HTMLElement | null = null;

const results = computed(() => {
  const q = query.value.trim().toLowerCase();
  if (!q) {
    // 无搜索时：收藏 + 最近使用 + 所有工具
    const favTools = favorites.value.map((key) => allTools.find((t) => t.key === key)).filter(Boolean);
    const recentTools = recent.value
      .filter((key) => !favorites.value.includes(key))
      .map((key) => allTools.find((t) => t.key === key))
      .filter(Boolean);
    const others = allTools.filter(
      (t) => !favorites.value.includes(t.key) && !recent.value.includes(t.key),
    );
    return [
      ...favTools.map((t) => ({ ...t!, section: "收藏" })),
      ...recentTools.map((t) => ({ ...t!, section: "最近使用" })),
      ...others.map((t) => ({ ...t, section: "全部工具" })),
    ];
  }
  return allTools
    .filter((t) => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q) || t.key.includes(q))
    .map((t) => ({ ...t, section: "搜索结果" }));
});

const sections = computed(() => {
  const map = new Map<string, typeof results.value>();
  for (const item of results.value) {
    const sec = map.get(item.section) ?? [];
    sec.push(item);
    map.set(item.section, sec);
  }
  return [...map.entries()];
});

function selectItem(index: number) {
  const flat = results.value;
  if (index >= 0 && index < flat.length) {
    const tool = flat[index];
    emit("select", tool.key);
    query.value = "";
    open.value = false;
  }
}

function onKeydown(e: KeyboardEvent) {
  const flat = results.value;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex.value = Math.min(activeIndex.value + 1, flat.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex.value = Math.max(activeIndex.value - 1, 0);
  } else if (e.key === "Enter") {
    e.preventDefault();
    selectItem(activeIndex.value);
  }
}

function onOpen() {
  lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  query.value = "";
  activeIndex.value = 0;
  nextTick(() => inputRef.value?.focus());
}

function onClose() {
  // 归还焦点到打开前的位置
  nextTick(() => {
    lastFocused?.focus();
    lastFocused = null;
  });
}

/* ---- 焦点圈定：Tab 循环在对话框内，防止焦点逃逸到背景 ---- */
function trapFocus(e: KeyboardEvent) {
  if (e.key !== "Tab") return;
  const focusables = dialogRef.value?.querySelectorAll<HTMLElement>(
    'button, input, [href], [tabindex]:not([tabindex="-1"])',
  );
  if (!focusables || focusables.length === 0) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const active = document.activeElement;
  if (active && !dialogRef.value?.contains(active)) {
    e.preventDefault();
    first.focus();
  } else if (e.shiftKey && active === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && active === last) {
    e.preventDefault();
    first.focus();
  }
}

watch(open, (v) => {
  if (v) onOpen();
  else onClose();
});

/* ---- 全局快捷键 Ctrl+K / Ctrl+P ---- */
function onGlobalKeydown(e: KeyboardEvent) {
  if ((e.key === "k" || e.key === "p") && (e.metaKey || e.ctrlKey)) {
    e.preventDefault();
    open.value = !open.value;
  }
  if (e.key === "Escape" && open.value) {
    open.value = false;
  }
}

onMounted(() => document.addEventListener("keydown", onGlobalKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onGlobalKeydown));

function getFlatIndex(sectionIdx: number, itemIdx: number) {
  let index = 0;
  for (let s = 0; s < sectionIdx; s++) {
    index += sections.value[s][1].length;
  }
  return index + itemIdx;
}
</script>

<template>
  <div v-if="open" class="palette-overlay" @click="open = false">
    <div
      ref="dialogRef"
      class="palette-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="工具命令面板"
      @click.stop
      @keydown="trapFocus"
    >
      <div class="palette-accent" />
      <div class="palette-search">
        <Search :size="15" class="search-icon" />
        <input
          ref="inputRef"
          v-model="query"
          placeholder="搜索工具..."
          aria-label="搜索工具"
          @keydown="onKeydown"
        />
        <kbd class="palette-hint">
          <CornerDownLeft :size="11" /> 选择
        </kbd>
      </div>
      <div class="palette-list">
        <template v-for="([sectionName, items], secIdx) in sections" :key="sectionName">
          <div class="palette-section-label">{{ sectionName }}</div>
          <div
            v-for="(item, itemIdx) in items"
            :key="item.key"
            class="palette-item"
            :class="{ active: activeIndex === getFlatIndex(secIdx, itemIdx) }"
          >
            <button class="palette-item-main" type="button" @click="selectItem(getFlatIndex(secIdx, itemIdx))">
              <component :is="item.icon" :size="16" />
              <span class="palette-item-title">{{ item.title }}</span>
              <span class="palette-item-desc">{{ item.desc }}</span>
            </button>
            <button
              class="favorite-btn"
              :class="{ selected: isFavorite(item.key) }"
              type="button"
              :aria-label="isFavorite(item.key) ? `取消收藏 ${item.title}` : `收藏 ${item.title}`"
              :title="isFavorite(item.key) ? '取消收藏' : '收藏'"
              @click="toggleFavorite(item.key)"
            >
              <Star :size="14" :fill="isFavorite(item.key) ? 'currentColor' : 'none'" />
            </button>
          </div>
        </template>
        <div v-if="results.length === 0" class="palette-empty">
          未找到匹配的工具
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.palette-overlay {
  position: fixed;
  inset: 0;
  z-index: 500;
  background: var(--overlay, rgba(0, 0, 0, 0.45));
  display: flex;
  justify-content: center;
  padding-top: 15vh;
  animation: palette-fade 0.15s ease;
}

.palette-dialog {
  width: 480px;
  max-width: 92vw;
  max-height: 60vh;
  border: 1px solid var(--border-strong);
  border-radius: 12px;
  background: var(--bg-panel);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  animation: palette-pop 0.18s cubic-bezier(0.2, 0.9, 0.3, 1.2);
  align-self: flex-start;
}

@keyframes palette-fade {
  from {
    opacity: 0;
  }
}

@keyframes palette-pop {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.98);
  }
}

/* 顶部品牌渐变细线 */
.palette-accent {
  height: 2px;
  background: var(--brand-gradient);
  flex-shrink: 0;
}

.palette-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--border-subtle);
}

.search-icon {
  color: var(--text-muted);
  flex-shrink: 0;
  transition: color 0.15s;
}

.palette-search:focus-within .search-icon {
  color: var(--brand);
}

.palette-search input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
  min-width: 0;
}

.palette-search input::placeholder {
  color: var(--text-muted);
}

.palette-hint {
  display: flex;
  align-items: center;
  gap: 3px;
  padding: 2px 6px;
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  background: var(--bg-input);
  color: var(--text-muted);
  font-size: 10px;
  font-family: inherit;
  flex-shrink: 0;
}

.palette-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.palette-section-label {
  padding: 8px 10px 3px;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.palette-item {
  display: flex;
  align-items: center;
  width: 100%;
  border-radius: 6px;
  background: none;
}

.palette-item.active,
.palette-item:hover {
  background: var(--brand-soft);
}

.palette-item-main {
  min-width: 0;
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 6px 8px 10px;
  border: 0;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
}

.palette-item.active .palette-item-main > svg {
  color: var(--brand);
}

.favorite-btn {
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.favorite-btn:hover,
.favorite-btn.selected {
  color: var(--brand);
}

.palette-item-title {
  font-weight: 600;
  white-space: nowrap;
}

.palette-item-desc {
  color: var(--text-muted);
  font-size: 12px;
  margin-left: auto;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 180px;
}

.palette-empty {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
  font-size: 13px;
}
</style>
