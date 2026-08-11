import { describe, expect, it } from "vitest";
import { decodeBase64, encodeBase64 } from "./base64Service";

describe("base64Service", () => {
  it("使用 UTF-8 编解码 Unicode 文本", () => {
    const encoded = encodeBase64("Hello, 你好世界！", { urlSafe: false, padding: true });
    expect(decodeBase64(encoded)).toBe("Hello, 你好世界！");
  });

  it("支持无填充 Base64URL", () => {
    const encoded = encodeBase64("a?b+c/d=", { urlSafe: true, padding: false });
    expect(encoded).not.toMatch(/[+/=]/);
    expect(decodeBase64(encoded)).toBe("a?b+c/d=");
  });

  it("拒绝非法输入", () => {
    expect(() => decodeBase64("%%%not-base64%%%")).toThrow();
  });
});

