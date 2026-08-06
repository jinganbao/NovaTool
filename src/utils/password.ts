/**
 * 密码生成器（安全随机）
 * - 拒绝采样消除模偏差（Uint32Array % pool.length 在池大小不整除 2^32 时有偏差）
 * - 每类字符集至少出现一个（可选字符集均被过滤后为空时自动跳过）
 */

export const CHAR_SETS: Record<string, { label: string; chars: string }> = {
  upper: { label: "大写字母 A-Z", chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ" },
  lower: { label: "小写字母 a-z", chars: "abcdefghijklmnopqrstuvwxyz" },
  digits: { label: "数字 0-9", chars: "0123456789" },
  symbols: { label: "特殊符号", chars: "!@#$%^&*()_+-=[]{}|;:,.<>?/~`" },
};

export const AMBIGUOUS = "0O1lI";

export interface PasswordOptions {
  length: number;
  upper: boolean;
  lower: boolean;
  digits: boolean;
  symbols: boolean;
  avoidAmbiguous: boolean;
}

/** 拒绝采样：从 [0, limit) 均匀取样（无模偏差） */
function secureRandomInt(limit: number): number {
  if (limit <= 0 || limit > 0x1_0000_0000) {
    throw new RangeError(`limit 超出范围: ${limit}`);
  }
  // 取最大可整除区间，保证均匀
  const max = Math.floor(0x1_0000_0000 / limit) * limit;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < max) {
      return buf[0] % limit;
    }
  }
}

export function generatePassword(opts: PasswordOptions): string {
  const n = Math.max(1, Math.min(128, opts.length));

  // 构建池，每类过滤易混淆字符后非空才启用
  const activeSets: string[] = [];
  let pool = "";
  const candidates: [boolean, string][] = [
    [opts.upper, CHAR_SETS.upper.chars],
    [opts.lower, CHAR_SETS.lower.chars],
    [opts.digits, CHAR_SETS.digits.chars],
    [opts.symbols, CHAR_SETS.symbols.chars],
  ];
  for (const [enabled, chars] of candidates) {
    if (!enabled) continue;
    const cleaned = opts.avoidAmbiguous
      ? [...chars].filter((c) => !AMBIGUOUS.includes(c)).join("")
      : chars;
    if (cleaned) {
      activeSets.push(cleaned);
      pool += cleaned;
    }
  }
  if (!pool) {
    throw new Error("请至少选择一种字符集");
  }

  // 每类至少一个（类别数超过长度时取前 length 类）
  const required = Math.min(activeSets.length, n);
  const result: string[] = [];
  for (let i = 0; i < required; i++) {
    result.push(activeSets[i][secureRandomInt(activeSets[i].length)]);
  }
  for (let i = required; i < n; i++) {
    result.push(pool[secureRandomInt(pool.length)]);
  }

  // Fisher-Yates 洗牌（同样使用安全随机，消除顺序偏差）
  for (let i = result.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result.join("");
}
