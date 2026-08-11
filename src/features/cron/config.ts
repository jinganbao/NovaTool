import type { CronFieldDefinition, CronPreset, QuartzCronFields } from "./types";

const numericValues = (min: number, max: number, pad = false) =>
  Array.from({ length: max - min + 1 }, (_, index) => {
    const value = min + index;
    return { label: pad ? String(value).padStart(2, "0") : String(value), value };
  });

export const CRON_FIELDS: CronFieldDefinition[] = [
  { key: "second", label: "秒", shortLabel: "秒", min: 0, max: 59, allowed: ", - * /", values: numericValues(0, 59, true) },
  { key: "minute", label: "分钟", shortLabel: "分", min: 0, max: 59, allowed: ", - * /", values: numericValues(0, 59, true) },
  { key: "hour", label: "小时", shortLabel: "时", min: 0, max: 23, allowed: ", - * /", values: numericValues(0, 23, true) },
  { key: "dayOfMonth", label: "日", shortLabel: "日", min: 1, max: 31, allowed: ", - * / ? L W", values: numericValues(1, 31) },
  { key: "month", label: "月份", shortLabel: "月", min: 1, max: 12, allowed: ", - * /", values: numericValues(1, 12) },
  {
    key: "dayOfWeek",
    label: "周（星期）",
    shortLabel: "周",
    min: 1,
    max: 7,
    allowed: ", - * / ? L #",
    values: ["周日", "周一", "周二", "周三", "周四", "周五", "周六"].map((label, index) => ({ label, value: index + 1 })),
  },
  { key: "year", label: "年份", shortLabel: "年", min: 1970, max: 2099, allowed: ", - * /（可选）" },
];

export const DEFAULT_QUARTZ_FIELDS: QuartzCronFields = {
  second: "0",
  minute: "0",
  hour: "9",
  dayOfMonth: "?",
  month: "*",
  dayOfWeek: "2-6",
  year: "*",
};

export const QUARTZ_PRESETS: CronPreset[] = [
  { label: "每分钟", value: "0 * * * * ?" },
  { label: "每 5 分钟", value: "0 0/5 * * * ?" },
  { label: "每小时", value: "0 0 * * * ?" },
  { label: "每天零点", value: "0 0 0 * * ?" },
  { label: "每天 9 点", value: "0 0 9 * * ?" },
  { label: "工作日 9 点", value: "0 0 9 ? * 2-6" },
  { label: "每周一 9 点", value: "0 0 9 ? * 2" },
  { label: "每月 1 日", value: "0 0 0 1 * ?" },
  { label: "每月最后一天", value: "0 0 0 L * ?" },
  { label: "每年元旦", value: "0 0 0 1 1 ?" },
];

