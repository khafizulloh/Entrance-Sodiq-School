import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { TimetableGrid } from "@/components/attendance/TimetableGrid";
import {
  TimetableVersions,
  type VersionRow,
} from "@/components/attendance/TimetableVersions";
import { getStaffSession } from "@/lib/attendance/auth";
import { schoolNow, shortDayName, toIsoDate } from "@/lib/attendance/dates";
import { currentPeriod } from "@/lib/attendance/periods";
import { type ResolvedSlot, listVersions, slotsForDate } from "@/lib/attendance/timetable";
import { prisma } from "@/lib/prisma";

// A cookie whose account is gone: clear it, then sign in again.
const SIGNED_OUT = "/api/attendance/auth/logout";

export const metadata = { title: "Timetable — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadTimetable() {
  const session = await getStaffSession();
  if (!session) redirect(SIGNED_OUT);
  if (session.role !== "head") redirect("/attendance/teacher");

  const now = schoolNow();
  const current = currentPeriod(now.minutes);

  const [versions, slots, pending] = await Promise.all([
    listVersions(),
    slotsForDate(now.date),
    prisma.moveRequest.count({ where: { status: "PENDING" } }),
  ]);

  const week: Record<number, ResolvedSlot[]> = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const slot of slots) week[slot.dayOfWeek]?.push(slot);

  // Periods per week per teacher, with the daily split — the load table.
  const load = new Map<string, { name: string; total: number; days: number[] }>();
  for (const slot of slots) {
    const key = slot.teacherId ?? "unassigned";
    const row =
      load.get(key) ??
      { name: slot.teacherName ?? "No teacher assigned", total: 0, days: [0, 0, 0, 0, 0] };
    row.total++;
    row.days[slot.dayOfWeek - 1]++;
    load.set(key, row);
  }
  const loadRows = [...load.values()].sort((a, b) => b.total - a.total);

  // Versions come back newest first, so the first one that has already
  // started is the one in force today.
  const inForceIndex = versions.findIndex(
    (version) => toIsoDate(version.effectiveFrom) <= now.date,
  );

  const versionRows: VersionRow[] = versions.map((version, index) => ({
    id: version.id,
    name: version.name,
    effectiveFrom: toIsoDate(version.effectiveFrom),
    slotCount: version._count.slots,
    uploadedBy: version.uploadedBy?.fullName ?? null,
    state:
      index === inForceIndex
        ? "in-force"
        : toIsoDate(version.effectiveFrom) > now.date
          ? "later"
          : "replaced",
  }));

  return (
    <StaffShell
      role="head"
      name={session.name}
      active="/attendance/head/timetable"
      pendingMoves={pending}
    >
      <PageHeading
        title="Timetable"
        subtitle="The timetable in force today, and every version you have uploaded."
        action={
          <Link href="/attendance/head/uploads" className="btn-brand">
            Upload a new timetable
          </Link>
        }
      />

      {versions.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No timetable uploaded yet. Add one under{" "}
          <Link href="/attendance/head/uploads" className="font-semibold text-brand-dark">
            Uploads
          </Link>
          .
        </div>
      ) : (
        <>
          <section>
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              Versions
            </h2>
            <TimetableVersions versions={versionRows} />
            <p className="mt-2 text-xs text-slate-500">
              Registers use the version in force on each date, so uploading a new
              timetable never changes attendance that was already taken. Change a
              start date to make lessons appear for earlier dates, for example when
              typing in registers that were kept on paper.
            </p>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              Teacher load this week
            </h2>
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead className="bg-navy text-left text-xs uppercase tracking-wider text-white">
                  <tr>
                    <th className="px-4 py-2.5">Teacher</th>
                    <th className="px-4 py-2.5">Total</th>
                    {[1, 2, 3, 4, 5].map((day) => (
                      <th key={day} className="px-3 py-2.5">
                        {shortDayName(day)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadRows.map((row) => (
                    <tr key={row.name} className="border-t border-slate-100">
                      <td className="px-4 py-2 font-medium text-navy">{row.name}</td>
                      <td className="px-4 py-2 font-bold text-brand-dark">{row.total}</td>
                      {row.days.map((count, index) => (
                        <td
                          key={index}
                          className={`px-3 py-2 ${
                            count >= 7 ? "font-bold text-red-700" : "text-slate-600"
                          }`}
                        >
                          {count || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Days with 7 or more periods are shown in red — a sign the day may need
              rebalancing.
            </p>
          </section>

          <section className="mt-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
              Whole school, this week
            </h2>
            <TimetableGrid
              week={week}
              currentDay={now.dayOfWeek}
              currentPeriod={current?.state === "running" ? current.period.index : null}
              hrefFor={(slot) => `/attendance/head/groups/${slot.groupId}?date=${now.date}&period=${slot.period}`}
              showTeacher
            />
          </section>
        </>
      )}
    </StaffShell>
  );
}
