import { describe, expect, it } from "vitest";
import { convertRadix } from "./radixService";

describe("radixService", () => {
  it("自动识别前缀并转换", () => {
    const result = convertRadix("0xFF", "auto", { uppercase: true, prefix: true });
    expect(result.detectedBase).toBe(16);
    expect(result.outputs.find((item) => item.base === 10)?.value).toBe("255");
    expect(result.outputs.find((item) => item.base === 2)?.value).toBe("0b11111111");
  });

  it("支持分隔符、负数和超大整数", () => {
    const result = convertRadix("-1_000_000_000_000_000_000_000", 10, { uppercase: true, prefix: false });
    expect(result.outputs.find((item) => item.base === 10)?.value).toBe("-1000000000000000000000");
  });

  it("拒绝与来源进制不匹配的字符", () => {
    expect(() => convertRadix("102", 2, { uppercase: true, prefix: false })).toThrow();
  });
});

