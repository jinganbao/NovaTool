<script setup lang="ts">
import { NButton, NInput, NSelect, NSpace, NTag } from "naive-ui";
import { Copy, Play, RadioTower, Send, Square, Trash2, X } from "lucide-vue-next";
import { useTcpServer } from "@/features/tcp-server/useTcpServer";
import { renderIcon } from "@/utils/render";

const {
  port,
  lanEnabled,
  running,
  starting,
  stopping,
  logLines,
  clients,
  displayMode,
  logRef,
  serverSendText,
  sendMode,
  selectedSendClient,
  copyText,
  startServer,
  stopServer,
  sendToClient,
  disconnectClient,
  clearLog,
} = useTcpServer();
</script>


<template>
  <section class="tool-panel tcp-server">
    <!-- ========== 顶部：连接栏 ========== -->
    <div class="conn-bar">
      <div class="conn-form">
        <label class="field field-tight">
          <span class="field-label">监听端口</span>
          <n-input
            v-model:value="port"
            size="small"
            :disabled="running"
            @keyup.enter="startServer"
          />
        </label>
        <label class="field field-auto">
          <span class="field-label">允许局域网连接</span>
          <n-switch v-model:value="lanEnabled" size="small" :disabled="running" />
          <span class="field-hint">{{ lanEnabled ? "绑定 0.0.0.0，局域网可访问" : "仅本机可访问（默认）" }}</span>
        </label>
      </div>
      <div class="conn-actions">
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
        @click="selectedSendClient = client.id"
        :class="{ 'client-tag-active': selectedSendClient === client.id }"
      >
        <span class="client-dot"></span>
        {{ client.id }}
        <span class="client-addr-short">{{ client.addr }}</span>
        <button class="client-kick-btn" @click.stop="disconnectClient(client.id)" title="断开">
          <X :size="12" />
        </button>
      </span>
    </div>

    <!-- ========== 发送区（向客户端发送） ========== -->
    <div v-if="running && clients.length > 0" class="server-send-bar">
      <n-select
        v-model:value="selectedSendClient"
        size="small"
        placeholder="选择目标客户端"
        :options="clients.map((c) => ({ label: `${c.id} (${c.addr})`, value: c.id }))"
        class="send-client-select"
      />
      <n-input
        v-model:value="serverSendText"
        size="small"
        :placeholder="sendMode === 'hex' ? 'HEX 内容，如 48 65 6C 6C 6F' : '输入发送内容...'"
        @keyup.enter="sendToClient"
        class="send-text-input"
      />
      <n-select
        v-model:value="sendMode"
        size="small"
        :options="[
          { label: '文本', value: 'text' },
          { label: 'HEX', value: 'hex' },
        ]"
        class="send-mode"
      />
      <n-button
        size="tiny"
        secondary
        :render-icon="() => renderIcon(Send)"
        :disabled="!selectedSendClient || !serverSendText.trim()"
        @click="sendToClient"
      >发送</n-button>
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

<style scoped src="../features/tcp-server/tcp-server.css"></style>
