import { afterEach, describe, expect, it, vi } from "vitest";
import { loadJson, loadVersionedJson, makeId, saveJson, saveVersionedJson } from "./storage";

// happy-dom 20 不注入 localStorage，用 mock 替代（行为与浏览器 Storage 一致）
const mockStorage = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

vi.stubGlobal("localStorage", mockStorage);

afterEach(() => {
  localStorage.clear();
});

describe("storage", () => {
  it("saveJson 后可 loadJson 读回", () => {
    const value = { theme: "dark", count: 42, list: [1, 2, 3] };
    saveJson("test-key", value);
    expect(loadJson("test-key", {})).toEqual(value);
  });

  it("损坏数据回退到默认值", () => {
    localStorage.setItem("test-key", "{invalid json!!");
    expect(loadJson("test-key", { fallback: true })).toEqual({ fallback: true });
  });

  it("不存在的数据回退到默认值", () => {
    expect(loadJson("no-such-key", 42)).toBe(42);
  });

  it("空字符串存储视为无数据", () => {
    localStorage.setItem("test-key", "");
    expect(loadJson("test-key", "fallback")).toBe("fallback");
  });

  it("支持版本化数据并兼容旧格式迁移", () => {
    saveVersionedJson("versioned", { value: 1 }, 2);
    expect(loadVersionedJson<{ value: number }>("versioned", { value: 0 }, 2, (value, version) => ({ value: (value as { value: number }).value + version }))).toEqual({ value: 3 });
    localStorage.setItem("legacy", JSON.stringify({ value: 4 }));
    expect(loadVersionedJson<{ value: number }>("legacy", { value: 0 }, 2, (value, version) => ({ value: (value as { value: number }).value + version }))).toEqual({ value: 4 });
  });
});

describe("makeId", () => {
  it("生成带前缀和序号唯一 id", () => {
    const a = makeId("conn");
    const b = makeId("conn");
    expect(a.startsWith("conn-")).toBe(true);
    expect(a).not.toBe(b);
  });
});
