import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { getStaffSession } from "@/lib/attendance/auth";
import { isValidIsoDate, toIsoDate } from "@/lib/attendance/dates";
import { absenceReport } from "@/lib/attendance/reports";
import { activeTerm } from "@/lib/attendance/timetable";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Reports — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadReports({
  searchParams,
}: {
  searchParams: Promise<{ grade?: string; from?: string; to?: string }>;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/attendance/login");
  if (session.role !== "head") redirect("/attendance/teacher");

  const query = await searchParams;
  const term = await activeTerm();
  const grade = Number(query.grade);

  const from = isValidIsoDate(query.from)
    ? query.from
    : term
      ? toIsoDate(term.startDate)
      : undefined;
  const to = isValidIsoDate(query.to)
    ? query.to
    : term
      ? toIsoDate(term.endDate)
      : undefined;

  const [rows, grades, pending] = await Promise.all([
    absenceReport({
      from,
      to,
      grade: Number.isFinite(grade) && grade > 0 ? grade : undefined,
    }),
    prisma.pupil.findMany({
      where: { isActive: true },
      distinct: ["grade"],
      select: { grade: true },
      orderBy: { grade: "asc" },
    }),
    prisma.moveRequest.count({ where: { status: "PENDING" } }),
  ]);

  const exportQuery = new URLSearchParams();
  if (from) exportQuery.set("from", from);
  if (to) exportQuery.set("to", to);
  if (Number.isFinite(grade) && grade > 0) exportQuery.set("grade", String(grade));

  return (
    <StaffShell
      role="head"
      name={session.name}
      active="/attendance/head/reports"
      pendingMoves={pending}
    >
      <PageHeading
        title="Missing the most classes"
        subtitle={
          from && to
            ? `Absences from ${from} to ${to}, highest first.`
            : "Absences highest first."
        }
        action={
          <a
            href={`/api/attendance/head/reports?${exportQuery.toString()}`}
            className="btn-outline"
          >
            ⬇ Export to Excel
          </a>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label" htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" className="input" defaultValue={from} />
        </div>
        <div>
          <label className="label" htmlFor="to">
            To
          </label>
          <input id="to" name="to" type="date" className="input" defaultValue={to} />
        </div>
        <div>
          <label className="label" htmlFor="grade">
            Grade
          </label>
          <select id="grade" name="grade" className="input" defaultValue={query.grade ?? ""}>
            <option value="">All grades</option>
            {grades.map((row) => (
              <option key={row.grade} value={String(row.grade)}>
                Grade {row.grade}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          Apply
        </button>
      </form>

      {rows.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No absences recorded in this period.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-navy text-left text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-2.5">#</th>
                <th className="px-4 py-2.5">First name</th>
                <th className="px-4 py-2.5">Surname</th>
                <th className="px-4 py-2.5">Grade</th>
                <th className="px-4 py-2.5">Groups</th>
                <th className="px-4 py-2.5 text-right">Absent</th>
                <th className="px-4 py-2.5 text-right">Late</th>
                <th className="px-4 py-2.5 text-right">Excused</th>
                <th className="px-4 py-2.5 text-right">Lessons</th>
                <th className="px-4 py-2.5 text-right">Missed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={row.pupilId} className="border-t border-slate-100">
                  <td className="px-4 py-2 text-slate-400">{index + 1}</td>
                  <td className="px-4 py-2 text-navy">{row.firstName}</td>
                  <td className="px-4 py-2 font-semibold text-navy">{row.lastName}</td>
                  <td className="px-4 py-2 text-slate-600">{row.grade}</td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {row.groups.join(", ") || "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-bold text-red-700">
                    {row.absent}
                  </td>
                  <td className="px-4 py-2 text-right text-amber-700">{row.late || "—"}</td>
                  <td className="px-4 py-2 text-right text-sky-700">{row.excused || "—"}</td>
                  <td className="px-4 py-2 text-right text-slate-600">
                    {row.lessonsRecorded}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-bold ${
                        row.missedPercent >= 25
                          ? "bg-red-100 text-red-700"
                          : row.missedPercent >= 10
                            ? "bg-amber-100 text-amber-800"
                            : "text-slate-500"
                      }`}
                    >
                      {row.missedPercent}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffShell>
  );
}
