export type TimestampUnit = "s" | "ms" | "us" | "ns";
export type TimestampUnitOption = "auto" | TimestampUnit;
export type DateTimeMode = "local" | "utc";

export interface ParsedTimestamp {
  date: Date;
  unit: TimestampUnit;
}

export interface TimestampValues {
  seconds: string;
  milliseconds: string;
  microseconds: string;
  nanoseconds: string;
}

const UNIT_DIVISORS: Record<TimestampUnit, bigint> = {
  s: 1n,
  ms: 1_000n,
  us: 1_000_000n,
  ns: 1_000_000_000n,
};

const MAX_DATE_MS = 8_640_000_000_000_000n;

export function pad(value: number, width = 2): string {
  return String(value).padStart(width, "0");
}

export function detectTimestampUnit(input: string): TimestampUnit {
  const digits = input.replace(/^[+-]/, "").replace(/^0+/, "").length || 1;
  if (digits <= 10) return "s";
  if (digits <= 13) return "ms";
  if (digits <= 16) return "us";
  return "ns";
}

export function parseTimestamp(input: string, selectedUnit: TimestampUnitOption): ParsedTimestamp {
  const raw = input.trim();
  if (!/^[+-]?\d+$/.test(raw)) throw new Error("请输入整数时间戳");

  const unit = selectedUnit === "auto" ? detectTimestampUnit(raw) : selectedUnit;
  const value = BigInt(raw);
  const milliseconds = (value * 1_000n) / UNIT_DIVISORS[unit];
  if (milliseconds > MAX_DATE_MS || milliseconds < -MAX_DATE_MS) {
    throw new Error("时间戳超出 JavaScript 日期范围");
  }

  const date = new Date(Number(milliseconds));
  if (Number.isNaN(date.getTime())) throw new Error("无法解析该时间戳");
  return { date, unit };
}

export function dateToTimestampValues(date: Date): TimestampValues {
  const milliseconds = BigInt(date.getTime());
  return {
    seconds: String(Math.floor(date.getTime() / 1000)),
    milliseconds: String(milliseconds),
    microseconds: String(milliseconds * 1_000n),
    nanoseconds: String(milliseconds * 1_000_000n),
  };
}

export function formatLocalDate(date: Date, includeMilliseconds = true): string {
  const datePart = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const timePart = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${datePart} ${timePart}${includeMilliseconds ? `.${pad(date.getMilliseconds(), 3)}` : ""}`;
}

export function formatUtcDate(date: Date, includeMilliseconds = true): string {
  const datePart = `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  const timePart = `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
  return `${datePart} ${timePart}${includeMilliseconds ? `.${pad(date.getUTCMilliseconds(), 3)}` : ""} UTC`;
}

export function formatOffset(date: Date): string {
  const offset = -date.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const absolute = Math.abs(offset);
  return `UTC${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

export function formatDateTimeInput(date: Date, mode: DateTimeMode): string {
  const year = mode === "utc" ? date.getUTCFullYear() : date.getFullYear();
  const month = mode === "utc" ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = mode === "utc" ? date.getUTCDate() : date.getDate();
  const hour = mode === "utc" ? date.getUTCHours() : date.getHours();
  const minute = mode === "utc" ? date.getUTCMinutes() : date.getMinutes();
  const second = mode === "utc" ? date.getUTCSeconds() : date.getSeconds();
  const milliseconds = mode === "utc" ? date.getUTCMilliseconds() : date.getMilliseconds();
  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}.${pad(milliseconds, 3)}`;
}

export function parseDateTimeInput(input: string, mode: DateTimeMode): Date {
  const match = input.trim().match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/);
  if (!match) throw new Error("日期格式应为 YYYY-MM-DD HH:mm:ss");
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, millisecondsText = "0"] = match;
  const values = [yearText, monthText, dayText, hourText, minuteText, secondText].map(Number);
  const [year, month, day, hour, minute, second] = values;
  const milliseconds = Number(millisecondsText.padEnd(3, "0"));
  const time = mode === "utc"
    ? Date.UTC(year, month - 1, day, hour, minute, second, milliseconds)
    : new Date(year, month - 1, day, hour, minute, second, milliseconds).getTime();
  const date = new Date(time);
  const actual = mode === "utc"
    ? [date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()]
    : [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds()];
  if (actual.some((value, index) => value !== values[index])) throw new Error("日期或时间超出有效范围");
  return date;
}

export function weekdayText(date: Date): string {
  return ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][date.getDay()];
}

export function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const current = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((current - start) / 86_400_000);
}
