type ClipboardMessage = {
  success: (content: string) => unknown;
  warning: (content: string) => unknown;
  error: (content: string) => unknown;
};

export function useClipboard(message: ClipboardMessage) {
  async function copyText(value: string) {
    if (!value) {
      message.warning("没有可复制的内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      message.success("已复制到剪贴板");
    } catch {
      // 降级方案：使用 execCommand
      try {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
        message.success("已复制到剪贴板");
      } catch {
        message.error("复制失败，请手动复制");
      }
    }
  }

  return { copyText };
}
