import { CronExpressionParser } from "cron-parser";
import type { QuartzCronFields } from "./types";

export interface QuartzParseResult {
  fields: QuartzCronFields | null;
  error: string;
}

const FIELD_KEYS: Array<keyof QuartzCronFields> = [
  "second",
  "minute",
  "hour",
  "dayOfMonth",
  "month",
  "dayOfWeek",
  "year",
];

export function fieldsToExpression(fields: QuartzCronFields, includeYear = fields.year !== "*"): string {
  const values = FIELD_KEYS.map((key) => fields[key]);
  return (includeYear ? values : values.slice(0, 6)).join(" ");
}

function quartzWeekdayToUnix(value: number): number {
  return value - 1;
}

function transformWeekdayPart(part: string): string {
  if (part === "*" || part === "?") return "*";

  const nthMatch = part.match(/^(\d)#([1-5])$/);
  if (nthMatch) return `${quartzWeekdayToUnix(Number(nthMatch[1]))}#${nthMatch[2]}`;

  const lastMatch = part.match(/^(\d)L$/);
  if (lastMatch) return `${quartzWeekdayToUnix(Number(lastMatch[1]))}L`;

  const [base, step] = part.split("/");
  const transformedBase = base === "*"
    ? "*"
    : base.includes("-")
      ? base.split("-").map((value) => quartzWeekdayToUnix(Number(value))).join("-")
      : String(quartzWeekdayToUnix(Number(base)));
  return step ? `${transformedBase}/${step}` : transformedBase;
}

function transformWeekday(field: string): string {
  return field.split(",").map(transformWeekdayPart).join(",");
}

function yearMatches(field: string, year: number): boolean {
  if (field === "*" || field === "") return true;
  return field.split(",").some((item) => {
    const [base, stepText] = item.split("/");
    const step = stepText ? Number(stepText) : 1;
    if (!Number.isInteger(step) || step < 1) return false;
    if (base === "*") return (year - 1970) % step === 0;
    const [startText, endText = startText] = base.split("-");
    const start = Number(startText);
    const end = Number(endText);
    return year >= start && year <= end && (year - start) % step === 0;
  });
}

function validateYear(field: string): boolean {
  if (field === "*" || field === "") return true;
  if (!/^[\d*,/-]+$/.test(field)) return false;
  const numbers = field.match(/\d+/g)?.map(Number) ?? [];
  return numbers.every((value, index) => {
    if (field.includes("/") && index === numbers.length - 1) return value > 0;
    return value >= 1970 && value <= 2099;
  });
}

function nearestWeekday(year: number, month: number, requestedDay: number): number {
  const lastDay = new Date(year, month, 0).getDate();
  const day = Math.min(requestedDay, lastDay);
  const weekday = new Date(year, month - 1, day).getDay();
  if (weekday === 6) return day === 1 ? 3 : day - 1;
  if (weekday === 0) return day === lastDay ? day - 2 : day + 1;
  return day;
}

function parserDayOfMonth(field: string): { value: string; nearestDay: number | null } {
  const match = field.match(/^(\d{1,2})W$/);
  if (!match) return { value: field === "?" ? "*" : field, nearestDay: null };
  const day = Number(match[1]);
  const candidates = [day - 2, day - 1, day, day + 1, day + 2]
    .filter((value) => value >= 1 && value <= 31)
    .join(",");
  return { value: candidates, nearestDay: day };
}

function toParserExpression(fields: QuartzCronFields): { expression: string; nearestDay: number | null } {
  const day = parserDayOfMonth(fields.dayOfMonth);
  return {
    expression: [
      fields.second,
      fields.minute,
      fields.hour,
      day.value,
      fields.month,
      transformWeekday(fields.dayOfWeek),
    ].join(" "),
    nearestDay: day.nearestDay,
  };
}

export function parseQuartzCron(expression: string): QuartzParseResult {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 6 && parts.length !== 7) {
    return { fields: null, error: "Quartz Cron 需要 6 个字段，可选第 7 个年份字段" };
  }

  const fields: QuartzCronFields = {
    second: parts[0],
    minute: parts[1],
    hour: parts[2],
    dayOfMonth: parts[3],
    month: parts[4],
    dayOfWeek: parts[5],
    year: parts[6] ?? "*",
  };

  const unspecifiedCount = [fields.dayOfMonth, fields.dayOfWeek].filter((value) => value === "?").length;
  if (unspecifiedCount !== 1) {
    return { fields: null, error: "日和星期必须有且仅有一个使用 ?（不指定）" };
  }
  if (!validateYear(fields.year)) {
    return { fields: null, error: "年份范围应为 1970-2099" };
  }

  const weekdayNumbers = fields.dayOfWeek.match(/\d+/g)?.map(Number) ?? [];
  if (fields.dayOfWeek !== "?" && weekdayNumbers.some((value, index) => {
    if (fields.dayOfWeek.includes("#") && index === weekdayNumbers.length - 1) return value < 1 || value > 5;
    return value < 1 || value > 7;
  })) {
    return { fields: null, error: "星期范围应为 1-7（1 表示周日）" };
  }

  const workdayMatch = fields.dayOfMonth.match(/^(\d{1,2})W$/);
  if (workdayMatch && (Number(workdayMatch[1]) < 1 || Number(workdayMatch[1]) > 31)) {
    return { fields: null, error: "最近工作日范围应为 1W-31W" };
  }

  try {
    CronExpressionParser.parse(toParserExpression(fields).expression);
    return { fields, error: "" };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "字段格式错误";
    return { fields: null, error: `表达式无效：${detail}` };
  }
}

export function nextQuartzRuns(fields: QuartzCronFields, count: number, from = new Date()): Date[] {
  const parser = toParserExpression(fields);
  let currentDate = new Date(from);
  const firstYear = Array.from({ length: 2100 - currentDate.getFullYear() }, (_, index) => currentDate.getFullYear() + index)
    .find((year) => yearMatches(fields.year, year));
  if (firstYear === undefined) return [];
  if (firstYear > currentDate.getFullYear()) currentDate = new Date(firstYear - 1, 11, 31, 23, 59, 59);

  const interval = CronExpressionParser.parse(parser.expression, { currentDate });
  const results: Date[] = [];
  const limit = 100_000;
  for (let index = 0; index < limit && results.length < count; index += 1) {
    const date = interval.next().toDate();
    if (date.getFullYear() > 2099) break;
    if (!yearMatches(fields.year, date.getFullYear())) continue;
    if (parser.nearestDay !== null) {
      const expected = nearestWeekday(date.getFullYear(), date.getMonth() + 1, parser.nearestDay);
      if (date.getDate() !== expected) continue;
    }
    results.push(date);
  }
  return results;
}

export function describeQuartzCron(fields: QuartzCronFields): string {
  const time = `${fields.hour.padStart(2, "0")}:${fields.minute.padStart(2, "0")}:${fields.second.padStart(2, "0")}`;
  if (fields.dayOfMonth === "*" && fields.dayOfWeek === "?") return `每天 ${time} 执行`;
  if (fields.dayOfMonth === "L") return `每月最后一天 ${time} 执行`;
  if (/^\d+W$/.test(fields.dayOfMonth)) return `每月 ${fields.dayOfMonth.slice(0, -1)} 日最近的工作日 ${time} 执行`;
  if (fields.dayOfWeek !== "?") return `在星期字段 ${fields.dayOfWeek} 匹配时，于 ${time} 执行`;
  return `在日期字段 ${fields.dayOfMonth} 匹配时，于 ${time} 执行`;
}
