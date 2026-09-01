<script setup lang="ts">
import { computed, ref } from "vue";
import { NAlert, NButton, NInput, NInputNumber, NSelect, NSpace, NTag } from "naive-ui";
import { Copy, Download, Plus, Send, SlidersHorizontal, Terminal, Trash2, Upload } from "lucide-vue-next";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import ToolState from "@/components/common/ToolState.vue";
import { useClipboard } from "@/composables/useClipboard";
import { useHttpClient } from "@/features/http-client/useHttpClient";
import type { HttpKeyValue } from "@/features/http-client/types";
import { renderIcon } from "@/utils/render";
import { useMessage } from "naive-ui";

const message = useMessage();
const { copyText } = useClipboard(message);
const {
  method, url, query, headers, body, bodyType, timeoutMs, loading, response, responseBody,
  responseHeaders, error, selectedHistoryId, historyOptions, curlText, templates, selectedTemplateId, templateName, environment,
  addQuery, addHeader, addEnvironment, removeRow, applyHistory, applyTemplate, saveTemplate, send, clearResponse, exportCurl, importCurl,
} = useHttpClient();

const methodOptions = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].map((value) => ({ label: value, value }));
const bodyOptions = [
  { label: "无 Body", value: "none" }, { label: "JSON", value: "json" },
  { label: "纯文本", value: "text" }, { label: "Form", value: "form" },
];
const rowColumns = (list: HttpKeyValue[]) => list;
const showCurl = ref(false);
const showEnvironment = ref(false);
const templateOptions = computed(() => templates.value.map((item) => ({ label: item.name, value: item.id })));
const sensitiveKeyPattern = /authorization|proxy-authorization|cookie|set-cookie|token|secret|password|api[-_]?key/i;
const hasSensitiveData = computed(() =>
  [...headers.value, ...environment.value].some((item) => item.enabled && sensitiveKeyPattern.test(item.key)),
);
function isSensitiveKey(key: string) {
  return sensitiveKeyPattern.test(key);
}
function exportRequestCurl() { void copyText(exportCurl()); }
function importRequestCurl() { try { importCurl(curlText.value); message.success("cURL 已导入"); } catch (error) { message.error(error instanceof Error ? error.message : "cURL 解析失败"); } }
</script>

<template>
  <section class="tool-panel http-client">
    <div class="request-bar">
      <n-select v-model:value="method" size="small" :options="methodOptions" class="method-select" />
      <n-input v-model:value="url" size="small" placeholder="https://api.example.com/v1/resource" class="url-input" @keyup.enter="send" />
      <n-button size="small" type="primary" :loading="loading" :render-icon="() => renderIcon(Send)" @click="send">发送</n-button>
      <n-select v-model:value="selectedHistoryId" size="small" clearable placeholder="请求历史" :options="historyOptions" class="history-select" @update:value="applyHistory" />
      <n-button size="small" secondary :render-icon="() => renderIcon(Terminal)" @click="showCurl = !showCurl">cURL</n-button>
    </div>

    <div v-if="showCurl" class="curl-panel">
      <n-input v-model:value="curlText" type="textarea" :autosize="{ minRows: 2, maxRows: 5 }" placeholder="粘贴 cURL 命令，或导出当前请求" class="curl-input" />
      <n-space :size="6">
        <n-button size="tiny" type="primary" :render-icon="() => renderIcon(Upload)" @click="importRequestCurl">导入</n-button>
        <n-button size="tiny" secondary :render-icon="() => renderIcon(Download)" @click="exportRequestCurl">复制 cURL</n-button>
      </n-space>
    </div>

    <div class="template-bar">
      <n-select v-model:value="selectedTemplateId" size="small" clearable placeholder="请求模板" :options="templateOptions" class="template-select" @update:value="applyTemplate" />
      <n-input v-model:value="templateName" size="small" placeholder="模板名称" class="template-name" />
      <n-button size="small" secondary @click="saveTemplate">保存模板
      </n-button>
      <n-button size="small" secondary :render-icon="() => renderIcon(SlidersHorizontal)" @click="showEnvironment = !showEnvironment">环境变量
      </n-button>
    </div>

    <n-alert v-if="hasSensitiveData" class="security-alert" type="warning" :show-icon="false">
      当前请求包含敏感字段。请求历史、模板和环境变量会保存在本机浏览器存储中，请勿在共享设备上保存凭据。
    </n-alert>

    <div v-if="showEnvironment" class="environment-panel">
      <div class="section-head"><strong>环境变量</strong><span class="environment-hint">请求中的 &#123;&#123;NAME&#125;&#125; 会替换为变量值</span><n-button size="tiny" quaternary :render-icon="() => renderIcon(Plus)" aria-label="添加环境变量" title="添加环境变量" @click="addEnvironment" /></div>
      <div v-for="item in environment" :key="item.id" class="environment-row">
        <input v-model="item.enabled" type="checkbox" aria-label="启用环境变量" />
        <n-input v-model:value="item.key" size="small" placeholder="变量名，例如 API_HOST" />
        <n-input v-model:value="item.value" size="small" :type="isSensitiveKey(item.key) ? 'password' : 'text'" show-password-on="click" placeholder="变量值" />
        <n-button size="tiny" quaternary aria-label="删除环境变量" title="删除环境变量" :render-icon="() => renderIcon(Trash2)" @click="removeRow(environment, item.id)" />
      </div>
    </div>

    <div class="http-layout">
      <section class="request-panel">
        <div class="panel-tabs"><span class="active">请求配置</span><span>Headers {{ headers.filter((item) => item.enabled && item.key).length }}</span><span>Query {{ query.filter((item) => item.enabled && item.key).length }}</span></div>
        <div class="config-section">
          <div class="section-head"><strong>Query 参数</strong><n-button size="tiny" quaternary :render-icon="() => renderIcon(Plus)" aria-label="添加 Query 参数" title="添加 Query 参数" @click="addQuery" /></div>
          <div v-for="item in rowColumns(query)" :key="item.id" class="key-value-row">
            <input v-model="item.enabled" type="checkbox" aria-label="启用参数" />
            <n-input v-model:value="item.key" size="small" placeholder="参数名" />
            <n-input v-model:value="item.value" size="small" placeholder="参数值" />
            <n-button size="tiny" quaternary aria-label="删除参数" title="删除参数" :render-icon="() => renderIcon(Trash2)" @click="removeRow(query, item.id)" />
          </div>
        </div>
        <div class="config-section">
          <div class="section-head"><strong>Headers</strong><n-button size="tiny" quaternary :render-icon="() => renderIcon(Plus)" aria-label="添加 Header" title="添加 Header" @click="addHeader" /></div>
          <div v-for="item in rowColumns(headers)" :key="item.id" class="key-value-row">
            <input v-model="item.enabled" type="checkbox" aria-label="启用 Header" />
            <n-input v-model:value="item.key" size="small" placeholder="Header 名称" />
            <n-input v-model:value="item.value" size="small" :type="isSensitiveKey(item.key) ? 'password' : 'text'" show-password-on="click" placeholder="Header 值" />
            <n-button size="tiny" quaternary aria-label="删除 Header" title="删除 Header" :render-icon="() => renderIcon(Trash2)" @click="removeRow(headers, item.id)" />
          </div>
        </div>
        <div class="body-section">
          <div class="section-head"><strong>请求 Body</strong><n-select v-model:value="bodyType" size="tiny" :options="bodyOptions" class="body-select" /></div>
          <CodeEditor v-model="body" language="json" :readonly="bodyType === 'none'" placeholder="输入请求 Body" />
        </div>
        <div class="request-options"><span>超时</span><n-input-number v-model:value="timeoutMs" size="small" :min="100" :max="120000" :step="1000" :show-button="false" class="timeout-input" /><span>ms</span></div>
      </section>

      <section class="response-panel">
        <header class="response-head"><div><h2>响应</h2><span v-if="response">{{ response.size }} bytes · {{ response.durationMs }} ms</span></div><n-space :size="5"><n-tag v-if="response" :type="response.status >= 400 ? 'error' : 'success'" :bordered="false" size="small">{{ response.status }} {{ response.statusText }}</n-tag><n-button size="tiny" secondary :disabled="!response" :render-icon="() => renderIcon(Copy)" @click="copyText(responseBody)">复制</n-button><n-button size="tiny" secondary :disabled="!response" @click="clearResponse">清空</n-button></n-space></header>
        <div v-if="error" class="response-error"><ToolState type="error" title="请求失败" :detail="error" compact /></div>
        <template v-else-if="response">
          <div class="response-meta"><span>Headers {{ responseHeaders.length }}</span><span>{{ response.truncated ? "响应已截断" : "完整响应" }}</span></div>
          <div class="response-headers"><div v-for="([key, value]) in responseHeaders" :key="key"><code>{{ key }}</code><span>{{ value }}</span></div></div>
          <CodeEditor :model-value="responseBody" language="json" readonly placeholder="空响应" />
        </template>
        <ToolState v-else title="暂无响应" detail="配置请求后点击发送" />
      </section>
    </div>
  </section>
</template>

<style scoped src="../features/http-client/http-client.css"></style>
