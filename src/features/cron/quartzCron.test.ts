import { describe, expect, it } from "vitest";
import { fieldsToExpression, nextQuartzRuns, parseQuartzCron } from "./quartzCron";

describe("parseQuartzCron", () => {
  it("解析标准 Quartz 6 字段表达式", () => {
    const result = parseQuartzCron("0 0 9 ? * 2-6");
    expect(result.error).toBe("");
    expect(result.fields).toMatchObject({
      second: "0",
      minute: "0",
      hour: "9",
      dayOfMonth: "?",
      month: "*",
      dayOfWeek: "2-6",
      year: "*",
    });
  });

  it("解析带年份的 7 字段表达式", () => {
    const result = parseQuartzCron("0 0 0 1 1 ? 2028");
    expect(result.fields?.year).toBe("2028");
    expect(fieldsToExpression(result.fields!, true)).toBe("0 0 0 1 1 ? 2028");
  });

  it("拒绝 Unix 5 字段和不明确的日期字段", () => {
    expect(parseQuartzCron("0 9 * * 1-5").fields).toBeNull();
    expect(parseQuartzCron("0 0 9 * * *").fields).toBeNull();
    expect(parseQuartzCron("0 0 9 ? * ?").fields).toBeNull();
  });

  it("支持 Quartz 日期特殊字符", () => {
    expect(parseQuartzCron("0 0 0 L * ?").fields).not.toBeNull();
    expect(parseQuartzCron("0 0 0 15W * ?").fields).not.toBeNull();
    expect(parseQuartzCron("0 0 0 ? * 2#1").fields).not.toBeNull();
    expect(parseQuartzCron("0 0 0 ? * 6L").fields).not.toBeNull();
    expect(parseQuartzCron("0 0 0 ? * */2").fields).not.toBeNull();
  });
});

describe("nextQuartzRuns", () => {
  it("秒字段参与计算", () => {
    const fields = parseQuartzCron("*/10 * * * * ?").fields!;
    const runs = nextQuartzRuns(fields, 2, new Date(2026, 0, 1, 0, 0, 1));
    expect(runs[0].getTime()).toBe(new Date(2026, 0, 1, 0, 0, 10).getTime());
    expect(runs[1].getTime()).toBe(new Date(2026, 0, 1, 0, 0, 20).getTime());
  });

  it("按 Quartz 规则将星期 2 解释为周一", () => {
    const fields = parseQuartzCron("0 0 9 ? * 2").fields!;
    const run = nextQuartzRuns(fields, 1, new Date(2026, 0, 2, 0, 0, 0))[0];
    expect(run.getDay()).toBe(1);
    expect(run.getDate()).toBe(5);
  });

  it("计算每月最后一天", () => {
    const fields = parseQuartzCron("0 0 0 L * ?").fields!;
    const run = nextQuartzRuns(fields, 1, new Date(2026, 1, 1))[0];
    expect(run.getMonth()).toBe(1);
    expect(run.getDate()).toBe(28);
  });

  it("计算最近工作日", () => {
    const fields = parseQuartzCron("0 0 9 15W * ?").fields!;
    const run = nextQuartzRuns(fields, 1, new Date(2026, 7, 1))[0];
    expect(run.getMonth()).toBe(7);
    expect(run.getDate()).toBe(14);
    expect(run.getDay()).toBe(5);
  });

  it("计算本月第一个周一", () => {
    const fields = parseQuartzCron("0 0 9 ? * 2#1").fields!;
    const run = nextQuartzRuns(fields, 1, new Date(2026, 7, 1))[0];
    expect(run.getMonth()).toBe(7);
    expect(run.getDate()).toBe(3);
    expect(run.getDay()).toBe(1);
  });

  it("过滤可选年份", () => {
    const fields = parseQuartzCron("0 0 0 1 1 ? 2028").fields!;
    const runs = nextQuartzRuns(fields, 2, new Date(2026, 0, 1));
    expect(runs).toHaveLength(1);
    expect(runs[0].getFullYear()).toBe(2028);
  });
});
