import bigInt, { type BigInteger } from "big-integer";

export type RadixBase = 2 | 8 | 10 | 16;
export type SourceRadix = "auto" | RadixBase;

export interface RadixOutput {
  base: RadixBase;
  value: string;
}

const PREFIXES: Record<RadixBase, string> = { 2: "0b", 8: "0o", 10: "", 16: "0x" };
const DIGIT_PATTERNS: Record<RadixBase, RegExp> = {
  2: /^[01]+$/,
  8: /^[0-7]+$/,
  10: /^\d+$/,
  16: /^[\da-f]+$/i,
};

function detectBase(value: string): RadixBase {
  if (/^[+-]?0b/i.test(value)) return 2;
  if (/^[+-]?0o/i.test(value)) return 8;
  if (/^[+-]?0x/i.test(value)) return 16;
  return 10;
}

export function parseRadixInteger(input: string, source: SourceRadix): { value: BigInteger; base: RadixBase } {
  let normalized = input.trim().replace(/[\s_]/g, "");
  if (!normalized) throw new Error("请输入需要转换的整数");
  const negative = normalized.startsWith("-");
  const positive = normalized.startsWith("+");
  if (negative || positive) normalized = normalized.slice(1);
  const base = source === "auto" ? detectBase(input.trim()) : source;
  const expectedPrefix = PREFIXES[base];
  if (expectedPrefix && normalized.toLowerCase().startsWith(expectedPrefix)) normalized = normalized.slice(2);
  if (!normalized || !DIGIT_PATTERNS[base].test(normalized)) throw new Error(`输入包含不属于 ${base} 进制的字符`);
  return { value: bigInt(`${negative ? "-" : ""}${normalized}`, base), base };
}

export function convertRadix(
  input: string,
  source: SourceRadix,
  options: { uppercase: boolean; prefix: boolean },
): { detectedBase: RadixBase; outputs: RadixOutput[] } {
  const parsed = parseRadixInteger(input, source);
  const outputs = ([2, 8, 10, 16] as RadixBase[]).map((base) => {
    let digits = parsed.value.abs().toString(base);
    if (options.uppercase) digits = digits.toUpperCase();
    const sign = parsed.value.isNegative() ? "-" : "";
    const prefix = options.prefix ? PREFIXES[base] : "";
    return { base, value: `${sign}${prefix}${digits}` };
  });
  return { detectedBase: parsed.base, outputs };
}

