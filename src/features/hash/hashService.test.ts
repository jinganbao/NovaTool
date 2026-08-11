import { describe, expect, it } from "vitest";
import { computeTextHashes, utf8ByteLength } from "./hashService";

describe("hashService", () => {
  it("使用 hash-wasm 计算标准测试向量", async () => {
    const result = await computeTextHashes("abc", ["md5", "sha1", "sha256", "sm3"]);
    expect(result.get("md5")).toBe("900150983cd24fb0d6963f7d28e17f72");
    expect(result.get("sha1")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(result.get("sha256")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(result.get("sm3")).toBe("66c7f0f462eeedd9d1f2d46bdc10e4e24167c4875cf2f7a2297da02b8f4ba8e0");
  });

  it("按 UTF-8 统计输入字节", () => {
    expect(utf8ByteLength("你好")).toBe(6);
  });
});

