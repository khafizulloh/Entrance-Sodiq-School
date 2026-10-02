/**
 * Date helpers for the attendance tracker.
 *
 * All calendar dates are handled as plain "YYYY-MM-DD" strings and stored in
 * Postgres `date` columns (UTC midnight), so a lesson on 3 October is the same
 * day for everyone regardless of the server's timezone.
 *
 * "Now" is always read in the school's timezone (Asia/Tashkent by default) so
 * the current lesson is correct even when the app runs on a server abroad.
 */

export const SCHOOL_TIMEZONE = process.env.SCHOOL_TIMEZONE || "Asia/Tashkent";

export type IsoDate = string; // "YYYY-MM-DD"

/** Current wall-clock date and time at the school. */
export function schoolNow(): {
  date: IsoDate;
  minutes: number; // minutes since midnight
  dayOfWeek: number; // 1 = Monday ... 7 = Sunday
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHOOL_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  const hour = Number(get("hour")) % 24;
  const minute = Number(get("minute"));
  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const dayOfWeek = weekdays.indexOf(get("weekday")) + 1;

  return { date, minutes: hour * 60 + minute, dayOfWeek: dayOfWeek || 1 };
}

/** Today's date at the school, as "YYYY-MM-DD". */
export function schoolToday(): IsoDate {
  return schoolNow().date;
}

/** "YYYY-MM-DD" -> Date at UTC midnight (what Prisma stores in a date column). */
export function toDbDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00.000Z`);
}

/** Date from the database -> "YYYY-MM-DD". */
export function toIsoDate(value: Date | string): IsoDate {
  if (typeof value === "string") return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

/** 1 = Monday ... 7 = Sunday for a plain date string. */
export function dayOfWeekOf(iso: IsoDate): number {
  const js = toDbDate(iso).getUTCDay(); // 0 = Sunday
  return js === 0 ? 7 : js;
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const d = toDbDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIsoDate(d);
}

/** Every date from `from` to `to` inclusive. */
export function dateRange(from: IsoDate, to: IsoDate): IsoDate[] {
  const out: IsoDate[] = [];
  let cursor = from;
  // Guard against runaway loops on a bad range (max ~2 years).
  for (let i = 0; cursor <= to && i < 800; i++) {
    out.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return out;
}

/** Monday–Friday dates only. */
export function weekdaysBetween(from: IsoDate, to: IsoDate): IsoDate[] {
  return dateRange(from, to).filter((d) => dayOfWeekOf(d) <= 5);
}

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek - 1] ?? "";
}

export function shortDayName(dayOfWeek: number): string {
  return (DAY_NAMES[dayOfWeek - 1] ?? "").slice(0, 3);
}

/** "3 Oct" — the compact label used in register column headers. */
export function shortDateLabel(iso: IsoDate): string {
  const d = toDbDate(iso);
  const month = d.toLocaleString("en-GB", { month: "short", timeZone: "UTC" });
  return `${d.getUTCDate()} ${month}`;
}

/** "Friday, 3 October 2026" */
export function longDateLabel(iso: IsoDate): string {
  return toDbDate(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function isValidIsoDate(value: unknown): value is IsoDate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}
