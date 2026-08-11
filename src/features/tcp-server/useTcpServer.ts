import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useMessage } from "naive-ui";
import { useClipboard } from "@/composables/useClipboard";
import type { ClientEntry, ServerEvent } from "./types";

const MAX_LOG_CHARS = 512 * 1024;

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function useTcpServer() {
  const message = useMessage();
  const { copyText } = useClipboard(message);
  const port = ref("9000");
  const lanEnabled = ref(false);
  const running = ref(false);
  const starting = ref(false);
  const stopping = ref(false);
  const logLines = ref<string[]>([]);
  const logChars = ref(0);
  const clients = ref<ClientEntry[]>([]);
  const displayMode = ref<"text" | "hex">("text");
  const logRef = ref<HTMLElement | null>(null);
  const serverSendText = ref("");
  const sendMode = ref<"text" | "hex">("text");
  const selectedSendClient = ref<string | null>(null);
  let unlisten: UnlistenFn | null = null;
  let disposed = false;

  const clientOptions = computed(() =>
    clients.value.map((client) => ({ label: `${client.id} (${client.addr})`, value: client.id })),
  );

  function appendLog(time: string, tag: string, header: string, body?: string) {
    const line = `[${time}] ${tag} ${header}${body ? `\n${body}` : ""}`;
    logLines.value.push(line);
    logChars.value += line.length;
    while (logChars.value > MAX_LOG_CHARS && logLines.value.length > 1) {
      logChars.value -= logLines.value.shift()?.length ?? 0;
    }
    void nextTick(() => {
      if (logRef.value) logRef.value.scrollTop = logRef.value.scrollHeight;
    });
  }

  function handleServerEvent(event: ServerEvent) {
    const { type, clientId, addr, message: detail, text, hex } = event;
    const time = new Date().toLocaleTimeString("zh-CN", { hour12: false });
    if (type === "info") {
      appendLog(time, "INFO", detail);
      if (detail.includes("已启动")) running.value = true;
      if (detail.includes("已停止")) {
        running.value = false;
        clients.value = [];
        selectedSendClient.value = null;
      }
      return;
    }
    if (type === "connect") {
      appendLog(time, "CONNECT", `[${clientId}] ${detail}`);
      if (!clients.value.some((client) => client.id === clientId)) {
        clients.value.push({ id: clientId, addr });
      }
      selectedSendClient.value ??= clientId;
      return;
    }
    if (type === "disconnect") {
      appendLog(time, "DISCONN", `[${clientId}] ${detail}`);
      clients.value = clients.value.filter((client) => client.id !== clientId);
      if (selectedSendClient.value === clientId) selectedSendClient.value = clients.value[0]?.id ?? null;
      return;
    }
    if (type === "error") {
      appendLog(time, "ERROR", `[${clientId}] ${detail}`);
      return;
    }
    const body = displayMode.value === "hex" ? (hex ?? "") : (text ?? detail);
    appendLog(time, type === "data" ? "DATA" : "SEND", `[${clientId}]${type === "server-send" ? ` ${detail}` : ""}`, body);
  }

  onMounted(async () => {
    if (!isTauri()) return;
    const stop = await listen<ServerEvent>("tcp-server-event", (event) => handleServerEvent(event.payload));
    if (disposed) stop();
    else unlisten = stop;
  });

  onBeforeUnmount(() => {
    disposed = true;
    unlisten?.();
    if (running.value) void invoke("tcp_server_stop").catch(() => {});
    running.value = false;
  });

  async function startServer() {
    const portNumber = Number(port.value);
    if (!Number.isInteger(portNumber) || portNumber <= 0 || portNumber > 65535) {
      message.warning("请输入合法的端口号 (1-65535)");
      return;
    }
    starting.value = true;
    try {
      await invoke("tcp_server_start", { port: portNumber, lan: lanEnabled.value });
      running.value = true;
      message.success(lanEnabled.value ? `已启动，监听 0.0.0.0:${portNumber}（局域网可访问）` : `已启动，监听 127.0.0.1:${portNumber}`);
    } catch (error) {
      message.error(errorText(error));
    } finally {
      starting.value = false;
    }
  }

  async function stopServer() {
    stopping.value = true;
    try {
      await invoke("tcp_server_stop");
      running.value = false;
      clients.value = [];
      selectedSendClient.value = null;
      message.success("服务已停止");
    } catch (error) {
      message.error(errorText(error));
    } finally {
      stopping.value = false;
    }
  }

  async function sendToClient() {
    const clientId = selectedSendClient.value;
    if (!clientId || serverSendText.value.length === 0) {
      message.warning("请选择客户端并输入发送内容");
      return;
    }
    try {
      await invoke("tcp_server_send", { clientId, data: serverSendText.value, mode: sendMode.value });
      serverSendText.value = "";
      message.success("发送成功");
    } catch (error) {
      message.error(errorText(error));
    }
  }

  async function disconnectClient(clientId: string) {
    try {
      await invoke("tcp_server_disconnect_client", { clientId });
      message.success("正在断开客户端");
    } catch (error) {
      message.error(errorText(error));
    }
  }

  function clearLog() {
    logLines.value = [];
    logChars.value = 0;
  }

  return {
    port, lanEnabled, running, starting, stopping, logLines, clients, displayMode,
    logRef, serverSendText, sendMode, selectedSendClient, clientOptions, copyText,
    startServer, stopServer, sendToClient, disconnectClient, clearLog,
  };
}
