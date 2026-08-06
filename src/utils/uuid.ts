/**
 * UUID 生成器（RFC 9562）
 * v4：随机；v7：时间排序（毫秒时间戳 + 随机）；NIL：全零
 */

function hex(n: number, len: number): string {
  return n.toString(16).padStart(len, "0");
}

/** UUID v4：122 位随机 + 版本 4 + 变体 10 */
export function generateV4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10
  return Array.from(bytes, (b) => hex(b, 2)).join("").replace(
    /^(.{8})(.{4})(.{4})(.{4})(.{12})$/,
    "$1-$2-$3-$4-$5",
  );
}

/** UUID v7：48 位毫秒时间戳 + 版本 7 + 12 位 rand_a + 变体 10 + 62 位 rand_b */
export function generateV7(): string {
  const now = Date.now();
  const rand = new Uint8Array(2);
  crypto.getRandomValues(rand);

  // 48 位毫秒时间戳（RFC 9562 要求毫秒精度）
  const ts = now.toString(16).padStart(12, "0").slice(-12);
  // 12 位 rand_a
  const randA = ((rand[0] << 4) | (rand[1] >> 4)) & 0xfff;
  // 62 位 rand_b，前 2 位置变体 10
  const randB = new Uint8Array(8);
  crypto.getRandomValues(randB);
  randB[0] = (randB[0] & 0x3f) | 0x80;

  return (
    `${ts.slice(0, 8)}-${ts.slice(8)}-7${hex(randA, 3)}-${hex(randB[0], 2)}${hex(randB[1], 2)}-${Array.from(randB.slice(2)).map((b) => hex(b, 2)).join("")}`
  );
}

/** UUID NIL：全零 */
export function generateNil(): string {
  return "00000000-0000-0000-0000-000000000000";
}
