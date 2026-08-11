import { describe, expect, it } from "vitest";
import {
  dateToTimestampValues,
  detectTimestampUnit,
  formatDateTimeInput,
  parseDateTimeInput,
  parseTimestamp,
} from "./conversion";

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
