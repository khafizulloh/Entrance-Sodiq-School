/**
 * The Sodiq School bell schedule: 8 periods a day, 09:00–16:05, Monday–Friday.
 *
 * Lunch is not a timetabled period:
 *   - Grades 5–9 have no English in period 5 (12:40–13:20) — that is their lunch.
 *   - Grades 10–11 have no lesson in period 6 (13:35–14:15) — that is their lunch.
 */

export type Period = {
  index: number; // 1..8
  start: number; // minutes since midnight
  end: number;
  label: string; // "09:00–09:40"
};

function minutes(h: number, m: number) {
  return h * 60 + m;
}

function fmt(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const RAW: Array<[number, number, number, number]> = [
  [9, 0, 9, 40],
  [9, 50, 10, 30],
  [10, 50, 11, 30],
  [11, 45, 12, 25],
  [12, 40, 13, 20],
  [13, 35, 14, 15],
  [14, 30, 15, 10],
  [15, 25, 16, 5],
];

export const PERIODS: Period[] = RAW.map(([sh, sm, eh, em], i) => {
  const start = minutes(sh, sm);
  const end = minutes(eh, em);
  return { index: i + 1, start, end, label: `${fmt(start)}–${fmt(end)}` };
});

export const PERIOD_COUNT = PERIODS.length;

export function periodById(index: number): Period | undefined {
  return PERIODS[index - 1];
}

export function periodLabel(index: number): string {
  return periodById(index)?.label ?? "";
}

/** Lunch period for a grade: period 5 for grades 5–9, period 6 for 10–11. */
export function lunchPeriodForGrade(grade: number): number {
  return grade >= 10 ? 6 : 5;
}

/**
 * The period that is running now, or the next one if we are in a break.
 * Returns `null` outside school hours.
 */
export function currentPeriod(nowMinutes: number): {
  period: Period;
  state: "running" | "upcoming";
} | null {
  for (const period of PERIODS) {
    if (nowMinutes >= period.start && nowMinutes <= period.end) {
      return { period, state: "running" };
    }
  }
  const next = PERIODS.find((p) => p.start > nowMinutes);
  return next ? { period: next, state: "upcoming" } : null;
}
