import { describe, expect, it } from "vitest";
import { generateNil, generateV4, generateV7 } from "./uuid";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("generateV4", () => {
  it("符合 UUID 格式", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateV4()).toMatch(UUID_RE);
    }
  });

  it("版本位为 4，变体位为 8/9/a/b", () => {
    for (let i = 0; i < 100; i++) {
      const uuid = generateV4();
      expect(uuid[14]).toBe("4");
      expect("89ab".includes(uuid[19])).toBe(true);
    }
  });

  it("每次生成不同", () => {
    expect(generateV4()).not.toBe(generateV4());
  });
});

describe("generateV7", () => {
  it("符合 UUID 格式（共 32 hex）", () => {
    for (let i = 0; i < 100; i++) {
      expect(generateV7()).toMatch(UUID_RE);
    }
  });

  it("版本位为 7，变体位为 8/9/a/b", () => {
    for (let i = 0; i < 100; i++) {
      const uuid = generateV7();
      expect(uuid[14]).toBe("7");
      expect("89ab".includes(uuid[19])).toBe(true);
    }
  });

  it("时间戳单调：晚生成的 UUID 前缀不小于早生成的", () => {
    const a = generateV7();
    const b = generateV7();
    // 前 12 个 hex 是毫秒时间戳（同毫秒内相等或递增）
    expect(b.slice(0, 12).localeCompare(a.slice(0, 12))).toBeGreaterThanOrEqual(0);
  });
});

describe("generateNil", () => {
  it("全零", () => {
    expect(generateNil()).toBe("00000000-0000-0000-0000-000000000000");
  });
});
