import { describe, expect, it } from "vitest";
import { decodeUrl, encodeUrl } from "./urlCodecService";

describe("urlCodecService", () => {
  it("Component 模式编码结构字符", () => {
    const options = { scope: "component" as const, spaceAsPlus: false };
    const encoded = encodeUrl("你好 /?&=", options);
    expect(encoded).toContain("%2F%3F%26%3D");
    expect(decodeUrl(encoded, options)).toBe("你好 /?&=");
  });

  it("URI 模式保留 URL 结构", () => {
    const options = { scope: "uri" as const, spaceAsPlus: false };
    const encoded = encodeUrl("https://example.com/a b?q=你好", options);
    expect(encoded).toContain("https://example.com/a%20b?q=");
    expect(decodeUrl(encoded, options)).toBe("https://example.com/a b?q=你好");
  });

  it("支持表单查询参数的加号空格", () => {
    const options = { scope: "component" as const, spaceAsPlus: true };
    expect(encodeUrl("hello world", options)).toBe("hello+world");
    expect(decodeUrl("hello+world", options)).toBe("hello world");
  });
});

