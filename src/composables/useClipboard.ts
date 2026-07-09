type ClipboardMessage = {
  success: (content: string) => unknown;
  warning: (content: string) => unknown;
};

export function useClipboard(message: ClipboardMessage) {
  async function copyText(value: string) {
    if (!value) {
      message.warning("没有可复制的内容");
      return;
    }
    await navigator.clipboard.writeText(value);
    message.success("已复制到剪贴板");
  }

  return { copyText };
}
