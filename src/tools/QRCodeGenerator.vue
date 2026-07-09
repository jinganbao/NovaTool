<script setup lang="ts">
import { h, ref, watch } from "vue";
import QRCode from "qrcode";
import { NButton, NInputNumber, NRadio, NSpace, useMessage } from "naive-ui";
import { Copy, Download, Eraser, QrCode } from "lucide-vue-next";
import type { Component } from "vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 配置 ---- */
const input = ref("https://novatool.app");
const qrSvg = ref("");

type ErrorLevel = "L" | "M" | "Q" | "H";
const errorLevel = ref<ErrorLevel>("M");
const qrSize = ref(256);
const darkColor = ref("#000000");
const lightColor = ref("#ffffff");

const levelOptions = [
  { label: "L (7%)", value: "L" },
  { label: "M (15%)", value: "M" },
  { label: "Q (25%)", value: "Q" },
  { label: "H (30%)", value: "H" },
];

/* ---- 工具 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

function renderIcon(icon: Component, size = 14) {
  return h(icon, { size, strokeWidth: 2.1 });
}

/* ---- 生成 ---- */
async function generate() {
  if (!input.value.trim()) {
    qrSvg.value = "";
    return;
  }
  try {
    qrSvg.value = await QRCode.toString(input.value, {
      type: "svg",
      width: qrSize.value,
      errorCorrectionLevel: errorLevel.value,
      color: { dark: darkColor.value, light: lightColor.value },
      margin: 2,
    });
  } catch (err) {
    message.error("生成失败：" + (err instanceof Error ? err.message : String(err)));
  }
}

// 初始生成
generate();

// 输入变化实时生成（防抖）
let debounceTimer: ReturnType<typeof setTimeout>;
watch([input, errorLevel, qrSize, darkColor, lightColor], () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(generate, 300);
});

function clearAll() {
  input.value = "";
  qrSvg.value = "";
}

/* ---- 下载 ---- */
function downloadPng() {
  if (!qrSvg.value) return;
  const canvas = document.createElement("canvas");
  canvas.width = qrSize.value;
  canvas.height = qrSize.value;
  const ctx = canvas.getContext("2d")!;

  const img = new Image();
  const blob = new Blob([qrSvg.value], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  img.onload = () => {
    ctx.fillStyle = lightColor.value;
    ctx.fillRect(0, 0, qrSize.value, qrSize.value);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);

    canvas.toBlob((pngBlob) => {
      if (!pngBlob) return;
      const downloadUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "qrcode.png";
      a.click();
      URL.revokeObjectURL(downloadUrl);
      message.success("已下载 PNG");
    }, "image/png");
  };

  img.src = url;
}

async function copyImage() {
  if (!qrSvg.value) return;
  try {
    // 先转成 canvas 再复制为图片
    const canvas = document.createElement("canvas");
    canvas.width = qrSize.value;
    canvas.height = qrSize.value;
    const ctx = canvas.getContext("2d")!;

    const img = new Image();
    const blob = new Blob([qrSvg.value], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    await new Promise<void>((resolve) => {
      img.onload = () => {
        ctx.fillStyle = lightColor.value;
        ctx.fillRect(0, 0, qrSize.value, qrSize.value);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });

    const pngBlob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    if (!pngBlob) return;

    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": pngBlob }),
    ]);
    message.success("已复制到剪贴板");
  } catch {
    message.error("复制失败，浏览器可能不支持");
  }
}
</script>

<template>
  <section class="tool-panel qr-tool">
    <!-- ====== 双栏 ====== -->
    <div class="main-area">
      <!-- 左：输入 -->
      <div class="input-pane">
        <div class="pane-head">
          <h2>内容</h2>
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="clearAll">清空</n-button>
        </div>
        <textarea
          v-model="input"
          class="input-area"
          placeholder="输入文本或 URL…"
          rows="6"
        ></textarea>

        <div class="config-block">
          <div class="config-row">
            <span class="config-label">容错</span>
            <n-radio-group v-model:value="errorLevel" size="small">
              <n-radio v-for="o in levelOptions" :key="o.value" :value="o.value">{{ o.label }}</n-radio>
            </n-radio-group>
          </div>
          <div class="config-row">
            <span class="config-label">尺寸</span>
            <n-input-number v-model:value="qrSize" :min="128" :max="1024" :step="16" size="small" class="size-input" />
            <span class="config-unit">px</span>
          </div>
          <div class="config-row color-row">
            <span class="config-label">颜色</span>
            <input v-model="darkColor" type="color" class="color-pick" title="前景色" />
            <span class="color-arrow">→</span>
            <input v-model="lightColor" type="color" class="color-pick" title="背景色" value="#ffffff" />
          </div>
        </div>
      </div>

      <!-- 右：预览 -->
      <div class="preview-pane">
        <div class="pane-head">
          <h2>预览</h2>
          <n-space :size="6">
            <n-button size="tiny" secondary :render-icon="() => renderIcon(Download)" :disabled="!qrSvg" @click="downloadPng"
              >下载 PNG</n-button
            >
            <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" :disabled="!qrSvg" @click="copyImage"
              >复制图片</n-button
            >
          </n-space>
        </div>

        <div v-if="qrSvg" class="qr-preview" v-html="qrSvg"></div>
        <div v-else class="qr-empty">
          <QrCode :size="36" />
          <span>输入内容生成二维码</span>
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

.qr-tool {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ---- 双栏 ---- */
.main-area {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(280px, 1fr) minmax(280px, 1fr);
  gap: 12px;
}

/* ---- 输入面板 ---- */
.input-pane,
.preview-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 14px;
}

.pane-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 10px;
}

.pane-head h2 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: var(--text-primary);
}

.input-area {
  flex: 1;
  min-height: 100px;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 13px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  padding: 10px;
  resize: vertical;
  outline: none;
  line-height: 1.5;
}

.input-area:focus {
  border-color: var(--brand);
}

/* ---- 配置块 ---- */
.config-block {
  flex-shrink: 0;
  margin-top: 10px;
  padding: 10px;
  border-radius: 5px;
  background: var(--bg-input);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.config-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  width: 36px;
  flex-shrink: 0;
}

.size-input {
  width: 90px;
}

.config-unit {
  color: var(--text-muted);
  font-size: 12px;
}

.color-row {
  gap: 8px;
}

.color-pick {
  width: 30px;
  height: 24px;
  border: 1px solid var(--border-strong);
  border-radius: 4px;
  padding: 0;
  cursor: pointer;
  background: transparent;
}

.color-arrow {
  color: var(--text-muted);
  font-size: 12px;
}

/* ---- 预览 ---- */
.qr-preview {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
}

.qr-preview :deep(svg) {
  max-width: 100%;
  max-height: 100%;
  border-radius: 8px;
}

.qr-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  font-size: 13px;
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

:deep(.n-radio) {
  font-size: 12px;
}

@media (max-width: 700px) {
  .main-area {
    grid-template-columns: 1fr;
  }
}
</style>
