<script setup lang="ts">
import { computed, h, nextTick, onBeforeUnmount, ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { NButton, NInput, NSelect, NSpace, NTag, useMessage } from "naive-ui";
import {
  Copy,
  Play,
  RadioTower,
  Square,
  Trash2,
} from "lucide-vue-next";
import type { Component } from "vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 类型 ---- */
type ServerEvent = {
  type: "info" | "connect" | "data" | "disconnect" | "error";
  clientId: string;
  addr: string;
  message: string;
  text?: string;
  hex?: string;
  bytes?: number;
};

type ClientEntry = {
  id: string;
  addr: string;
  connected: boolean;
};

/* ---- 状态 ---- */
const message = useMessage();
const { copyText } = useClipboard(message);

const port = ref("9000");
const running = ref(false);
const starting = ref(false);
const stopping = ref(false);
const logLines = ref<string[]>([]);
const clients = ref<ClientEntry[]>([]);
const displayMode = ref<"text" | "hex">("text");
const logRef = ref<HTMLElement | null>(null);

let unlisten: UnlistenFn | null = null;

/* ---- 生命周期 ---- */
async function setupListener() {
  unlisten = await listen<ServerEvent>("tcp-server-event", (event) => {
    const { type, clientId, addr, message: msg, text, hex, bytes } = event.payload;
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });

    switch (type) {
      case "info":
        appendLog(time, "INFO", msg, "");
        // 检测启动/停止
        if (msg.includes("已启动")) running.value = true;
        if (msg.includes("已停止")) {
          running.value = false;
          clients.value = [];
        }
        break;
      case "connect":
        appendLog(time, "CONNECT", `[${clientId}] ${msg}`, "connect");
        clients.value = [...clients.value, { id: clientId, addr, connected: true }];
        break;
      case "data": {
        const body = displayMode.value === "hex" && hex ? hex : (text ?? msg);
        appendLog(time, "DATA", `[${clientId}]`, "data", body);
        break;
      }
      case "disconnect":
        appendLog(time, "DISCONN", `[${clientId}] ${msg}`, "disconnect");
        clients.value = clients.value.filter((c) => c.id !== clientId);
        break;
      case "error":
        appendLog(time, "ERROR", msg, "error");
        break;
    }
  });
}

onBeforeUnmount(() => {
  unlisten?.();
});

setupListener();

/* ---- 工具函数 ---- */
function renderIcon(icon: Component, size = 14) {
  return h(icon, { size, strokeWidth: 2.1 });
}

function appendLog(time: string, tag: string, header: string, cssClass: string, body?: string) {
  const parts: string[] = [];
  parts.push(`[${time}] `);
  parts.push(tag);
  parts.push(` ${header}`);
  if (body) {
    parts.push(`\n${body}`);
  }
  logLines.value.push(parts.join(""));
  void nextTick(() => {
    if (logRef.value) {
      logRef.value.scrollTop = logRef.value.scrollHeight;
    }
  });
}

/* ---- 操作 ---- */
async function startServer() {
  const portNum = Number(port.value);
  if (!Number.isInteger(portNum) || portNum <= 0 || portNum > 65535) {
    message.warning("请输入合法的端口号 (1-65535)");
    return;
  }
  starting.value = true;
  try {
    await invoke("tcp_server_start", { port: portNum });
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    starting.value = false;
  }
}

async function stopServer() {
  stopping.value = true;
  try {
    await invoke("tcp_server_stop");
    running.value = false;
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    stopping.value = false;
  }
}

function clearLog() {
  logLines.value = [];
}
</script>

<template>
  <section class="tool-panel tcp-server">
    <!-- ========== 顶部：连接栏 ========== -->
    <div class="conn-bar">
      <div class="conn-row">
        <label class="conn-label"
          >监听端口
          <n-input
            v-model:value="port"
            size="small"
            :disabled="running"
            @keyup.enter="startServer"
          />
        </label>
        <n-space :size="8" align="center">
          <n-button
            v-if="!running"
            size="small"
            type="primary"
            :loading="starting"
            :render-icon="() => renderIcon(Play)"
            @click="startServer"
            >启动监听</n-button
          >
          <n-button
            v-else
            size="small"
            type="error"
            :loading="stopping"
            :render-icon="() => renderIcon(Square)"
            @click="stopServer"
            >停止</n-button
          >
          <n-tag :type="running ? 'success' : 'default'" :bordered="false" size="small">
            <template #icon>
              <span
                class="status-dot"
                :style="{ background: running ? 'var(--success)' : 'var(--text-muted)' }"
              ></span>
            </template>
            {{ running ? "运行中" : "已停止" }}
          </n-tag>
          <span v-if="clients.length > 0" class="client-count">
            活跃客户端：<strong>{{ clients.length }}</strong>
          </span>
        </n-space>
      </div>
    </div>

    <!-- ========== 客户端条 ========== -->
    <div v-if="clients.length > 0" class="client-strip">
      <span class="strip-label">已连接</span>
      <span
        v-for="client in clients"
        :key="client.id"
        class="client-tag"
      >
        <span class="client-dot"></span>
        {{ client.id }}
        <span class="client-addr-short">{{ client.addr }}</span>
      </span>
    </div>

    <!-- ========== 日志区：独占下方全部空间 ========== -->
    <div class="log-section">
      <div class="section-head">
        <span class="section-title">接收日志</span>
        <n-space :size="6">
          <n-select
            v-model:value="displayMode"
            size="small"
            :options="[
              { label: '文本', value: 'text' },
              { label: 'HEX', value: 'hex' },
            ]"
            class="display-mode"
          />
          <n-button
            size="tiny"
            secondary
            :render-icon="() => renderIcon(Copy)"
            @click="copyText(logLines.join('\n'))"
            >复制</n-button
          >
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Trash2)" @click="clearLog"
            >清空</n-button
          >
        </n-space>
      </div>
      <pre
        v-if="logLines.length > 0"
        ref="logRef"
        class="log-view"
      ><span
          v-for="(line, i) in logLines"
          :key="i"
        >{{ line }}<br v-if="i < logLines.length - 1" /></span></pre>
      <div v-else class="log-empty">
        <RadioTower :size="28" />
        <span>等待客户端连接…</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* ---- 整体 ---- */
.tool-panel {
  flex: 1;
  min-height: 0;
  box-sizing: border-box;
}

.tcp-server {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
}

/* ---- 连接栏 ---- */
.conn-bar {
  flex-shrink: 0;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 8px 12px;
}

.conn-row {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.conn-label {
  color: var(--text-muted);
  font-size: 12px;
  display: grid;
  gap: 4px;
  width: 120px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.client-count {
  color: var(--text-secondary);
  font-size: 12px;
}

.client-count strong {
  color: var(--brand);
}

/* ---- 客户端条（横向小标签） ---- */
.client-strip {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 6px 10px;
}

.strip-label {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}

.client-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 5px;
  background: var(--bg-input);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  padding: 3px 8px;
}

.client-addr-short {
  color: var(--text-muted);
  font-weight: 400;
  font-size: 11px;
}

.client-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
  flex-shrink: 0;
}

/* ---- 日志区：独占全部剩余空间 ---- */
.log-section {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 10px;
}

.section-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.section-title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.display-mode {
  width: 72px;
}

.log-view {
  flex: 1;
  min-height: 0;
  margin: 0;
  overflow: auto;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--bg-input);
  color: var(--text-primary);
  padding: 10px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  line-height: 1.6;
}

.log-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--bg-input);
  font-size: 13px;
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

/* ---- 响应式 ---- */
@media (max-width: 700px) {
  .conn-row {
    flex-direction: column;
    align-items: stretch;
  }

  .conn-label {
    width: 100%;
  }
}
</style>
