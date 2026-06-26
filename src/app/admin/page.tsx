import { AdminShell } from "@/components/admin/AdminShell";
import { getDashboardStats } from "@/lib/stats";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard — Sodiq Admin" };

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  const cards = [
    { label: "Students Tested", value: stats.totalSubmissions },
    { label: "Unique Students", value: stats.totalStudents },
    { label: "Average Score", value: `${stats.avgPercentage}%` },
    { label: "Highest Score", value: `${stats.maxPercentage}%` },
    { label: "Lowest Score", value: `${stats.minPercentage}%` },
  ];

  const maxGrade = Math.max(1, ...stats.byGrade.map((g) => g.count));
  const maxLevel = Math.max(1, ...stats.byLevel.map((l) => l.count));

  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-navy">Dashboard</h1>
      <p className="text-sm text-slate-500">Overview of entrance test results.</p>

      {/* Summary cards */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-navy">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Students by grade */}
        <div className="card">
          <h2 className="font-semibold text-navy">Students by Grade</h2>
          {stats.byGrade.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No submissions yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {stats.byGrade.map((g) => (
                <div key={g.grade} className="flex items-center gap-3">
                  <span className="w-16 text-sm text-slate-600">
                    Grade {g.grade}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-navy"
                      style={{ width: `${(g.count / maxGrade) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-navy">
                    {g.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Students by level */}
        <div className="card">
          <h2 className="font-semibold text-navy">Students by Level</h2>
          {stats.byLevel.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">No submissions yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {stats.byLevel.map((l) => (
                <div key={l.level} className="flex items-center gap-3">
                  <span className="w-44 truncate text-sm text-slate-600">
                    {l.level}
                  </span>
                  <div className="h-5 flex-1 overflow-hidden rounded bg-slate-100">
                    <div
                      className="h-full rounded bg-brand"
                      style={{ width: `${(l.count / maxLevel) * 100}%` }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-medium text-navy">
                    {l.count}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminShell>
  );
}
