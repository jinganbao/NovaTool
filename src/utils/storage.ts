/**
 * localStorage JSON 序列化工具
 */

export function loadJson<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored) return JSON.parse(stored) as T;
  } catch {
    // localStorage 数据损坏时回退到默认值
  }
  return fallback;
}

export function saveJson(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    console.warn(`[storage] 无法保存 ${key}，可能已超出本地存储配额`);
    return false;
  }
}

export function loadVersionedJson<T>(
  key: string,
  fallback: T,
  version: number,
  migrate: (value: unknown, storedVersion: number) => T,
): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as { version?: unknown; data?: unknown };
    if (parsed && typeof parsed === "object" && "data" in parsed) {
      const storedVersion = typeof parsed.version === "number" ? parsed.version : 0;
      return migrate(parsed.data, storedVersion);
    }
    return migrate(parsed, 0);
  } catch {
    return fallback;
  }
}

export function saveVersionedJson(key: string, value: unknown, version: number): boolean {
  return saveJson(key, { version, data: value });
}

let idCounter = 0;

export function makeId(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}
