import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { getStaffSession } from "@/lib/attendance/auth";
import { headDashboard } from "@/lib/attendance/dashboard";
import { longDateLabel } from "@/lib/attendance/dates";
import { periodLabel } from "@/lib/attendance/periods";
import { absenceReport } from "@/lib/attendance/reports";
import { subjectLabel } from "@/lib/attendance/subjects";

export const metadata = { title: "Head teacher dashboard — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadDashboard() {
  const session = await getStaffSession();
  if (!session) redirect("/attendance/login");
  if (session.role !== "head") redirect("/attendance/teacher");

  const [data, topAbsent] = await Promise.all([
    headDashboard(),
    absenceReport({ limit: 5 }),
  ]);

  const live = data.runningNow.length > 0 ? data.runningNow : data.upNext;
  const liveLabel = data.runningNow.length > 0 ? "Classes running now" : "Classes up next";

  return (
    <StaffShell
      role="head"
      name={session.name}
      active="/attendance/head"
      pendingMoves={data.stats.pendingMoves}
    >
      <PageHeading
        title="Head teacher dashboard"
        subtitle={`${longDateLabel(data.now.date)}${
          data.current
            ? ` · period ${data.current.period.index} ${
                data.current.state === "running" ? "now" : "next"
              } (${data.current.period.label})`
            : " · outside school hours"
        }`}
        action={
          data.term ? (
            <span className="rounded-lg bg-navy px-3 py-1.5 text-xs font-semibold text-white">
              {data.term.name}: {data.term.startDate} → {data.term.endDate}
            </span>
          ) : (
            <Link href="/attendance/head/uploads" className="btn-brand">
              Set the term dates
            </Link>
          )
        }
      />

      {/* Numbers at a glance */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Groups" value={data.stats.groupCount} href="/attendance/head/groups" />
        <Stat label="Students" value={data.stats.pupilCount} href="/attendance/head/students" />
        <Stat label="Teachers" value={data.stats.teacherCount} href="/attendance/head/teachers" />
        <Stat
          label="Move requests"
          value={data.stats.pendingMoves}
          href="/attendance/head/moves"
          highlight={data.stats.pendingMoves > 0}
        />
        <Stat label="Lessons today" value={data.stats.lessonsToday} />
        <Stat label="Registers taken" value={`${data.stats.doneToday}/${data.stats.lessonsToday}`} />
      </div>

      {/* What is happening right now */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          {liveLabel}
        </h2>
        {live.length === 0 ? (
          <div className="card text-sm text-slate-600">
            No lessons at this time of day.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {live.map((slot) => {
              const done = slot.recordCount > 0;
              return (
                <Link
                  key={slot.id}
                  href={`/attendance/head/groups/${slot.groupId}?date=${data.now.date}&period=${slot.period}`}
                  className={`rounded-xl border-2 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${
                    data.runningNow.length > 0 ? "border-brand" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold text-navy">{slot.groupName}</span>
                    <span className="rounded-full bg-navy px-2 py-0.5 text-[11px] font-bold text-white">
                      P{slot.period}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {subjectLabel(slot.subject)}
                    {slot.room ? ` · Room ${slot.room}` : ""} · {periodLabel(slot.period)}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {slot.teacherName ?? "No teacher assigned"}
                  </p>
                  <p
                    className={`mt-2 text-xs font-bold ${
                      done ? "text-green-700" : "text-slate-400"
                    }`}
                  >
                    {done
                      ? `✓ ${slot.recordCount}/${slot.rosterCount} recorded`
                      : "register not taken"}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Registers still missing from earlier today */}
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            Registers missing from earlier today
          </h2>
          {data.missingToday.length === 0 ? (
            <div className="card text-sm text-green-700">
              Every lesson so far today has a register. 👍
            </div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
              {data.missingToday.map((slot) => (
                <Link
                  key={slot.id}
                  href={`/attendance/head/groups/${slot.groupId}?date=${data.now.date}&period=${slot.period}`}
                  className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand/5"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-xs font-bold text-red-700">
                    P{slot.period}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">
                      {slot.groupName}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {slot.teacherName ?? "No teacher"}
                    </span>
                  </span>
                  <span className="text-xs font-semibold text-slate-400">open →</span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Most missed classes */}
        <section>
          <div className="mb-2 flex items-end justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Missing the most classes
            </h2>
            <Link
              href="/attendance/head/reports"
              className="text-xs font-semibold text-brand-dark hover:underline"
            >
              Full report →
            </Link>
          </div>
          {topAbsent.length === 0 ? (
            <div className="card text-sm text-slate-600">No absences recorded yet.</div>
          ) : (
            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
              {topAbsent.map((row, index) => (
                <div key={row.pupilId} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="w-5 text-sm font-bold text-slate-300">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-navy">
                      {row.firstName} {row.lastName}
                    </span>
                    <span className="block text-xs text-slate-500">
                      Grade {row.grade}
                      {row.groups.length > 0 ? ` · ${row.groups.join(", ")}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-bold text-red-700">
                      {row.absent}
                    </span>
                    <span className="block text-[11px] text-slate-400">
                      {row.missedPercent}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </StaffShell>
  );
}

function Stat({
  label,
  value,
  href,
  highlight = false,
}: {
  label: string;
  value: number | string;
  href?: string;
  highlight?: boolean;
}) {
  const body = (
    <>
      <span
        className={`block text-2xl font-bold ${highlight ? "text-brand-dark" : "text-navy"}`}
      >
        {value}
      </span>
      <span className="mt-0.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
    </>
  );

  const className = `rounded-xl border bg-white p-4 shadow-sm ${
    highlight ? "border-brand" : "border-slate-200"
  } ${href ? "transition-colors hover:border-brand" : ""}`;

  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
