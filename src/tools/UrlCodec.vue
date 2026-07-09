<script setup lang="ts">
import { ref } from "vue";
import { NButton, NSpace, useMessage } from "naive-ui";
import { ArrowLeftRight, Copy, Eraser } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import { useClipboard } from "@/composables/useClipboard";

const message = useMessage();
const { copyText } = useClipboard(message);

/* ---- 模式 ---- */
type EncodeMode = "component" | "uri";
const encodeMode = ref<EncodeMode>("component");

/* ---- 内容 ---- */
const input = ref("https://example.com/search?q=你好世界&lang=zh");
const output = ref("");

/* ---- 工具 ---- */
function encode() {
  try {
    output.value =
      encodeMode.value === "component"
        ? encodeURIComponent(input.value)
        : encodeURI(input.value);
    message.success("编码完成");
  } catch (err) {
    output.value = "";
    message.error("编码失败：" + (err instanceof Error ? err.message : String(err)));
  }
}

function decode() {
  try {
    output.value =
      encodeMode.value === "component"
        ? decodeURIComponent(input.value)
        : decodeURI(input.value);
    message.success("解码完成");
  } catch (err) {
    output.value = "";
    message.error("解码失败：" + (err instanceof Error ? err.message : String(err)));
  }
}

function clearAll() {
  input.value = "";
  output.value = "";
}

function copyResult() {
  void copyText(output.value);
}

/* ---- 模式说明 ---- */
const modeHint = {
  component: "编码所有特殊字符（含 / ? & = #），适合 URL 参数值",
  uri: "保留 URL 结构字符（:// ? & = #），适合完整 URL 地址",
} as const;
</script>

<template>
  <section class="tool-panel split-panel">
    <!-- ====== 左：输入 ====== -->
    <div class="editor-pane">
      <div class="pane-head">
        <h2>原始内容</h2>
      </div>

      <!-- 模式选择 -->
      <div class="mode-bar">
        <span class="mode-label">编解码模式</span>
        <div class="toggle-group">
          <button
            class="toggle-btn"
            :class="{ active: encodeMode === 'component' }"
            type="button"
            @click="encodeMode = 'component'"
          >
            Component
          </button>
          <button
            class="toggle-btn"
            :class="{ active: encodeMode === 'uri' }"
            type="button"
            @click="encodeMode = 'uri'"
          >
            URI
          </button>
        </div>
        <span class="mode-hint">{{ modeHint[encodeMode] }}</span>
      </div>

      <!-- 按钮 -->
      <div class="action-bar">
        <n-space :size="6">
          <n-button size="tiny" type="primary" :render-icon="() => renderIcon(ArrowLeftRight)" @click="encode"
            >编码</n-button
          >
          <n-button size="tiny" secondary :render-icon="() => renderIcon(ArrowLeftRight)" @click="decode"
            >解码</n-button
          >
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="clearAll">清空</n-button>
        </n-space>
      </div>

      <CodeEditor v-model="input" language="plain" placeholder="输入要编码或解码的内容…" />
    </div>

    <!-- ====== 右：结果 ====== -->
    <div class="editor-pane">
      <div class="pane-head">
        <h2>结果</h2>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" @click="copyResult">复制</n-button>
      </div>
      <CodeEditor v-model="output" language="plain" readonly placeholder="点击编码或解码查看结果" />
    </div>
  </section>
</template>

<style scoped>
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.split-panel {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
}

/* ---- 面板 ---- */
.editor-pane {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 12px;
}

.pane-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.pane-head h2 {
  margin: 0;
  font-size: 14px;
  line-height: 1.2;
  font-weight: 700;
  color: var(--text-primary);
}

/* ---- 模式条 ---- */
.mode-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 8px;
  padding: 6px 8px;
  border-radius: 5px;
  background: var(--bg-input);
  flex-wrap: wrap;
}

.mode-label {
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
}

.mode-hint {
  color: var(--text-muted);
  font-size: 11px;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ---- 分段按钮 ---- */
.toggle-group {
  display: flex;
  border: 1px solid var(--border-strong);
  border-radius: 5px;
  overflow: hidden;
  flex-shrink: 0;
}

.toggle-btn {
  height: 26px;
  padding: 0 12px;
  border: 0;
  background: var(--bg-panel);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.toggle-btn + .toggle-btn {
  border-left: 1px solid var(--border-strong);
}

.toggle-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.toggle-btn.active {
  background: var(--brand);
  color: #fff;
  font-weight: 600;
}

/* ---- 按钮条 ---- */
.action-bar {
  flex-shrink: 0;
  margin-bottom: 8px;
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

/* ---- 响应式 ---- */
@media (max-width: 860px) {
  .split-panel {
    grid-template-columns: 1fr;
  }
}
</style>
