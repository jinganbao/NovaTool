import { describe, expect, it } from "vitest";
import {
  dateToTimestampValues,
  detectTimestampUnit,
  formatDateTimeInput,
  formatLocalIso,
  formatLocalRfc2822,
  offsetString,
  parseDateTimeInput,
  parseTimestamp,
} from "./conversion";

// 本地时区格式化依赖运行环境的时区，固定为 Asia/Shanghai 保证测试确定性
process.env.TZ = "Asia/Shanghai";

describe("timestamp precision", () => {
  it("按常见位数识别精度", () => {
    expect(detectTimestampUnit("1700000000")).toBe("s");
    expect(detectTimestampUnit("1700000000000")).toBe("ms");
    expect(detectTimestampUnit("1700000000000000")).toBe("us");
    expect(detectTimestampUnit("1700000000000000000")).toBe("ns");
  });

  it("秒、毫秒、微秒和纳秒解析为同一时刻", () => {
    const values = [
      parseTimestamp("1700000000", "s"),
      parseTimestamp("1700000000000", "ms"),
      parseTimestamp("1700000000000000", "us"),
      parseTimestamp("1700000000000000000", "ns"),
    ];
    expect(new Set(values.map((value) => value.date.getTime()))).toEqual(new Set([1_700_000_000_000]));
  });

  it("支持 1970 年以前的负时间戳", () => {
    expect(parseTimestamp("-1", "s").date.toISOString()).toBe("1969-12-31T23:59:59.000Z");
  });

  it("输出四种常用精度", () => {
    expect(dateToTimestampValues(new Date(1_700_000_000_123))).toEqual({
      seconds: "1700000000",
      milliseconds: "1700000000123",
      microseconds: "1700000000123000",
      nanoseconds: "1700000000123000000",
    });
  });
});

describe("date time input", () => {
  it("按 UTC 语义解析日期", () => {
    const date = parseDateTimeInput("2026-08-11 12:30:45", "utc");
    expect(date.toISOString()).toBe("2026-08-11T12:30:45.000Z");
    expect(formatDateTimeInput(date, "utc")).toBe("2026-08-11 12:30:45.000");
  });

  it("拒绝不存在的日期", () => {
    expect(() => parseDateTimeInput("2026-02-30 12:00:00", "local")).toThrow();
  });
});

describe("local timezone format", () => {
  // 1761944400000 ms = 2025-10-31 21:00:00 UTC = 2025-11-01 05:00:00 (+08:00)
  const date = new Date(1761944400000);

  it("输出本地时区偏移（+08:00）", () => {
    expect(offsetString(date)).toBe("+08:00");
  });

  it("ISO 8601 按本地时区带偏移输出", () => {
    expect(formatLocalIso(date)).toBe("2025-11-01T05:00:00+08:00");
  });

  it("RFC 2822 按本地时区带偏移输出", () => {
    expect(formatLocalRfc2822(date)).toBe("Sat, 01 Nov 2025 05:00:00 +0800");
  });
});
