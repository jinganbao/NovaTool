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

let idCounter = 0;

export function makeId(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}
