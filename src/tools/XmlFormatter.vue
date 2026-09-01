<script setup lang="ts">
import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { NButton, NInput, NSpace, useMessage } from "naive-ui";
import { ChevronDown, ChevronUp, Copy, FoldVertical, Minimize2, Sparkles, UnfoldVertical } from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import DualPaneTool from "@/components/layout/DualPaneTool.vue";
import ToolState from "@/components/common/ToolState.vue";
import { useClipboard } from "@/composables/useClipboard";

const message = useMessage();
const { copyText } = useClipboard(message);
const input = ref("<root><name>NovaTool</name><stack>Tauri + Vue3</stack></root>");
const output = ref("");
const error = ref("");
const formatting = ref(false);
const searchQuery = ref("");
const searchCount = ref(0);
const searchIndex = ref(0);
const resultEditor = ref<InstanceType<typeof CodeEditor> | null>(null);

function toErrorMessage(err: unknown): string {
  return typeof err === "string" ? err : err instanceof Error ? err.message : String(err);
}

async function format() {
  formatting.value = true;
  try {
    // 格式化在 Rust 端执行（quick-xml），完整保留 CDATA/注释/DOCTYPE，错误带行列号
    output.value = await invoke<string>("xml_format", { input: input.value, mode: "pretty" });
    error.value = "";
    message.success("XML 已格式化");
  } catch (err) {
    output.value = "";
    error.value = toErrorMessage(err);
    message.error("XML 格式化失败");
  } finally {
    formatting.value = false;
  }
}

async function compress() {
  formatting.value = true;
  try {
    output.value = await invoke<string>("xml_format", { input: input.value, mode: "compact" });
    error.value = "";
    message.success("XML 已压缩");
  } catch (err) {
    output.value = "";
    error.value = toErrorMessage(err);
    message.error("XML 压缩失败");
  } finally {
    formatting.value = false;
  }
}

function copy() {
  void copyText(output.value);
}

function onEditorShortcut(action: "clear" | "execute") {
  if (action === "clear") {
    input.value = "";
    output.value = "";
    error.value = "";
  } else void format();
}

function onSearchChange(result: { count: number; index: number }) {
  searchCount.value = result.count;
  searchIndex.value = result.index;
}

</script>

<template>
  <DualPaneTool>
    <template #left-title>原始 XML</template>
    <template #left-actions>
      <n-space :size="6">
        <n-button size="tiny" type="primary" :render-icon="() => renderIcon(Sparkles)" @click="format">格式化</n-button>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Minimize2)" @click="compress">压缩</n-button>
      </n-space>
    </template>
    <template #left>
      <CodeEditor v-model="input" language="xml" placeholder="输入 XML 字符串" @shortcut="onEditorShortcut" />
      <ToolState v-if="error" type="error" title="XML 格式化失败" :detail="error" compact />
    </template>

    <template #right-title>格式化结果</template>
    <template #right-actions>
      <n-space :size="5" align="center">
        <n-input v-model:value="searchQuery" size="tiny" clearable placeholder="搜索结果" class="result-search" />
        <span v-if="searchQuery.trim()" class="search-count">{{ searchCount ? `${searchIndex + 1}/${searchCount}` : "无结果" }}</span>
        <n-button v-if="searchQuery.trim()" size="tiny" quaternary :render-icon="() => renderIcon(ChevronUp)" aria-label="上一个搜索结果" title="上一个搜索结果" @click="resultEditor?.previousSearch()" />
        <n-button v-if="searchQuery.trim()" size="tiny" quaternary :render-icon="() => renderIcon(ChevronDown)" aria-label="下一个搜索结果" title="下一个搜索结果" @click="resultEditor?.nextSearch()" />
        <n-button size="tiny" quaternary :render-icon="() => renderIcon(FoldVertical)" aria-label="折叠全部" title="折叠全部" @click="resultEditor?.foldAll()" />
        <n-button size="tiny" quaternary :render-icon="() => renderIcon(UnfoldVertical)" aria-label="展开全部" title="展开全部" @click="resultEditor?.unfoldAll()" />
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Copy)" @click="copy">复制</n-button>
      </n-space>
    </template>
    <template #right>
      <CodeEditor
        v-model="output"
        language="xml"
        readonly
        placeholder="点击格式化查看结果"
        ref="resultEditor"
        :search-query="searchQuery"
        @search-change="onSearchChange"
      />
    </template>
  </DualPaneTool>
</template>

<style scoped>
.error-line {
  flex-shrink: 0;
  margin-top: 10px;
  color: var(--danger);
  font-size: 12px;
}
.result-search { width: 138px; }
.search-count { min-width: 42px; color: var(--text-muted); font-size: 11px; text-align: center; }
</style>
