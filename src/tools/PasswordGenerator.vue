<script setup lang="ts">
import { computed, h, ref } from "vue";
import { NButton, NCheckbox, NInputNumber, NSlider, NSpace, NTag, useMessage } from "naive-ui";
import { Copy, RefreshCw, ShieldCheck } from "lucide-vue-next";
import type { Component } from "vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 字符集 ---- */
const CHAR_SETS: Record<string, { label: string; chars: string }> = {
  upper:   { label: "大写字母 A-Z",  chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  lower:   { label: "小写字母 a-z",  chars: "abcdefghijklmnopqrstuvwxyz" },
  digits:  { label: "数字 0-9",      chars: "0123456789" },
  symbols: { label: "特殊符号",      chars: "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" },
};

const AMBIGUOUS = "0O1lI";

/* ---- 配置 ---- */
const length = ref(16);
const useUpper = ref(true);
const useLower = ref(true);
const useDigits = ref(true);
const useSymbols = ref(false);
const avoidAmbiguous = ref(true);

const password = ref("");

/* ---- 工具 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

function renderIcon(icon: Component, size = 14) {
  return h(icon, { size, strokeWidth: 2.1 });
}

/* ---- 生成 ---- */
function generate() {
  let pool = "";
  if (useUpper.value) pool += CHAR_SETS.upper.chars;
  if (useLower.value) pool += CHAR_SETS.lower.chars;
  if (useDigits.value) pool += CHAR_SETS.digits.chars;
  if (useSymbols.value) pool += CHAR_SETS.symbols.chars;

  if (avoidAmbiguous.value) {
    pool = [...pool].filter((c) => !AMBIGUOUS.includes(c)).join("");
  }

  if (!pool) {
    message.warning("请至少选择一种字符集");
    return;
  }

  const array = new Uint32Array(length.value);
  crypto.getRandomValues(array);

  let result = "";
  for (let i = 0; i < length.value; i++) {
    result += pool[array[i] % pool.length];
  }

  password.value = result;
}

/* 首次加载自动生成 */
generate();

/* ---- 强度计算 ---- */
const entropy = computed(() => {
  let poolSize = 0;
  if (useUpper.value) poolSize += 26;
  if (useLower.value) poolSize += 26;
  if (useDigits.value) poolSize += 10;
  if (useSymbols.value) poolSize += CHAR_SETS.symbols.chars.length;
  if (avoidAmbiguous.value) {
    // 粗略估算去除易混淆字符后的影响
    poolSize = Math.max(1, poolSize - 5);
  }
  return Math.round(length.value * Math.log2(poolSize));
});

const strength = computed(() => {
  const e = entropy.value;
  if (e < 40) return { label: "弱", color: "error", pct: Math.min(25, e / 40 * 25) };
  if (e < 60) return { label: "一般", color: "warning", pct: 25 + (e - 40) / 20 * 25 };
  if (e < 80) return { label: "强", color: "info", pct: 50 + (e - 60) / 20 * 25 };
  return { label: "非常强", color: "success", pct: 75 + Math.min(25, (e - 80) / 40 * 25) };
});

function copyPassword() {
  if (password.value) {
    void copyText(password.value);
    message.success("已复制到剪贴板");
  }
}
</script>

<template>
  <section class="tool-panel pwd-tool">
    <!-- ====== 显示区 ====== -->
    <div class="display-card">
      <div class="card-head">
        <h2>生成密码</h2>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(RefreshCw)" @click="generate">重新生成</n-button>
      </div>

      <div class="password-display">
        <code class="password-text">{{ password || "点击生成" }}</code>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" :disabled="!password" @click="copyPassword">复制</n-button>
      </div>

      <div class="strength-bar">
        <div class="strength-track">
          <div
            class="strength-fill"
            :style="{ width: strength.pct + '%' }"
            :class="'fill-' + strength.color"
          ></div>
        </div>
        <n-tag :type="strength.color as any" :bordered="false" size="small">
          {{ strength.label }} · {{ entropy }} bit
        </n-tag>
      </div>
    </div>

    <!-- ====== 配置区 ====== -->
    <div class="config-card">
      <div class="card-head">
        <h2>配置</h2>
      </div>

      <!-- 长度 -->
      <div class="config-row">
        <span class="config-label">密码长度</span>
        <n-slider
          v-model:value="length"
          :min="6"
          :max="64"
          :step="1"
          :format-tooltip="(v: number) => v + ' 位'"
          class="length-slider"
        />
        <n-input-number
          v-model:value="length"
          :min="6"
          :max="64"
          size="small"
          class="length-input"
        />
      </div>

      <!-- 字符集 -->
      <div class="config-grid">
        <n-checkbox v-model:checked="useUpper" @update:checked="generate">大写字母 A-Z</n-checkbox>
        <n-checkbox v-model:checked="useLower" @update:checked="generate">小写字母 a-z</n-checkbox>
        <n-checkbox v-model:checked="useDigits" @update:checked="generate">数字 0-9</n-checkbox>
        <n-checkbox v-model:checked="useSymbols" @update:checked="generate">特殊符号 !@#$…</n-checkbox>
      </div>

      <div class="config-extra">
        <n-checkbox v-model:checked="avoidAmbiguous" @update:checked="generate">排除易混淆字符 (0 O 1 l I)</n-checkbox>
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

.pwd-tool {
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
}

/* ---- 公共 ---- */
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.card-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ---- 显示区 ---- */
.display-card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-panel);
  padding: 16px;
}

.password-display {
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--bg-input);
  padding: 12px 14px;
}

.password-text {
  flex: 1;
  min-width: 0;
  color: var(--brand);
  font-size: 20px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-weight: 600;
  letter-spacing: 0.08em;
  word-break: break-all;
  line-height: 1.4;
  user-select: all;
}

/* ---- 强度条 ---- */
.strength-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 12px;
}

.strength-track {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: var(--bg-input);
  overflow: hidden;
}

.strength-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.3s, background 0.3s;
}

.fill-error   { background: var(--danger); }
.fill-warning { background: var(--warning); }
.fill-info    { background: var(--brand); }
.fill-success { background: var(--success); }

/* ---- 配置区 ---- */
.config-card {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  background: var(--bg-panel);
  padding: 16px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 16px;
}

.config-label {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  width: 60px;
  flex-shrink: 0;
}

.length-slider {
  flex: 1;
  min-width: 0;
}

.length-input {
  width: 72px;
  flex-shrink: 0;
}

.config-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 12px;
}

.config-extra {
  padding-top: 8px;
  border-top: 1px solid var(--border-subtle);
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

:deep(.n-checkbox) {
  font-size: 13px;
}

@media (max-width: 500px) {
  .config-grid {
    grid-template-columns: 1fr;
  }

  .config-row {
    flex-wrap: wrap;
  }
}
</style>
