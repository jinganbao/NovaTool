import { ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useMessage } from "naive-ui";
import { useClipboard } from "@/composables/useClipboard";
import type { UdpResponse } from "./types";

export function useUdpClient() {
  const message = useMessage();
  const { copyText } = useClipboard(message);
  const host = ref("127.0.0.1");
  const port = ref("9000");
  const mode = ref<"utf8" | "hex">("utf8");
  const timeoutMs = ref(3000);
  const waitResponse = ref(true);
  const payload = ref("Hello NovaTool");
  const sending = ref(false);
  const response = ref<UdpResponse | null>(null);
  const error = ref("");

  async function send() {
    const portNumber = Number(port.value);
    if (!host.value.trim() || !Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) {
      message.warning("请输入合法的 Host 和 Port");
      return;
    }
    if (!payload.value) { message.warning("请输入发送内容"); return; }
    sending.value = true;
    response.value = null;
    error.value = "";
    try {
      response.value = await invoke<UdpResponse>("udp_send", {
        host: host.value.trim(), port: portNumber, payload: payload.value,
        mode: mode.value, timeoutMs: timeoutMs.value, waitResponse: waitResponse.value,
      });
      message.success(`已发送 ${response.value.bytesSent} bytes`);
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : String(cause);
      message.error(`UDP 请求失败：${error.value}`);
    } finally { sending.value = false; }
  }

  function clear() { payload.value = ""; response.value = null; error.value = ""; }
  return { host, port, mode, timeoutMs, waitResponse, payload, sending, response, error, copyText, send, clear };
}
