<script setup lang="ts">
import { ref } from "vue";
import { NButton, NSpace, useMessage } from "naive-ui";
import { Copy, Eraser, Hash } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import { useClipboard } from "@/composables/useClipboard";
import { md5, sm3, sha1, sha256, sha512 } from "@/utils/hash";

/* ---- 算法定义 ---- */
type AlgoKey = "md5" | "sha1" | "sha256" | "sha512" | "sm3";

interface AlgoDef {
  key: AlgoKey;
  label: string;
  compute: (input: string) => Promise<string> | string;
}

const algos: AlgoDef[] = [
  { key: "md5", label: "MD5", compute: (s) => md5(s) },
  { key: "sha1", label: "SHA-1", compute: sha1 },
  { key: "sha256", label: "SHA-256", compute: sha256 },
  { key: "sha512", label: "SHA-512", compute: sha512 },
  { key: "sm3", label: "SM3", compute: (s) => sm3(s) },
];

/* ---- 状态 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

const input = ref("Hello, NovaTool!");
const selectedAlgos = ref<Set<AlgoKey>>(new Set(["md5", "sha256"]));
const computing = ref(false);
const results = ref<Map<AlgoKey, string>>(new Map());

/* ---- 工具 ---- */
function toggleAlgo(key: AlgoKey) {
  const next = new Set(selectedAlgos.value);
  if (next.has(key)) {
    if (next.size > 1) next.delete(key);
  } else {
    next.add(key);
  }
  selectedAlgos.value = next;
}

async function computeHashes() {
  const text = input.value;
  if (!text.trim()) {
    message.warning("请输入内容");
    return;
  }
  computing.value = true;
  const newResults = new Map<AlgoKey, string>();
  const tasks = algos
    .filter((a) => selectedAlgos.value.has(a.key))
    .map(async (a) => {
      const val = await a.compute(text);
      newResults.set(a.key, val);
    });
  try {
    await Promise.all(tasks);
    results.value = newResults;
  } catch (err) {
    message.error("计算失败：" + (err instanceof Error ? err.message : String(err)));
  } finally {
    computing.value = false;
  }
}

function clearAll() {
  input.value = "";
  results.value = new Map();
}
</script>

<template>
  <section class="tool-panel hash-tool">
    <!-- ====== 输入区 ====== -->
    <div class="input-section">
      <div class="section-head">
        <h2>原始内容</h2>
        <n-space :size="6">
          <n-button size="tiny" type="primary" :loading="computing" :render-icon="() => renderIcon(Hash)" @click="computeHashes"
            >计算哈希</n-button
          >
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="clearAll">清空</n-button>
        </n-space>
      </div>
      <CodeEditor v-model="input" language="plain" placeholder="输入要计算哈希的文本…" />
    </div>

    <!-- ====== 算法选择 ====== -->
    <div class="algo-bar">
      <span class="algo-label">算法</span>
      <button
        v-for="algo in algos"
        :key="algo.key"
        class="algo-chip"
        :class="{ active: selectedAlgos.has(algo.key) }"
        type="button"
        @click="toggleAlgo(algo.key)"
      >
        {{ algo.label }}
      </button>
    </div>

    <!-- ====== 结果区 ====== -->
    <div class="results-section">
      <div class="section-head">
        <h2>计算结果</h2>
      </div>
      <div v-if="results.size === 0" class="results-empty">
        <Hash :size="24" />
        <span>选择算法，点击「计算哈希」查看结果</span>
      </div>
      <div v-else class="results-grid">
        <div
          v-for="algo in algos.filter((a) => results.has(a.key))"
          :key="algo.key"
          class="result-row"
        >
          <span class="result-label">{{ algo.label }}</span>
          <code class="result-value">{{ results.get(algo.key) }}</code>
          <n-button
            size="tiny"
            quaternary
            :render-icon="() => renderIcon(Copy)"
            @click="copyText(results.get(algo.key)!)"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.hash-tool {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

/* ---- 输入区 ---- */
.input-section {
  flex: 0 0 40%;
  min-height: 160px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.section-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.section-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ---- 算法选择条 ---- */
.algo-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.algo-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  margin-right: 4px;
}

.algo-chip {
  height: 28px;
  padding: 0 14px;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
}

.algo-chip:hover {
  border-color: var(--brand);
  color: var(--text-primary);
}

.algo-chip.active {
  background: var(--brand);
  border-color: var(--brand);
  color: #fff;
  font-weight: 600;
}

/* ---- 结果区 ---- */
.results-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.results-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

.results-grid {
  flex: 1;
  display: grid;
  gap: 6px;
  align-content: start;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-radius: 5px;
  background: var(--bg-input);
  padding: 8px 10px;
}

.result-label {
  width: 70px;
  flex-shrink: 0;
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 700;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
}

.result-value {
  flex: 1;
  min-width: 0;
  color: var(--brand);
  font-size: 12px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  word-break: break-all;
  line-height: 1.5;
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

@media (max-width: 700px) {
  .result-label {
    width: 56px;
    font-size: 11px;
  }

  .result-value {
    font-size: 11px;
  }
}
</style>
