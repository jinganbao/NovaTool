<script setup lang="ts">
import { ref } from "vue";
import { NButton, NCheckbox, NInputNumber, NRadio, useMessage } from "naive-ui";
import { Copy, RefreshCw } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import { useClipboard } from "@/composables/useClipboard";
import { generateNil, generateV4, generateV7 } from "@/utils/uuid";

/* ---- 配置 ---- */
type UUIDVersion = "v4" | "v7" | "nil";
const version = ref<UUIDVersion>("v4");
const lowerCase = ref(true);
const noHyphen = ref(false);
const count = ref(1);

const uuids = ref<string[]>([]);

/* ---- 工具 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

/* ---- 生成 ---- */
function generate() {
  const n = Math.max(1, Math.min(500, count.value));
  const results: string[] = [];
  for (let i = 0; i < n; i++) {
    let uuid: string;
    if (version.value === "v4") uuid = generateV4();
    else if (version.value === "v7") uuid = generateV7();
    else uuid = generateNil();

    if (!lowerCase.value) uuid = uuid.toUpperCase();
    if (noHyphen.value) uuid = uuid.replace(/-/g, "");

    results.push(uuid);
  }
  uuids.value = results;
  message.success(`已生成 ${n} 个 UUID`);
}

// 初始生成
generate();

function copyAll() {
  void copyText(uuids.value.join("\n"));
}

function copyOne(uuid: string) {
  void copyText(uuid);
}
</script>

<template>
  <section class="tool-panel uuid-tool">
    <!-- ====== 配置 ====== -->
    <div class="config-card">
      <div class="card-head">
        <h2>配置</h2>
        <n-button size="small" type="primary" :render-icon="() => renderIcon(RefreshCw)" @click="generate">生成</n-button>
      </div>

      <div class="config-grid">
        <div class="cfg-section">
          <span class="cfg-label">版本</span>
          <n-radio-group v-model:value="version" size="small">
            <n-radio value="v4">v4 (随机)</n-radio>
            <n-radio value="v7">v7 (时间序)</n-radio>
            <n-radio value="nil">NIL</n-radio>
          </n-radio-group>
        </div>

        <div class="cfg-section">
          <span class="cfg-label">格式</span>
          <n-checkbox v-model:checked="lowerCase">小写</n-checkbox>
          <n-checkbox v-model:checked="noHyphen">去掉连字符</n-checkbox>
        </div>

        <div class="cfg-section">
          <span class="cfg-label">数量</span>
          <n-input-number
            v-model:value="count"
            :min="1"
            :max="500"
            size="small"
            class="count-input"
          />
        </div>
      </div>
    </div>

    <!-- ====== 结果 ====== -->
    <div class="results-card">
      <div class="card-head">
        <h2>结果</h2>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" :disabled="uuids.length === 0" @click="copyAll">复制全部</n-button>
      </div>
      <div class="results-list">
        <div v-for="(uuid, i) in uuids" :key="i" class="result-row">
          <span class="result-num">{{ i + 1 }}</span>
          <code class="result-uuid">{{ uuid }}</code>
          <n-button size="tiny" quaternary aria-label="复制此 UUID" title="复制此 UUID" :render-icon="() => renderIcon(Copy)" @click="copyOne(uuid)" />
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

.uuid-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

/* ---- 公共 ---- */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.card-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ---- 配置 ---- */
.config-card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 14px;
}

.config-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.cfg-section {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cfg-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  width: 32px;
}

.count-input {
  width: 80px;
}

/* ---- 结果：自适应高度，超出滚动 ---- */
.results-card {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 14px;
}

.results-list {
  max-height: 320px;
  overflow-y: auto;
  display: grid;
  gap: 6px;
}

.result-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 5px;
  background: var(--bg-input);
}

.result-num {
  width: 24px;
  color: var(--brand);
  font-size: 11px;
  font-weight: 700;
  text-align: right;
  flex-shrink: 0;
}

.result-uuid {
  flex: 1;
  min-width: 0;
  color: var(--text-primary);
  font-size: 13px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  word-break: break-all;
  user-select: all;
}

/* ---- 按钮 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

:deep(.n-radio) {
  font-size: 13px;
}

:deep(.n-checkbox) {
  font-size: 13px;
}
</style>
