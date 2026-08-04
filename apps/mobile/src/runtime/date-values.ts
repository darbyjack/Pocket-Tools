const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})Z$/;

export function isCanonicalDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = DATE_PATTERN.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9_999 || month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

export function isCanonicalDateTime(value: unknown): value is string {
  if (typeof value !== "string" || !DATE_TIME_PATTERN.test(value)) return false;
  const year = Number(value.slice(0, 4));
  if (year < 1 || year > 9_999) return false;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value;
}

export function compareCanonicalTemporalValues(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

export function dateStringToLocalDate(value: string): Date {
  if (!isCanonicalDate(value)) throw new Error(`Invalid canonical date: ${value}`);
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const date = new Date(0);
  date.setFullYear(year, month - 1, day);
  date.setHours(12, 0, 0, 0);
  return date;
}

export function localDateToDateString(value: Date): string {
  if (!Number.isFinite(value.getTime())) throw new Error("Cannot format an invalid date.");
  return `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1, 2)}-${pad(
    value.getDate(),
    2,
  )}`;
}

export function dateTimeStringToDate(value: string): Date {
  if (!isCanonicalDateTime(value)) throw new Error(`Invalid canonical date-time: ${value}`);
  return new Date(value);
}

export function combineLocalDateAndTime(date: Date, time: Date): Date {
  const combined = new Date(date.getTime());
  combined.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
  combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
  return combined;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function pad(value: number, length: number): string {
  return String(value).padStart(length, "0");
}
