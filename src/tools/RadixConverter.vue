<script setup lang="ts">
import { computed, ref } from "vue";
import { NButton, NInput, NSelect, useMessage } from "naive-ui";
import { Copy } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 类型 ---- */
type Radix = 2 | 8 | 10 | 16;
interface RadixDef {
  value: number;
  label: string;
  prefix: string;
  digits: string;
}

const bases: RadixDef[] = [
  { value: 2, label: "二进制 (Base 2)", prefix: "0b", digits: "01" },
  { value: 8, label: "八进制 (Base 8)", prefix: "0o", digits: "01234567" },
  { value: 10, label: "十进制 (Base 10)", prefix: "", digits: "0123456789" },
  { value: 16, label: "十六进制 (Base 16)", prefix: "0x", digits: "0123456789ABCDEF" },
];

/* ---- 状态 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

const sourceBase = ref<number>(10);
const sourceValue = ref("255");

/* ---- 计算 ---- */
interface ConversionLine {
  base: number;
  label: string;
  value: string;
  error: boolean;
}

const results = computed<ConversionLine[]>(() => {
  const raw = sourceValue.value.trim();
  if (!raw) return bases.map((b) => ({ base: b.value, label: b.label, value: "", error: false }));

  // 验证输入字符
  const srcDef = bases.find((b) => b.value === sourceBase.value)!;
  const validDigits = srcDef.digits + srcDef.digits.toLowerCase();
  const hasInvalid = [...raw].some((ch) => ch !== "-" && !validDigits.includes(ch));

  if (hasInvalid) {
    return bases.map((b) => ({ base: b.value, label: b.label, value: "输入无效", error: true }));
  }

  try {
    // 处理负数
    let sign = 1n;
    let numStr = raw;
    if (raw.startsWith("-")) {
      sign = -1n;
      numStr = raw.slice(1);
    }

    // 用 BigInt 解析（支持超大数）
    let value: bigint;
    try {
      if (sourceBase.value === 10) {
        value = BigInt(numStr);
      } else {
        value = BigInt(`0${srcDef.prefix}${numStr}`);
      }
      value *= sign;
    } catch {
      return bases.map((b) => ({ base: b.value, label: b.label, value: "解析失败", error: true }));
    }

    return bases.map((b) => {
      let display: string;
      if (b.value === 10) {
        display = value.toString();
      } else {
        const abs = value < 0n ? -value : value;
        const prefix = value < 0n ? "-" : "";
        display = prefix + abs.toString(b.value).toUpperCase();
      }
      return { base: b.value, label: b.label, value: display, error: false };
    });
  } catch {
    return bases.map((b) => ({ base: b.value, label: b.label, value: "解析失败", error: true }));
  }
});

/* ---- 工具 ---- */
function copyVal(val: string) {
  if (val && val !== "输入无效" && val !== "解析失败") {
    void copyText(val);
  }
}
</script>

<template>
  <section class="tool-panel radix-tool">
    <!-- ====== 输入区 ====== -->
    <div class="input-card">
      <div class="input-row">
        <n-input
          v-model:value="sourceValue"
          size="small"
          placeholder="输入数值，如 255"
          class="value-input"
          @keyup.enter="copyVal(results[2]?.value)"
        />
        <n-select
          v-model:value="sourceBase"
          size="small"
          :options="bases.map((b) => ({ label: b.label, value: b.value }))"
          class="base-select"
        />
      </div>
      <div class="input-hint">
        当前：{{ bases.find((b) => b.value === sourceBase)?.digits.split("").join(" ") }}
        前缀 {{ bases.find((b) => b.value === sourceBase)?.prefix || "无" }}
      </div>
    </div>

    <!-- ====== 结果卡片 ====== -->
    <div class="results-grid">
      <div v-for="line in results" :key="line.base" class="result-card">
        <div class="result-head">
          <span class="result-label">{{ line.label }}</span>
          <n-button
            size="tiny"
            quaternary
            :render-icon="() => renderIcon(Copy)"
            :disabled="!line.value || line.error"
            @click="copyVal(line.value)"
          />
        </div>
        <code class="result-value" :class="{ error: line.error }">
          {{ line.value || "—" }}
        </code>
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

.radix-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

/* ---- 输入 ---- */
.input-card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 14px;
}

.input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.value-input {
  flex: 1;
  min-width: 0;
}

.base-select {
  width: 180px;
  flex-shrink: 0;
}

.input-hint {
  margin-top: 8px;
  color: var(--text-muted);
  font-size: 11px;
}

/* ---- 结果 ---- */
.results-grid {
  flex: 1;
  display: grid;
  gap: 10px;
}

.result-card {
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px 14px;
}

.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.result-label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
}

.result-value {
  display: block;
  color: var(--brand);
  font-size: 18px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-weight: 600;
  word-break: break-all;
  line-height: 1.4;
  user-select: all;
}

.result-value.error {
  color: var(--danger);
  font-size: 14px;
}

/* ---- 按钮 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

@media (max-width: 500px) {
  .input-row {
    flex-direction: column;
    align-items: stretch;
  }

  .base-select {
    width: 100%;
  }
}
</style>
