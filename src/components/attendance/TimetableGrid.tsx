import Link from "next/link";
import { PERIODS } from "@/lib/attendance/periods";
import { dayName, shortDayName } from "@/lib/attendance/dates";
import { subjectLabel } from "@/lib/attendance/subjects";
import type { ResolvedSlot } from "@/lib/attendance/timetable";

/**
 * The weekly timetable: days down the side, periods 1–8 across the top —
 * the way the school's own timetable is laid out.
 *
 * Tapping a lesson opens that group's register. The lesson running now is
 * ringed in Sodiq orange.
 */
export function TimetableGrid({
  week,
  currentDay,
  currentPeriod,
  hrefFor,
  showTeacher = false,
}: {
  week: Record<number, ResolvedSlot[]>;
  currentDay?: number;
  currentPeriod?: number | null;
  hrefFor?: (slot: ResolvedSlot) => string;
  showTeacher?: boolean;
}) {
  const days = [1, 2, 3, 4, 5];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full min-w-[1000px] border-collapse text-sm">
        <thead>
          <tr className="bg-navy text-white">
            <th className="sticky left-0 z-10 w-24 bg-navy px-2 py-2 text-left text-xs font-semibold uppercase tracking-wider">
              Day
            </th>
            {PERIODS.map((period) => (
              <th
                key={period.index}
                className={`px-2 py-2 text-left text-xs font-semibold ${
                  period.index === currentPeriod ? "bg-navy-light text-brand" : ""
                }`}
              >
                <span className="block uppercase tracking-wider">
                  Period {period.index}
                </span>
                <span className="block text-[10px] font-medium opacity-75">
                  {period.label}
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {days.map((day) => (
            <tr key={day} className="border-t border-slate-100">
              <th
                className={`sticky left-0 z-10 px-2 py-2 text-left align-top ${
                  day === currentDay ? "bg-brand/15" : "bg-slate-50"
                }`}
              >
                <span className="block text-sm font-bold text-navy">
                  <span className="hidden sm:inline">{dayName(day)}</span>
                  <span className="sm:hidden">{shortDayName(day)}</span>
                </span>
                {day === currentDay && (
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-dark">
                    Today
                  </span>
                )}
              </th>

              {PERIODS.map((period) => {
                const slots = (week[day] ?? []).filter(
                  (slot) => slot.period === period.index,
                );
                const isNow = day === currentDay && period.index === currentPeriod;

                return (
                  <td
                    key={period.index}
                    className={`px-1.5 py-1.5 align-top ${
                      day === currentDay || period.index === currentPeriod
                        ? "bg-brand/5"
                        : ""
                    }`}
                  >
                    {slots.length === 0 ? (
                      <span className="block py-1 text-center text-xs text-slate-300">—</span>
                    ) : (
                      <div className="space-y-1">
                        {slots.map((slot) => {
                          const body = (
                            <>
                              <span className="block text-sm font-semibold leading-tight">
                                {slot.groupName}
                              </span>
                              <span className="block text-[11px] text-slate-500">
                                {subjectLabel(slot.subject)}
                                {slot.room ? ` · ${slot.room}` : ""}
                              </span>
                              {showTeacher && slot.teacherName && (
                                <span className="block text-[11px] text-slate-400">
                                  {slot.teacherName}
                                </span>
                              )}
                            </>
                          );

                          const className = `block rounded-lg border px-2 py-1.5 text-navy transition-colors ${
                            isNow
                              ? "border-brand bg-brand/15 ring-2 ring-brand"
                              : "border-slate-200 bg-slate-50 hover:border-brand hover:bg-brand/10"
                          }`;

                          return hrefFor ? (
                            <Link key={slot.id} href={hrefFor(slot)} className={className}>
                              {body}
                            </Link>
                          ) : (
                            <div key={slot.id} className={className}>
                              {body}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
