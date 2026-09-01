import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useMessage } from "naive-ui";
import { useClipboard } from "@/composables/useClipboard";
import { loadJson, makeId, saveJson } from "@/utils/storage";
import type {
  SavedPayload,
  TcpClientEvent,
  TcpConnection,
  TcpSendHistory,
  TcpSendResult,
  TemplateField,
} from "./types";

const CONNECTIONS_KEY = "NovaTool-tcp-client-connections";
const PAYLOADS_KEY = "NovaTool-tcp-client-payloads";
const SEND_HISTORY_KEY = "NovaTool-tcp-client-send-history";
const MAX_LOG_SIZE = 512 * 1024;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function parseTemplateValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function useTcpClient() {
  const message = useMessage();
  const { copyText } = useClipboard(message);

  const connId = ref<string | null>(null);
  const connecting = ref(false);
  const disconnecting = ref(false);
  const autoReconnect = ref(false);
  const reconnectLimit = ref(3);
  const reconnectAttempt = ref(0);
  const host = ref("127.0.0.1");
  const port = ref("9000");
  const connectionName = ref("本地服务");
  const connectionGroup = ref("");
  const mode = ref<"utf8" | "hex">("utf8");
  const sendEnding = ref<"none" | "lf" | "crlf">("none");
  const timeoutMs = ref("3000");
  const savedConnections = ref<TcpConnection[]>(loadJson(CONNECTIONS_KEY, []));
  const selectedConnectionId = ref<string | null>(savedConnections.value[0]?.id ?? null);

  const payload = ref('{"msgId":2,"content":7964}#!');
  const sending = ref(false);
  const savedPayloads = ref<SavedPayload[]>(loadJson(PAYLOADS_KEY, []));
  const selectedPayloadId = ref<string | null>(savedPayloads.value[0]?.id ?? null);
  const payloadName = ref("登录消息");
  const sendHistory = ref<TcpSendHistory[]>(loadJson(SEND_HISTORY_KEY, []));
  const selectedHistoryId = ref<string | null>(null);

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

  const receiveMode = ref<"text" | "hex">("text");
  const receiveFilter = ref<"all" | "send" | "recv" | "error" | "info">("all");
  const receiveLog = ref("");
  const diagnostics = ref({ requests: 0, bytesSent: 0, bytesReceived: 0, lastDurationMs: 0 });
  const receiveRef = ref<HTMLElement | null>(null);
  let unlistenClient: UnlistenFn | null = null;
  let reconnectTimer: number | undefined;
  let disposed = false;

  function clearReconnectTimer() {
    if (reconnectTimer !== undefined) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = undefined;
    }
  }

  const connectionOptions = computed(() =>
    savedConnections.value.map((item) => ({
      label: `${item.group ? `[${item.group}] ` : ""}${item.name}  ${item.host}:${item.port}`,
      value: item.id,
    })),
  );
  const payloadOptions = computed(() =>
    savedPayloads.value.map((item) => ({ label: item.name, value: item.id })),
  );
  const historyOptions = computed(() =>
    sendHistory.value.map((item) => ({
      label: `${item.timestamp}  ${item.host}:${item.port}  ${item.content.replace(/\s+/g, " ").slice(0, 28)}`,
      value: item.id,
    })),
  );
  const filteredReceiveLog = computed(() => {
    if (receiveFilter.value === "all") return receiveLog.value;
    const lines = receiveLog.value.split("\n");
    const result: string[] = [];
    let include = false;
    for (const line of lines) {
      const match = line.match(/^\[\d{2}:\d{2}:\d{2}\] (SEND|RECV|ERR |INFO)/);
      if (match) {
        const type = match[1].trim() === "ERR" ? "error" : match[1].trim().toLowerCase();
        include = type === receiveFilter.value;
      }
      if (include) result.push(line);
    }
    return result.join("\n");
  });

  watch(savedConnections, (value) => saveJson(CONNECTIONS_KEY, value), { deep: true });
  watch(savedPayloads, (value) => saveJson(PAYLOADS_KEY, value), { deep: true });
  watch(sendHistory, (value) => saveJson(SEND_HISTORY_KEY, value), { deep: true });

  function now() {
    return new Date().toLocaleTimeString("zh-CN", { hour12: false });
  }

  function appendLog(type: "send" | "recv" | "error" | "info", content: string) {
    const label = type === "send" ? "SEND" : type === "recv" ? "RECV" : type === "error" ? "ERR " : "INFO";
    let log = `${receiveLog.value}${receiveLog.value ? "\n" : ""}[${now()}] ${label} ${content}`;
    if (log.length > MAX_LOG_SIZE) {
      const cutPoint = log.indexOf("\n", log.length - MAX_LOG_SIZE);
      log = log.slice(cutPoint > 0 ? cutPoint + 1 : 0);
    }
    receiveLog.value = log;
    void nextTick(() => {
      if (receiveRef.value) receiveRef.value.scrollTop = receiveRef.value.scrollHeight;
    });
  }

  onMounted(async () => {
    if (!isTauri()) return;
    const stop = await listen<TcpClientEvent>("tcp-client-event", (event) => {
      const incoming = event.payload;
      if (incoming.connId !== connId.value) return;
      if (incoming.type === "data") {
        diagnostics.value.bytesReceived += incoming.bytes ?? 0;
        const body = receiveMode.value === "hex" ? (incoming.hex ?? "") : (incoming.text ?? "");
        appendLog("recv", `${incoming.bytes ?? 0} bytes${body ? `\n${body}` : " (empty)"}`);
      } else {
        appendLog("error", incoming.message ?? "连接已断开");
        connId.value = null;
        scheduleReconnect();
      }
    });
    if (disposed) stop();
    else unlistenClient = stop;
  });

  onBeforeUnmount(() => {
    disposed = true;
    clearReconnectTimer();
    const id = connId.value;
    if (id) void invoke("tcp_disconnect", { connId: id }).catch(() => {});
    connId.value = null;
    unlistenClient?.();
  });

  function validatedEndpoint() {
    const cleanHost = host.value.trim();
    const cleanPort = Number(port.value);
    if (!cleanHost || !Number.isInteger(cleanPort) || cleanPort <= 0 || cleanPort > 65535) {
      message.warning("请输入合法的 Host 和 Port");
      return null;
    }
    const timeout = Number(timeoutMs.value);
    if (!Number.isFinite(timeout) || timeout < 100 || timeout > 60000) {
      message.warning("超时时间应在 100-60000ms 之间");
      return null;
    }
    return { host: cleanHost, port: cleanPort, timeoutMs: Math.round(timeout) };
  }

  function scheduleReconnect() {
    if (disposed || !autoReconnect.value || reconnectAttempt.value >= reconnectLimit.value || reconnectTimer !== undefined) return;
    reconnectAttempt.value += 1;
    const delay = Math.min(5000, 500 * (2 ** (reconnectAttempt.value - 1)));
    appendLog("info", `${delay}ms 后尝试重连（${reconnectAttempt.value}/${reconnectLimit.value}）`);
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      void connect(true);
    }, delay);
  }

  async function connect(isRetry = false) {
    const endpoint = validatedEndpoint();
    if (!endpoint) return;
    connecting.value = true;
    try {
      const id = await invoke<string>("tcp_connect", endpoint);
      connId.value = id;
      reconnectAttempt.value = 0;
      appendLog("info", `已建立长连接 ${endpoint.host}:${endpoint.port} (${id})`);
      message.success("连接成功");
    } catch (error) {
      appendLog("error", errorText(error));
      message.error(`连接失败：${errorText(error)}`);
      if (isRetry) scheduleReconnect();
    } finally {
      connecting.value = false;
    }
  }

  async function disconnect() {
    const id = connId.value;
    clearReconnectTimer();
    reconnectAttempt.value = 0;
    if (!id) return;
    disconnecting.value = true;
    try {
      await invoke("tcp_disconnect", { connId: id });
      appendLog("info", `已断开连接 (${id})`);
      message.success("已断开");
    } catch (error) {
      message.error(errorText(error));
    } finally {
      connId.value = null;
      disconnecting.value = false;
    }
  }

  function applyConnection(id: string | null) {
    const item = savedConnections.value.find((connection) => connection.id === id);
    if (!item) return;
    connectionName.value = item.name;
    connectionGroup.value = item.group ?? "";
    host.value = item.host;
    port.value = item.port;
    mode.value = item.mode;
  }

  function saveConnection() {
    if (!validatedEndpoint()) return;
    const cleanName = connectionName.value.trim() || `${host.value}:${port.value}`;
    const existing = selectedConnectionId.value
      ? savedConnections.value.find((item) => item.id === selectedConnectionId.value)
      : null;
    if (existing) {
      Object.assign(existing, { name: cleanName, group: connectionGroup.value.trim(), host: host.value.trim(), port: port.value.trim(), mode: mode.value });
      message.success("已更新常用连接");
      return;
    }
    const item: TcpConnection = {
      id: makeId("connection"),
      name: cleanName,
      group: connectionGroup.value.trim(),
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
    savedConnections.value = savedConnections.value.filter((item) => item.id !== selectedConnectionId.value);
    selectedConnectionId.value = savedConnections.value[0]?.id ?? null;
    if (selectedConnectionId.value) applyConnection(selectedConnectionId.value);
    message.success("已删除连接");
  }

  function applySavedPayload(id: string | null) {
    const item = savedPayloads.value.find((saved) => saved.id === id);
    if (!item) return;
    payloadName.value = item.name;
    payload.value = item.content;
  }

  function applyHistory(id: string | null) {
    const item = sendHistory.value.find((history) => history.id === id);
    if (!item) return;
    selectedHistoryId.value = item.id;
    payload.value = item.content;
    host.value = item.host;
    port.value = item.port;
    mode.value = item.mode;
  }

  function recordHistory(endpoint: { host: string; port: number }, content: string) {
    sendHistory.value = [
      {
        id: makeId("history"),
        timestamp: now(),
        host: endpoint.host,
        port: String(endpoint.port),
        mode: mode.value,
        content,
      },
      ...sendHistory.value,
    ].slice(0, 30);
  }

  function savePayload() {
    const cleanName = payloadName.value.trim() || "未命名输入";
    const existing = selectedPayloadId.value
      ? savedPayloads.value.find((item) => item.id === selectedPayloadId.value)
      : null;
    if (existing) {
      Object.assign(existing, { name: cleanName, content: payload.value });
      message.success("已更新常用输入");
      return;
    }
    const item: SavedPayload = { id: makeId("payload"), name: cleanName, content: payload.value };
    savedPayloads.value.unshift(item);
    selectedPayloadId.value = item.id;
    message.success("已保存常用输入");
  }

  function deletePayload() {
    if (!selectedPayloadId.value) return;
    savedPayloads.value = savedPayloads.value.filter((item) => item.id !== selectedPayloadId.value);
    selectedPayloadId.value = savedPayloads.value[0]?.id ?? null;
    if (selectedPayloadId.value) applySavedPayload(selectedPayloadId.value);
    message.success("已删除输入");
  }

  function addTemplateField() {
    templateFields.value.push({ id: makeId("field"), key: "", value: "" });
  }
  function removeTemplateField(id: string) {
    templateFields.value = templateFields.value.filter((field) => field.id !== id);
  }
  function fillTemplateToPayload() {
    payload.value = templateResult.value;
    message.success("已填充到发送内容");
  }

  async function sendPayload() {
    const endpoint = validatedEndpoint();
    if (!endpoint) return;
    if (!payload.value) {
      message.warning("请输入发送内容");
      return;
    }
    sending.value = true;
    const started = performance.now();
    const persistentId = connId.value;
    const ending = sendEnding.value === "lf" ? (mode.value === "hex" ? " 0A" : "\n") : sendEnding.value === "crlf" ? (mode.value === "hex" ? " 0D 0A" : "\r\n") : "";
    const wirePayload = `${payload.value}${ending}`;
    appendLog("send", `${endpoint.host}:${endpoint.port} ${mode.value.toUpperCase()} ${persistentId ? "[长连接] " : ""}${wirePayload}`);
    try {
      const result = await invoke<TcpSendResult>(
        persistentId ? "tcp_conn_send" : "tcp_send",
        persistentId
          ? { connId: persistentId, payload: wirePayload, mode: mode.value, timeoutMs: endpoint.timeoutMs }
          : { ...endpoint, payload: wirePayload, mode: mode.value },
      );
      if (!persistentId) {
        const received = receiveMode.value === "hex" ? result.receivedHex : result.receivedText;
        appendLog("recv", `${result.bytesReceived} bytes${received ? `\n${received}` : " (empty)"}${result.truncated ? "\n[响应超过 16MB 上限，已截断]" : ""}`);
      }
      diagnostics.value.requests += 1;
      diagnostics.value.bytesSent += result.bytesSent;
      diagnostics.value.bytesReceived += result.bytesReceived;
      diagnostics.value.lastDurationMs = Math.round(performance.now() - started);
      recordHistory(endpoint, payload.value);
      message.success(result.truncated ? `发送完成：${result.bytesSent} bytes（响应已截断）` : `发送完成：${result.bytesSent} bytes`);
    } catch (error) {
      const detail = errorText(error);
      if (persistentId && detail.includes("不存在或已断开")) connId.value = null;
      appendLog("error", detail);
      message.error(`${persistentId ? "长连接发送失败" : "TCP 发送失败"}：${detail}`);
    } finally {
      sending.value = false;
    }
  }

  return {
    connId, connecting, disconnecting, autoReconnect, reconnectLimit, reconnectAttempt, host, port, connectionName, connectionGroup, mode, sendEnding, timeoutMs,
    selectedConnectionId, connectionOptions, payload, sending, selectedPayloadId,
    payloadName, payloadOptions, sendHistory, selectedHistoryId, historyOptions, showTemplate, templateFields, templateSuffix,
    templateResult, receiveMode, receiveFilter, filteredReceiveLog, receiveLog, receiveRef, diagnostics, copyText, connect, disconnect,
    applyConnection, saveConnection, deleteConnection, applySavedPayload, savePayload,
    applyHistory, deletePayload, addTemplateField, removeTemplateField, fillTemplateToPayload, sendPayload,
  };
}
