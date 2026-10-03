import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { TimetableGrid } from "@/components/attendance/TimetableGrid";
import { getStaffSession } from "@/lib/attendance/auth";
import { teacherDashboard } from "@/lib/attendance/dashboard";
import { longDateLabel } from "@/lib/attendance/dates";
import { periodLabel } from "@/lib/attendance/periods";
import { bandLabel, subjectLabel } from "@/lib/attendance/subjects";
import type { ResolvedSlot } from "@/lib/attendance/timetable";

// A cookie whose account is gone: clear it, then sign in again.
const SIGNED_OUT = "/api/attendance/auth/logout";

export const metadata = { title: "Teacher dashboard — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

function registerHref(groupId: string, date: string, period?: number) {
  const query = new URLSearchParams({ date });
  if (period) query.set("period", String(period));
  return `/attendance/teacher/groups/${groupId}?${query.toString()}`;
}

export default async function TeacherDashboard() {
  const session = await getStaffSession();
  if (!session) redirect(SIGNED_OUT);

  const data = await teacherDashboard(session.sub);
  const week: Record<number, ResolvedSlot[]> = {};
  for (const [day, slots] of data.week) week[day] = slots;

  const lesson = data.currentLesson;
  const firstName = session.name.split(" ").slice(-1)[0] || session.name;

  return (
    <StaffShell role="teacher" name={session.name} active="/attendance/teacher">
      <PageHeading
        title={`Hello, ${firstName}`}
        subtitle={longDateLabel(data.now.date)}
      />

      {/* Current (or next) lesson — the thing a teacher needs on arrival. */}
      {lesson ? (
        <Link
          href={registerHref(lesson.groupId, data.now.date, lesson.period)}
          className="block rounded-xl border-2 border-brand bg-gradient-to-br from-brand/15 to-white p-5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-navy-dark">
              {lesson.isNow ? "Lesson now" : "Up next"}
            </span>
            <span className="text-sm font-medium text-slate-600">
              Period {lesson.period} · {periodLabel(lesson.period)}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-2xl font-bold text-navy">{lesson.groupName}</p>
              <p className="text-sm text-slate-600">
                {subjectLabel(lesson.subject)}
                {lesson.room ? ` · Room ${lesson.room}` : ""} · {lesson.rosterCount} students
              </p>
            </div>
            <div className="text-right">
              {lesson.recordCount > 0 ? (
                <span className="text-sm font-semibold text-green-700">
                  ✓ Attendance taken ({lesson.recordCount}/{lesson.rosterCount})
                </span>
              ) : (
                <span className="text-sm font-semibold text-navy">
                  Tap to take attendance →
                </span>
              )}
            </div>
          </div>
        </Link>
      ) : (
        <div className="card">
          <p className="text-sm text-slate-600">
            {data.today.length === 0
              ? "You have no lessons on the timetable today."
              : "Your lessons for today are finished."}
          </p>
        </div>
      )}

      {/* Today, period by period */}
      {data.today.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            Today · {data.today.length} lesson{data.today.length === 1 ? "" : "s"}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.today.map((item) => {
              const done = item.recordCount > 0;
              return (
                <Link
                  key={`${item.groupId}-${item.period}`}
                  href={registerHref(item.groupId, data.now.date, item.period)}
                  className={`flex items-center gap-3 rounded-xl border bg-white p-3 shadow-sm transition-colors hover:border-brand ${
                    item.isNow ? "border-brand ring-1 ring-brand" : "border-slate-200"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                      item.isNow ? "bg-brand text-navy-dark" : "bg-navy/5 text-navy"
                    }`}
                  >
                    {item.period}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">
                      {item.groupName}
                    </span>
                    <span className="block text-[11px] text-slate-500">
                      {periodLabel(item.period)}
                      {item.room ? ` · ${item.room}` : ""}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 text-[11px] font-bold ${
                      done ? "text-green-700" : "text-slate-400"
                    }`}
                  >
                    {done ? `${item.recordCount}/${item.rosterCount}` : "not taken"}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* The week */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          My timetable
        </h2>
        {Object.values(week).every((slots) => slots.length === 0) ? (
          <div className="card text-sm text-slate-600">
            No timetable has been uploaded for you yet. The head teacher uploads it under
            Uploads → Timetable.
          </div>
        ) : (
          <TimetableGrid
            week={week}
            currentDay={data.now.dayOfWeek}
            currentPeriod={
              data.current?.state === "running" ? data.current.period.index : null
            }
            hrefFor={(slot) => registerHref(slot.groupId, data.now.date, slot.period)}
          />
        )}
      </section>

      {/* My groups */}
      {data.groups.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            My groups
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {data.groups.map((group) => (
              <Link
                key={group.id}
                href={registerHref(group.id, data.now.date)}
                className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-colors hover:border-brand"
              >
                <span className="block text-sm font-semibold text-navy">{group.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {subjectLabel(group.subject)} ·{" "}
                  {bandLabel(group.subject, group.grade)}
                  {group.room ? ` · ${group.room}` : ""}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </StaffShell>
  );
}
