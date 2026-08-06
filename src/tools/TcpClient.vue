<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { NButton, NInput, NSelect, NSpace, useMessage } from "naive-ui";
import {
  BookmarkPlus,
  ChevronDown,
  ChevronRight,
  Copy,
  Link,
  Play,
  Plus,
  Save,
  Trash2,
  Unlink,
  Wand2,
} from "lucide-vue-next";
import { renderIcon } from "@/utils/render";
import { loadJson, saveJson, makeId } from "@/utils/storage";
import CodeEditor from "@/components/editor/CodeEditor.vue";
import { useClipboard } from "@/composables/useClipboard";

/* ---- 类型 ---- */
type TcpConnection = {
  id: string;
  name: string;
  host: string;
  port: string;
  mode: "utf8" | "hex";
};

type SavedPayload = {
  id: string;
  name: string;
  content: string;
};

type TemplateField = {
  id: string;
  key: string;
  value: string;
};

type TcpSendResult = {
  receivedText: string;
  receivedHex: string;
  bytesSent: number;
  bytesReceived: number;
  truncated: boolean;
};

/* ---- 本地持久化 ---- */
const CONNECTIONS_KEY = "NovaTool-tcp-client-connections";
const PAYLOADS_KEY = "NovaTool-tcp-client-payloads";

const message = useMessage();
const { copyText } = useClipboard(message);

/* ---- 持久连接 ---- */
const connId = ref<string | null>(null);
const connecting = ref(false);
const disconnecting = ref(false);

/* ---- 连接数据 ---- */
const host = ref("127.0.0.1");
const port = ref("9000");
const connectionName = ref("本地服务");
const mode = ref<"utf8" | "hex">("utf8");
const timeoutMs = ref("3000");
const savedConnections = ref<TcpConnection[]>(loadJson(CONNECTIONS_KEY, []));
const selectedConnectionId = ref<string | null>(savedConnections.value[0]?.id ?? null);

/* ---- 发送数据 ---- */
const payload = ref('{"msgId":2,"content":7964}#!');
const sending = ref(false);

/* ---- 常用输入 ---- */
const savedPayloads = ref<SavedPayload[]>(loadJson(PAYLOADS_KEY, []));
const selectedPayloadId = ref<string | null>(savedPayloads.value[0]?.id ?? null);
const payloadName = ref("登录消息");

/* ---- 模板 ---- */
const showTemplate = ref(false);
const templateFields = ref<TemplateField[]>([
  { id: makeId(), key: "msgId", value: "2" },
  { id: makeId(), key: "content", value: "7964" },
]);
const templateSuffix = ref("#!");
const templateResult = computed(() => {
  const entries = templateFields.value
    .filter((field) => field.key.trim())
    .map((field) => [field.key.trim(), parseTemplateValue(field.value)] as const);
  return `${JSON.stringify(Object.fromEntries(entries))}${templateSuffix.value}`;
});

/* ---- 接收数据 ---- */
const receiveMode = ref<"text" | "hex">("text");
const receiveLog = ref("");
const receiveRef = ref<HTMLElement | null>(null);

/* ---- 后台事件监听：长连接接收数据 ---- */
let unlistenClient: UnlistenFn | null = null;

listen<{
  type: "data" | "disconnect";
  connId: string;
  text?: string;
  hex?: string;
  bytes?: number;
  message?: string;
}>("tcp-client-event", (event) => {
  const payload = event.payload;
  if (payload.connId !== connId.value) return;

  if (payload.type === "data") {
    const body = receiveMode.value === "hex" ? (payload.hex ?? "") : (payload.text ?? "");
    appendLog("recv", `${payload.bytes ?? 0} bytes${body ? `\n${body}` : " (empty)"}`);
  } else if (payload.type === "disconnect") {
    appendLog("error", payload.message ?? "连接已断开");
    connId.value = null;
  }
}).then((fn) => {
  unlistenClient = fn;
});

/* ---- 组件卸载：断开长连接 + 移除监听 ---- */
onBeforeUnmount(() => {
  if (connId.value) {
    void invoke("tcp_disconnect", { connId: connId.value }).catch(() => {});
    connId.value = null;
  }
  unlistenClient?.();
});

/* ---- 计算选项 ---- */
const connectionOptions = computed(() =>
  savedConnections.value.map((item) => ({
    label: `${item.name}  ${item.host}:${item.port}`,
    value: item.id,
  })),
);

const payloadOptions = computed(() =>
  savedPayloads.value.map((item) => ({
    label: item.name,
    value: item.id,
  })),
);

watch(savedConnections, (value) => saveJson(CONNECTIONS_KEY, value), { deep: true });
watch(savedPayloads, (value) => saveJson(PAYLOADS_KEY, value), { deep: true });

/* ---- 工具函数 ---- */
function parseTemplateValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function now() {
  return new Date().toLocaleTimeString("zh-CN", { hour12: false });
}

function appendLog(type: "send" | "recv" | "error" | "info", content: string) {
  const label =
    type === "send" ? "SEND" : type === "recv" ? "RECV" : type === "error" ? "ERR " : "INFO";
  const newLine = `[${now()}] ${label} ${content}`;
  let log = receiveLog.value;
  // 限制日志总长度，防止长时间运行内存持续增长（最多保留 512KB）
  const MAX_LOG_SIZE = 512 * 1024;
  log += `${log ? "\n" : ""}${newLine}`;
  if (log.length > MAX_LOG_SIZE) {
    const cutPoint = log.indexOf("\n", log.length - MAX_LOG_SIZE);
    log = log.slice(cutPoint > 0 ? cutPoint + 1 : 0);
  }
  receiveLog.value = log;
  void nextTick(() => {
    if (receiveRef.value) {
      receiveRef.value.scrollTop = receiveRef.value.scrollHeight;
    }
  });
}

/* ---- 连接操作 ---- */
async function connect() {
  const cleanHost = host.value.trim();
  const cleanPort = Number(port.value);
  if (!cleanHost || !Number.isInteger(cleanPort) || cleanPort <= 0 || cleanPort > 65535) {
    message.warning("请输入合法的 Host 和 Port");
    return;
  }
  connecting.value = true;
  try {
    const id = await invoke<string>("tcp_connect", {
      host: cleanHost,
      port: cleanPort,
      timeoutMs: Number(timeoutMs.value) || 3000,
    });
    connId.value = id;
    appendLog("info", `已建立长连接 ${cleanHost}:${cleanPort} (${id})`);
    message.success("连接成功");
  } catch (error) {
    appendLog("error", error instanceof Error ? error.message : String(error));
    message.error("连接失败");
  } finally {
    connecting.value = false;
  }
}

async function disconnect() {
  if (!connId.value) return;
  disconnecting.value = true;
  try {
    await invoke("tcp_disconnect", { connId: connId.value });
    appendLog("info", `已断开连接 (${connId.value})`);
    message.success("已断开");
  } catch (error) {
    message.error(error instanceof Error ? error.message : String(error));
  } finally {
    connId.value = null;
    disconnecting.value = false;
  }
}

function applyConnection(id: string | null) {
  const item = savedConnections.value.find((conn) => conn.id === id);
  if (!item) return;
  connectionName.value = item.name;
  host.value = item.host;
  port.value = item.port;
  mode.value = item.mode;
}

function saveConnection() {
  const cleanName = connectionName.value.trim() || `${host.value}:${port.value}`;
  const existing = selectedConnectionId.value
    ? savedConnections.value.find((item) => item.id === selectedConnectionId.value)
    : null;
  if (existing) {
    existing.name = cleanName;
    existing.host = host.value.trim();
    existing.port = port.value.trim();
    existing.mode = mode.value;
    message.success("已更新常用连接");
    return;
  }
  const item: TcpConnection = {
    id: makeId(),
    name: cleanName,
    host: host.value.trim(),
    port: port.value.trim(),
    mode: mode.value,
  };
  savedConnections.value.unshift(item);
  selectedConnectionId.value = item.id;
  message.success("已保存常用连接");
}

function deleteConnection() {
  if (!selectedConnectionId.value) return;
  savedConnections.value = savedConnections.value.filter(
    (item) => item.id !== selectedConnectionId.value,
  );
  selectedConnectionId.value = savedConnections.value[0]?.id ?? null;
  message.success("已删除连接");
}

/* ---- 常用输入操作 ---- */
function applySavedPayload(id: string | null) {
  const item = savedPayloads.value.find((saved) => saved.id === id);
  if (!item) return;
  payloadName.value = item.name;
  payload.value = item.content;
}

function savePayload() {
  const cleanName = payloadName.value.trim() || "未命名输入";
  const existing = selectedPayloadId.value
    ? savedPayloads.value.find((item) => item.id === selectedPayloadId.value)
    : null;
  if (existing) {
    existing.name = cleanName;
    existing.content = payload.value;
    message.success("已更新常用输入");
    return;
  }
  const item: SavedPayload = { id: makeId(), name: cleanName, content: payload.value };
  savedPayloads.value.unshift(item);
  selectedPayloadId.value = item.id;
  message.success("已保存常用输入");
}

function deletePayload() {
  if (!selectedPayloadId.value) return;
  savedPayloads.value = savedPayloads.value.filter(
    (item) => item.id !== selectedPayloadId.value,
  );
  selectedPayloadId.value = savedPayloads.value[0]?.id ?? null;
  message.success("已删除输入");
}

/* ---- 模板操作 ---- */
function addTemplateField() {
  templateFields.value.push({ id: makeId(), key: "", value: "" });
}

function removeTemplateField(id: string) {
  templateFields.value = templateFields.value.filter((field) => field.id !== id);
}

function fillTemplateToPayload() {
  payload.value = templateResult.value;
  message.success("已填充到发送内容");
}

/* ---- 发送 ---- */
async function sendPayload() {
  const cleanHost = host.value.trim();
  const cleanPort = Number(port.value);
  if (!cleanHost || !Number.isInteger(cleanPort) || cleanPort <= 0 || cleanPort > 65535) {
    message.warning("请输入合法的 Host 和 Port");
    return;
  }
  sending.value = true;
  const usePersistent = connId.value != null;
  appendLog("send", `${cleanHost}:${cleanPort} ${mode.value.toUpperCase()} ${usePersistent ? "[长连接]" : ""} ${payload.value}`);
  try {
    const result = await invoke<TcpSendResult>(
      usePersistent ? "tcp_conn_send" : "tcp_send",
      usePersistent
        ? { connId: connId.value, payload: payload.value, mode: mode.value, timeoutMs: Number(timeoutMs.value) || 3000 }
        : { host: cleanHost, port: cleanPort, payload: payload.value, mode: mode.value, timeoutMs: Number(timeoutMs.value) || 3000 },
    );
    // 长连接模式：数据通过后台事件推送，此处仅处理短连接响应
    if (!usePersistent) {
      const received = receiveMode.value === "hex" ? result.receivedHex : result.receivedText;
      appendLog(
        "recv",
        `${result.bytesReceived} bytes${received ? `\n${received}` : " (empty)"}${result.truncated ? "\n[响应超过 16MB 上限，已截断]" : ""}`,
      );
    }
    message.success(
      result.truncated ? `发送完成：${result.bytesSent} bytes（响应已截断）` : `发送完成：${result.bytesSent} bytes`,
    );
  } catch (error) {
    // 长连接断开时自动清理
    if (usePersistent && error instanceof Error && error.message.includes("不存在或已断开")) {
      connId.value = null;
    }
    appendLog("error", error instanceof Error ? error.message : String(error));
    message.error(usePersistent ? "长连接发送失败" : "TCP 发送失败");
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <section class="tool-panel tcp-client">
    <!-- ========== 顶部：连接配置 ========== -->
    <div class="conn-bar">
      <div class="conn-form">
        <div class="field field-wide">
          <span class="field-label">常用连接</span>
          <n-select
            v-model:value="selectedConnectionId"
            size="small"
            clearable
            placeholder="选择常用连接"
            :options="connectionOptions"
            class="conn-select"
            @update:value="applyConnection"
          />
        </div>
        <label class="field">
          <span class="field-label">名称</span>
          <n-input v-model:value="connectionName" size="small" />
        </label>
        <label class="field">
          <span class="field-label">Host</span>
          <n-input v-model:value="host" size="small" />
        </label>
        <label class="field">
          <span class="field-label">Port</span>
          <n-input v-model:value="port" size="small" @keyup.enter="sendPayload" />
        </label>
        <label class="field">
          <span class="field-label">编码</span>
          <n-select
            v-model:value="mode"
            size="small"
            :options="[
              { label: 'UTF-8', value: 'utf8' },
              { label: 'HEX', value: 'hex' },
            ]"
          />
        </label>
        <label class="field field-tight">
          <span class="field-label">超时(ms)</span>
          <n-input v-model:value="timeoutMs" size="small" />
        </label>
      </div>

      <div class="conn-actions">
        <n-space :size="6">
          <n-button size="tiny" secondary :render-icon="() => renderIcon(Save)" @click="saveConnection"
            >保存</n-button
          >
          <n-button
            size="tiny"
            quaternary
            :render-icon="() => renderIcon(Trash2)"
            @click="deleteConnection"
          />
        </n-space>
        <n-space :size="6">
          <n-button
            v-if="!connId"
            size="tiny"
            type="primary"
            :loading="connecting"
            :render-icon="() => renderIcon(Link)"
            @click="connect"
            >连接</n-button
          >
          <n-button
            v-else
            size="tiny"
            type="warning"
            :loading="disconnecting"
            :render-icon="() => renderIcon(Unlink)"
            @click="disconnect"
            >断开</n-button
          >
          <n-tag v-if="connId" type="success" :bordered="false" size="small">
            <template #icon>
              <span class="conn-status-dot"></span>
            </template>
            已连接
          </n-tag>
        </n-space>
      </div>
    </div>

    <!-- ========== 中部：发送区 ========== -->
    <div class="send-section">
      <div class="section-head">
        <span class="section-title">发送内容</span>
        <div class="section-actions">
          <n-input
            v-model:value="payloadName"
            size="small"
            placeholder="输入名称"
            class="payload-name"
          />
          <n-select
            v-model:value="selectedPayloadId"
            size="small"
            clearable
            placeholder="常用输入"
            :options="payloadOptions"
            class="payload-select"
            @update:value="applySavedPayload"
          />
          <n-button
            size="tiny"
            secondary
            :render-icon="() => renderIcon(BookmarkPlus)"
            @click="savePayload"
            >保存</n-button
          >
          <n-button
            size="tiny"
            quaternary
            :render-icon="() => renderIcon(Trash2)"
            @click="deletePayload"
          />
          <div class="action-divider"></div>
          <!-- 模板折叠按钮 -->
          <n-button
            size="tiny"
            secondary
            :render-icon="() => renderIcon(showTemplate ? ChevronDown : ChevronRight)"
            @click="showTemplate = !showTemplate"
            >模板</n-button
          >
          <n-button
            size="tiny"
            type="primary"
            :loading="sending"
            :render-icon="() => renderIcon(Play)"
            @click="sendPayload"
            >{{ connId ? '发送(长连接)' : '发送' }}</n-button
          >
        </div>
      </div>

      <!-- 模板展开区 -->
      <div v-if="showTemplate" class="template-panel">
        <div class="template-fields">
          <div v-for="field in templateFields" :key="field.id" class="template-row">
            <n-input v-model:value="field.key" size="small" placeholder="字段名" />
            <n-input
              v-model:value="field.value"
              size="small"
              placeholder="字段值"
              @keyup.enter="fillTemplateToPayload"
            />
            <n-button
              size="tiny"
              quaternary
              :render-icon="() => renderIcon(Trash2)"
              @click="removeTemplateField(field.id)"
            />
          </div>
        </div>
        <div class="template-actions">
          <button class="add-row" type="button" @click="addTemplateField">
            <Plus :size="13" />
            添加字段
          </button>
          <label class="template-suffix-label"
            >后缀
            <n-input
              v-model:value="templateSuffix"
              size="small"
              class="template-suffix-input"
              @keyup.enter="fillTemplateToPayload"
            />
          </label>
          <code class="template-preview">{{ templateResult }}</code>
          <n-button
            size="tiny"
            type="primary"
            :render-icon="() => renderIcon(Wand2)"
            @click="fillTemplateToPayload"
            >填充到编辑器</n-button
          >
        </div>
      </div>

      <CodeEditor v-model="payload" language="plain" placeholder="输入 TCP 发送内容..." />
    </div>

    <!-- ========== 底部：接收区 ========== -->
    <div class="receive-section">
      <div class="section-head">
        <span class="section-title">接收内容</span>
        <div class="section-actions">
          <n-select
            v-model:value="receiveMode"
            size="small"
            :options="[
              { label: '文本', value: 'text' },
              { label: 'HEX', value: 'hex' },
            ]"
            class="receive-mode"
          />
          <n-button
            size="tiny"
            secondary
            :render-icon="() => renderIcon(Copy)"
            @click="copyText(receiveLog)"
            >复制</n-button
          >
          <n-button size="tiny" secondary @click="receiveLog = ''">清空</n-button>
        </div>
      </div>
      <pre ref="receiveRef" class="receive-log">{{ receiveLog || "等待接收数据..." }}</pre>
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

.tcp-client {
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
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.conn-form {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 10px;
}

.field {
  flex: 1 1 100px;
  min-width: 100px;
  display: grid;
  gap: 4px;
}

.field-wide {
  flex: 1.5 1 170px;
}

.field-tight {
  flex: 0.8 1 90px;
  min-width: 90px;
}

.field-label {
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.conn-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-top: 1px solid var(--border-subtle);
  padding-top: 8px;
}

/* ---- 公共：section head ---- */
.section-head {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.section-title {
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}

.section-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.action-divider {
  width: 1px;
  height: 20px;
  background: var(--border-subtle);
  margin: 0 4px;
}

.conn-status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--success);
}

.payload-name {
  width: 100px;
}

.payload-select {
  width: 140px;
}

.receive-mode {
  width: 82px;
}

/* ---- 发送区 ---- */
.send-section {
  flex: 1 1 50%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 10px;
}

/* ---- 模板面板 ---- */
.template-panel {
  flex-shrink: 0;
  margin-bottom: 8px;
  border: 1px solid var(--border-subtle);
  border-radius: 5px;
  background: var(--bg-input);
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.template-fields {
  display: grid;
  gap: 5px;
}

.template-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) 28px;
  gap: 5px;
  align-items: center;
}

.template-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.add-row {
  height: 26px;
  border: 1px dashed var(--border-strong);
  border-radius: 5px;
  background: transparent;
  color: var(--text-secondary);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  font-size: 12px;
  flex-shrink: 0;
  padding: 0 8px;
}

.add-row:hover {
  color: var(--brand);
  border-color: var(--brand);
}

.template-suffix-label {
  color: var(--text-muted);
  font-size: 12px;
  display: flex;
  align-items: center;
  gap: 5px;
}

.template-suffix-input {
  width: 80px;
}

.template-preview {
  flex: 1;
  min-width: 120px;
  color: var(--brand);
  font-size: 11px;
  font-family: "SFMono-Regular", Consolas, "Liberation Mono", monospace;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ---- 接收区 ---- */
.receive-section {
  flex: 1 1 40%;
  min-height: 120px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  background: var(--bg-panel);
  padding: 10px;
}

.receive-log {
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
  line-height: 1.55;
}

/* ---- 按钮微调 ---- */
:deep(.n-button) {
  height: 28px;
  font-size: 12px;
}

/* ---- 响应式 ---- */
@media (max-width: 1100px) {
  .payload-name {
    width: 80px;
  }

  .payload-select {
    width: 120px;
  }
}

@media (max-width: 860px) {
  .section-head {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
