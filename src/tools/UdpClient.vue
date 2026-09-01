<script setup lang="ts">
import { NButton, NInput, NInputNumber, NSelect, NSpace, NSwitch, NTag } from "naive-ui";
import { Copy, Eraser, Send } from "lucide-vue-next";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import ToolState from "@/components/common/ToolState.vue";
import { useUdpClient } from "@/features/udp-client/useUdpClient";
import { renderIcon } from "@/utils/render";

const { host, port, mode, timeoutMs, waitResponse, payload, sending, response, error, copyText, send, clear } = useUdpClient();
</script>

<template>
  <section class="tool-panel udp-client">
    <div class="udp-toolbar">
      <span class="toolbar-label">目标</span>
      <n-input v-model:value="host" size="small" placeholder="Host" class="host-input" />
      <span class="address-separator">:</span>
      <n-input v-model:value="port" size="small" placeholder="Port" class="port-input" @keyup.enter="send" />
      <n-select v-model:value="mode" size="small" :options="[{ label: 'UTF-8', value: 'utf8' }, { label: 'HEX', value: 'hex' }]" class="mode-select" />
      <n-input-number v-model:value="timeoutMs" size="small" :min="100" :max="60000" :show-button="false" class="timeout-input" />
      <span class="toolbar-unit">ms</span>
      <span class="response-toggle"><n-switch v-model:value="waitResponse" size="small" />等待响应</span>
      <n-button size="small" type="primary" :loading="sending" :render-icon="() => renderIcon(Send)" @click="send">发送数据报</n-button>
    </div>
    <div class="udp-layout">
      <section class="udp-pane">
        <header><div><h2>发送内容</h2><span>{{ mode === 'hex' ? '十六进制字节，空格可选' : 'UTF-8 文本' }}</span></div><n-button size="tiny" secondary :render-icon="() => renderIcon(Eraser)" @click="clear">清空</n-button></header>
        <CodeEditor v-model="payload" :language="mode === 'hex' ? 'plain' : 'plain'" placeholder="输入 UDP 数据报内容" />
      </section>
      <section class="udp-pane response-pane">
        <header><div><h2>响应</h2><span v-if="response">{{ response.peerAddr }} · {{ response.durationMs }} ms</span></div><n-space :size="5"><n-tag v-if="response" type="success" :bordered="false" size="small">{{ response.bytesReceived }} bytes</n-tag><n-button size="tiny" secondary :disabled="!response" :render-icon="() => renderIcon(Copy)" @click="copyText(mode === 'hex' ? response?.receivedHex ?? '' : response?.receivedText ?? '')">复制</n-button></n-space></header>
        <div v-if="error" class="udp-error"><ToolState type="error" title="UDP 请求失败" :detail="error" compact /></div>
        <CodeEditor v-else-if="response && response.bytesReceived > 0" :model-value="mode === 'hex' ? response.receivedHex : response.receivedText" readonly placeholder="空响应" />
        <ToolState v-else title="暂无响应" :detail="response ? '已发送数据报，但没有收到响应' : '配置目标后点击发送数据报'" />
      </section>
    </div>
  </section>
</template>

<style scoped>
.udp-client { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.udp-toolbar { display: flex; align-items: center; gap: 7px; padding: 8px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); }
.toolbar-label, .toolbar-unit, .address-separator { color: var(--text-muted); font-size: 11px; }
.host-input { flex: 1; min-width: 130px; }
.port-input { width: 78px; }
.mode-select { width: 86px; }
.timeout-input { width: 78px; }
.response-toggle { display: inline-flex; align-items: center; gap: 5px; margin-left: auto; color: var(--text-muted); font-size: 11px; white-space: nowrap; }
.udp-layout { flex: 1; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; }
.udp-pane { min-width: 0; min-height: 0; display: flex; flex-direction: column; gap: 8px; padding: 10px; border: 1px solid var(--border-subtle); border-radius: 6px; background: var(--bg-panel); overflow: hidden; }
.udp-pane header { min-height: 30px; display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.udp-pane header > div { display: flex; align-items: baseline; gap: 8px; }
.udp-pane h2 { margin: 0; color: var(--text-primary); font-size: 13px; }
.udp-pane header span { color: var(--text-muted); font-size: 10px; }
.response-pane > :deep(.tool-state) { flex: 1; }
.udp-error { flex: 1; display: flex; align-items: flex-start; }
:deep(.n-button) { height: 27px; font-size: 11px; }
@media (max-width: 800px) { .udp-toolbar { flex-wrap: wrap; } .response-toggle { margin-left: 0; } .udp-layout { grid-template-columns: 1fr; overflow-y: auto; } .udp-pane { min-height: 340px; } }
</style>
