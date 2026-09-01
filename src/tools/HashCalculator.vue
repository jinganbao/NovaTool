<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NCheckbox, useMessage } from "naive-ui";
import { Copy, Eraser, Hash } from "lucide-vue-next";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import { computeTextHashes, HASH_ALGORITHMS, utf8ByteLength } from "@/features/hash/hashService";
import type { HashAlgorithm } from "@/features/hash/hashService";
import { useClipboard } from "@/composables/useClipboard";
import { renderIcon } from "@/utils/render";
import ToolState from "@/components/common/ToolState.vue";

const message = useMessage();
const { copyText } = useClipboard(message);
const input = ref("Hello, NovaTool!");
const selected = ref<HashAlgorithm[]>(["md5", "sha256"]);
const uppercase = ref(false);
const computing = ref(false);
const results = ref<Map<HashAlgorithm, string>>(new Map());
const byteLength = computed(() => utf8ByteLength(input.value));

function toggleAlgorithm(algorithm: HashAlgorithm, checked: boolean) {
  if (checked) selected.value = [...new Set([...selected.value, algorithm])];
  else if (selected.value.length > 1) selected.value = selected.value.filter((item) => item !== algorithm);
}

async function calculate() {
  computing.value = true;
  try {
    results.value = await computeTextHashes(input.value, selected.value);
  } catch (error) {
    message.error("计算失败：" + (error instanceof Error ? error.message : String(error)));
  } finally {
    computing.value = false;
  }
}

function displayValue(algorithm: HashAlgorithm): string {
  const value = results.value.get(algorithm) || "";
  return uppercase.value ? value.toUpperCase() : value;
}

function clearAll() {
  input.value = "";
  results.value = new Map();
}
</script>

<template>
  <section class="hash-workbench">
    <div class="hash-toolbar">
      <span class="toolbar-label">算法</span>
      <label v-for="algorithm in HASH_ALGORITHMS" :key="algorithm.key" class="algo-option">
        <input
          type="checkbox"
          :checked="selected.includes(algorithm.key)"
          @change="toggleAlgorithm(algorithm.key, ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ algorithm.label }}</span>
      </label>
      <span class="toolbar-divider" />
      <n-checkbox v-model:checked="uppercase" size="small">大写输出</n-checkbox>
      <n-button size="small" type="primary" :loading="computing" :render-icon="() => renderIcon(Hash)" @click="calculate">计算</n-button>
    </div>

    <div class="hash-main">
      <section class="input-pane">
        <header>
          <div><h2>原始内容</h2><span>UTF-8 · {{ input.length }} 字符 · {{ byteLength }} 字节</span></div>
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="clearAll">清空</n-button>
        </header>
        <CodeEditor v-model="input" language="plain" placeholder="输入需要计算摘要的文本，空文本同样有效" />
      </section>

      <section class="results-pane">
        <header><div><h2>摘要结果</h2><span>由 hash-wasm WebAssembly 计算</span></div></header>
        <div class="hash-results">
          <ToolState v-if="!results.size" title="暂无摘要结果" detail="选择算法后点击计算" />
          <div v-for="algorithm in HASH_ALGORITHMS.filter((item) => selected.includes(item.key))" :key="algorithm.key" class="hash-row">
            <div class="algo-meta"><strong>{{ algorithm.label }}</strong><span>{{ algorithm.bits }} bit</span></div>
            <code :class="{ empty: !results.has(algorithm.key) }">{{ displayValue(algorithm.key) || "尚未计算" }}</code>
            <n-button
              size="tiny"
              quaternary
              :aria-label="`复制 ${algorithm.label}`"
              :disabled="!results.has(algorithm.key)"
              :render-icon="() => renderIcon(Copy)"
              @click="copyText(displayValue(algorithm.key))"
            />
          </div>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.hash-workbench { flex: 1; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; }
.hash-toolbar { min-height: 38px; display: flex; align-items: center; gap: 6px; padding: 4px 7px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.toolbar-label { margin-right: 2px; color: var(--text-muted); font-size: 10px; }
.algo-option { height: 25px; display: flex; align-items: center; gap: 5px; padding: 0 8px; border-radius: 4px; color: var(--text-secondary); background: var(--bg-input); font-size: 10px; cursor: pointer; }
.algo-option:hover { color: var(--text-primary); background: var(--bg-hover); }
.algo-option input { accent-color: var(--brand); }
.toolbar-divider { width: 1px; height: 18px; margin: 0 3px; background: var(--border-subtle); }
:deep(.n-checkbox__label) { color: var(--text-secondary); font-size: 10px; }
.hash-toolbar :deep(.n-button) { margin-left: auto; }
.hash-main { min-height: 0; display: grid; grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr); gap: 10px; }
.input-pane, .results-pane { min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 10px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.input-pane header, .results-pane header { min-height: 30px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; margin-bottom: 7px; }
.input-pane header > div, .results-pane header > div { display: flex; align-items: baseline; gap: 8px; }
h2 { margin: 0; color: var(--text-primary); font-size: 13px; }
header span { color: var(--text-muted); font-size: 10px; }
.hash-results { min-height: 0; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: 5px; }
.hash-row { min-height: 68px; display: grid; grid-template-columns: 74px minmax(0, 1fr) 28px; align-items: center; gap: 9px; padding: 7px 6px 7px 10px; border-bottom: 1px solid var(--border-subtle); }
.hash-row:last-child { border-bottom: 0; }
.hash-row:hover { background: var(--bg-hover); }
.algo-meta { display: grid; gap: 3px; }
.algo-meta strong { color: var(--brand); font-size: 11px; }
.algo-meta span { color: var(--text-muted); font-size: 9px; }
.hash-row code { min-width: 0; overflow-wrap: anywhere; color: var(--text-primary); font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace; font-size: 11px; line-height: 1.45; user-select: all; }
.hash-row code.empty { color: var(--text-muted); }
:deep(.n-button) { height: 27px; font-size: 11px; }
@media (max-width: 900px) {
  .hash-workbench { overflow-y: auto; }
  .hash-toolbar { flex-wrap: wrap; }
  .hash-toolbar :deep(.n-button) { margin-left: 0; }
  .hash-main { grid-template-columns: 1fr; }
  .input-pane, .results-pane { min-height: 320px; }
}
</style>
