/**
 * Cron 表达式解析 + 下次执行时间计算
 *
 * 支持 5 或 6 字段格式：
 *   分钟 小时 日 月 星期 [年]
 *
 * 字段值支持：
 *   *   通配符
 *   5   具体值
 *   1-5 范围
 *   N/5 步长
 *   1,3,5 列表
 */

export interface CronFields {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  year?: string;
  raw: string;
}

/** 解析 cron 字符串为结构化字段 */
export function parseCron(expr: string): CronFields | null {
  const trimmed = expr.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 5 || parts.length > 6) return null;

  // 校验每个字段的合法性
  for (const part of parts) {
    if (!/^[\d\-\*\/,]+$/.test(part)) return null;
  }

  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
    year: parts[5] ?? "*",
    raw: trimmed,
  };
}

/** 判断某个值是否匹配 cron 字段（支持 * / - ,） */
function fieldMatches(field: string, value: number, min: number, max: number): boolean {
  const items = field.split(",");
  for (const item of items) {
    let step = 1;
    let range = item;

    // 提取步长
    const slashIdx = item.indexOf("/");
    if (slashIdx >= 0) {
      range = item.slice(0, slashIdx);
      step = parseInt(item.slice(slashIdx + 1), 10);
      if (isNaN(step) || step < 1) return false;
    }

    if (range === "*") {
      // */step: 从 min 开始每隔 step
      if ((value - min) % step === 0) return true;
      continue;
    }

    // 提取范围
    const dashIdx = range.indexOf("-");
    let start: number, end: number;
    if (dashIdx >= 0) {
      start = parseInt(range.slice(0, dashIdx), 10);
      end = parseInt(range.slice(dashIdx + 1), 10);
    } else {
      start = parseInt(range, 10);
      end = start;
    }

    if (isNaN(start) || isNaN(end)) return false;

    for (let v = start; v <= end; v += step) {
      if (v === value) return true;
    }
  }
  return false;
}

/** 获取某年某月的天数 */
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 计算从给定时间开始的下 N 次匹配 */
export function nextRuns(cron: CronFields, count: number, from?: Date): Date[] {
  const results: Date[] = [];
  const start = from ? new Date(from) : new Date();
  start.setSeconds(0, 0);
  start.setMinutes(start.getMinutes() + 1); // 从下一分钟开始

  const endYear = start.getFullYear() + 5; // 最多搜索 5 年

  for (let y = start.getFullYear(); y <= endYear && results.length < count; y++) {
    if (cron.year && cron.year !== "*") {
      if (!fieldMatches(cron.year, y, 1970, 2099)) continue;
    }

    for (let mo = 1; mo <= 12 && results.length < count; mo++) {
      if (!fieldMatches(cron.month, mo, 1, 12)) continue;

      const maxDay = daysInMonth(y, mo);
      for (let d = 1; d <= maxDay && results.length < count; d++) {
        if (!fieldMatches(cron.dayOfMonth, d, 1, 31)) continue;

        const dow = new Date(y, mo - 1, d).getDay(); // 0=Sun
        if (!fieldMatches(cron.dayOfWeek, dow, 0, 6)) continue;

        for (let h = 0; h <= 23 && results.length < count; h++) {
          if (!fieldMatches(cron.hour, h, 0, 23)) continue;

          for (let mi = 0; mi <= 59 && results.length < count; mi++) {
            if (!fieldMatches(cron.minute, mi, 0, 59)) continue;

            const dt = new Date(y, mo - 1, d, h, mi, 0, 0);
            if (dt > start) {
              results.push(dt);
            }
          }
        }
      }
    }
  }

  return results;
}

/** 单字段人类可读描述 */
function descField(field: string, unit: string): string {
  if (field === "*") return `每${unit}`;
  if (field.includes("/")) {
    const [_, step] = field.split("/");
    return `每${step}${unit}`;
  }
  if (field.includes("-")) {
    const [a, b] = field.split("-");
    return `${unit} ${a}-${b}`;
  }
  if (field.includes(",")) {
    return `${unit} ${field.split(",").join(", ")}`;
  }
  return `${unit} ${field}`;
}

/** 生成人类可读的 cron 描述 */
export function describeCron(fields: CronFields): string {
  const parts: string[] = [];
  parts.push(descField(fields.minute, "分钟"));
  parts.push(descField(fields.hour, "小时"));
  parts.push(descField(fields.dayOfMonth, "日"));
  parts.push(descField(fields.month, "月"));
  parts.push(descField(fields.dayOfWeek, "周"));
  if (fields.year && fields.year !== "*") {
    parts.push(descField(fields.year, "年"));
  }
  return parts.join(", ");
}

/** 字段说明 */
export const FIELD_DOCS = [
  { name: "分钟", range: "0-59", desc: "每小时的第几分钟" },
  { name: "小时", range: "0-23", desc: "每天的第几小时" },
  { name: "日", range: "1-31", desc: "每月的第几天" },
  { name: "月", range: "1-12", desc: "每年的第几月" },
  { name: "星期", range: "0-6", desc: "0=周日, 1=周一…6=周六" },
];

/** 常用预设 */
export const PRESETS = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每5分钟", value: "*/5 * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天零点", value: "0 0 * * *" },
  { label: "每天9点", value: "0 9 * * *" },
  { label: "每周一9点", value: "0 9 * * 1" },
  { label: "每月1日零点", value: "0 0 1 * *" },
  { label: "每季度首日", value: "0 0 1 1,4,7,10 *" },
  { label: "每年1月1日", value: "0 0 1 1 *" },
  { label: "工作日9点", value: "0 9 * * 1-5" },
  { label: "周末10点", value: "0 10 * * 0,6" },
  { label: "每30秒模拟", value: "*/1 * * * *" },
];
