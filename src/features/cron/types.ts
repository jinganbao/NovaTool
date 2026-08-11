export type CronFieldKey =
  | "second"
  | "minute"
  | "hour"
  | "dayOfMonth"
  | "month"
  | "dayOfWeek"
  | "year";

export interface QuartzCronFields {
  second: string;
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
  year: string;
}

export type CronFieldMode =
  | "every"
  | "unspecified"
  | "range"
  | "interval"
  | "specific"
  | "nearestWeekday"
  | "last"
  | "nthWeekday"
  | "lastWeekday";

export interface CronFieldDefinition {
  key: CronFieldKey;
  label: string;
  shortLabel: string;
  min: number;
  max: number;
  allowed: string;
  values?: Array<{ label: string; value: number }>;
}

export interface CronPreset {
  label: string;
  value: string;
}

