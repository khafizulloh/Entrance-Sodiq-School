import Link from "next/link";
import { redirect } from "next/navigation";
import { GroupTeacherPicker } from "@/components/attendance/GroupTeacherPicker";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { getStaffSession } from "@/lib/attendance/auth";
import { schoolToday } from "@/lib/attendance/dates";
import { subjectLabel } from "@/lib/attendance/subjects";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Groups — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadGroups() {
  const session = await getStaffSession();
  if (!session) redirect("/attendance/login");
  if (session.role !== "head") redirect("/attendance/teacher");

  const [groups, teachers, pending] = await Promise.all([
    prisma.group.findMany({
      orderBy: [{ grade: "asc" }, { subject: "asc" }, { name: "asc" }],
      include: {
        teacher: { select: { fullName: true } },
        _count: {
          select: {
            enrollments: { where: { endDate: null } },
            slots: true,
          },
        },
      },
    }),
    prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.moveRequest.count({ where: { status: "PENDING" } }),
  ]);

  const today = schoolToday();
  const byGrade = new Map<number, typeof groups>();
  for (const group of groups) {
    const list = byGrade.get(group.grade) ?? [];
    list.push(group);
    byGrade.set(group.grade, list);
  }

  return (
    <StaffShell
      role="head"
      name={session.name}
      active="/attendance/head/groups"
      pendingMoves={pending}
    >
      <PageHeading
        title="Groups"
        subtitle="Every group, its teacher and its size. Open one to see or fix its register."
        action={
          <Link href="/attendance/head/uploads" className="btn-outline">
            Upload group list
          </Link>
        }
      />

      {groups.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No groups yet. Upload the group list under{" "}
          <Link href="/attendance/head/uploads" className="font-semibold text-brand-dark">
            Uploads
          </Link>
          .
        </div>
      ) : (
        <div className="space-y-6">
          {[...byGrade.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([grade, list]) => (
              <section key={grade}>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
                  Grade {grade}
                </h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {list.map((group) => (
                    <div
                      key={group.id}
                      className={`rounded-xl border bg-white p-4 shadow-sm ${
                        group.teacherId ? "border-slate-200" : "border-amber-300"
                      }`}
                    >
                      <Link
                        href={`/attendance/head/groups/${group.id}?date=${today}`}
                        className="block transition-colors hover:text-brand-dark"
                      >
                        <p className="text-base font-bold text-navy">{group.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {subjectLabel(group.subject)}
                          {group.room ? ` · Room ${group.room}` : " · no room"}
                        </p>
                        <p className="mt-2 text-xs text-slate-500">
                          {group._count.enrollments} students · {group._count.slots}{" "}
                          timetabled lessons
                        </p>
                        <p className="mt-1 text-xs font-semibold text-brand-dark">
                          Open register →
                        </p>
                      </Link>

                      <GroupTeacherPicker
                        groupId={group.id}
                        teacherId={group.teacherId}
                        teachers={teachers}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </StaffShell>
  );
}
