export type DisplayFormat = "plain" | "money" | "duration" | "number";

const MONEY_FORMATTER = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("en-US");

const DATE_TIME_FORMATTER = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDisplayValue(
  value: string | number,
  format: DisplayFormat | undefined,
): string {
  if (format === "money") return MONEY_FORMATTER.format(Number(value));
  if (format === "duration") return formatDuration(Number(value));
  if (format === "number") return NUMBER_FORMATTER.format(Number(value));
  return String(value);
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const remaining = totalSeconds % 60;
  return [hours, minutes, remaining]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : DATE_TIME_FORMATTER.format(date);
}
