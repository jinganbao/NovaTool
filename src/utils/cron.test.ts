import { describe, expect, it } from "vitest";
import { describeCron, nextRuns, parseCron, PRESETS } from "./cron";

describe("parseCron", () => {
  it("解析标准 5 字段", () => {
    const fields = parseCron("*/5 9 * * 1-5");
    expect(fields).not.toBeNull();
    expect(fields!.minute).toBe("*/5");
    expect(fields!.hour).toBe("9");
    expect(fields!.dayOfMonth).toBe("*");
    expect(fields!.month).toBe("*");
    expect(fields!.dayOfWeek).toBe("1-5");
    expect(fields!.year).toBe("*");
  });

  it("解析 6 字段（带年）", () => {
    const fields = parseCron("0 0 1 1 * 2026");
    expect(fields!.year).toBe("2026");
  });

  it("拒绝非法输入", () => {
    expect(parseCron("")).toBeNull();
    expect(parseCron("* * * *")).toBeNull(); // 字段不足
    expect(parseCron("* * * * * * *")).toBeNull(); // 字段过多
    expect(parseCron("a * * * *")).toBeNull(); // 非法字符
    expect(parseCron("60 * * * *")).toBeNull(); // 分钟越界
    expect(parseCron("* 24 * * *")).toBeNull(); // 小时越界
    expect(parseCron("* * 32 * *")).toBeNull(); // 日越界
    expect(parseCron("* * * 13 *")).toBeNull(); // 月越界
    expect(parseCron("* * * * 8")).toBeNull(); // 星期越界(0-7)
    expect(parseCron("* * * * * 1900")).toBeNull(); // 年越界
  });

  it("接受星期 7（标准允许 7=周日）", () => {
    expect(parseCron("0 9 * * 7")).not.toBeNull();
  });
});

describe("nextRuns", () => {
  const from = new Date(2026, 0, 1, 0, 0, 0); // 2026-01-01 00:00

  it("每分钟任务", () => {
    const runs = nextRuns(parseCron("* * * * *")!, 3, from);
    expect(runs.length).toBe(3);
    expect(runs[0].getTime()).toBe(new Date(2026, 0, 1, 0, 1).getTime());
  });

  it("每天 9 点", () => {
    const runs = nextRuns(parseCron("0 9 * * *")!, 2, from);
    expect(runs[0].getTime()).toBe(new Date(2026, 0, 1, 9, 0).getTime());
    expect(runs[1].getTime()).toBe(new Date(2026, 0, 2, 9, 0).getTime());
  });

  it("工作日 9 点跳过周末", () => {
    // 2026-01-01 是周四；1 月 3 日是周六、4 日是周日，应跳过
    const runs = nextRuns(parseCron("0 9 * * 1-5")!, 3, from);
    const weekdays = runs.map((d) => d.getDay());
    expect(weekdays.every((d) => d >= 1 && d <= 5)).toBe(true);
    expect(runs[0].getTime()).toBe(new Date(2026, 0, 1, 9, 0).getTime()); // 周四
    expect(runs[1].getTime()).toBe(new Date(2026, 0, 2, 9, 0).getTime()); // 周五
  });

  it("星期 7 与星期 0 等价（周日的任务可命中）", () => {
    // 2026-01-04 是周日
    const runs7 = nextRuns(parseCron("0 10 * * 7")!, 1, from);
    const runs0 = nextRuns(parseCron("0 10 * * 0")!, 1, from);
    expect(runs7[0].getTime()).toBe(runs0[0].getTime());
    expect(runs7[0].getDay()).toBe(0);
  });

  it("步长与列表", () => {
    const runs = nextRuns(parseCron("*/15 * * * *")!, 2, from);
    expect(runs[0].getMinutes()).toBe(15);
    expect(runs[1].getMinutes()).toBe(30);
  });

  it("指定年份限制", () => {
    // `0 0 1 1 * 2027` 只在 2027 年 1 月 1 日执行一次
    const runs = nextRuns(parseCron("0 0 1 1 * 2027")!, 2, from);
    expect(runs.length).toBe(1);
    expect(runs[0].getFullYear()).toBe(2027);
    expect(runs[0].getMonth()).toBe(0);
    expect(runs[0].getDate()).toBe(1);
  });

  it("月末任务命中 2 月", () => {
    // 2026-02-28 是 2 月最后一天；3 月则 31 日不存在的日子自动跳过
    const runs = nextRuns(parseCron("0 0 31 * *")!, 3, from);
    expect(runs[0].getMonth()).toBe(0); // 1 月 31 日
    expect(runs[1].getMonth()).toBe(2); // 3 月 31 日（2 月无 31 日被跳过）
  });
});

describe("describeCron", () => {
  it("生成人类可读描述", () => {
    const desc = describeCron(parseCron("*/5 9 * * 1-5")!);
    expect(desc).toContain("每5分钟");
    expect(desc).toContain("小时 9");
    expect(desc).toContain("周 1-5");
  });
});

describe("PRESETS", () => {
  it("所有预设均可解析", () => {
    for (const preset of PRESETS) {
      expect(parseCron(preset.value), `${preset.label}: ${preset.value}`).not.toBeNull();
    }
  });
});
