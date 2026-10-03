import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { getStaffSession } from "@/lib/attendance/auth";
import { prisma } from "@/lib/prisma";
import { schoolToday } from "@/lib/attendance/dates";
import { bandLabel, subjectLabel } from "@/lib/attendance/subjects";

// A cookie whose account is gone: clear it, then sign in again.
const SIGNED_OUT = "/api/attendance/auth/logout";

export const metadata = { title: "My groups — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function TeacherGroups() {
  const session = await getStaffSession();
  if (!session) redirect(SIGNED_OUT);

  const today = schoolToday();
  const groups = await prisma.group.findMany({
    where: {
      isActive: true,
      OR: [{ teacherId: session.sub }, { slots: { some: { teacherId: session.sub } } }],
    },
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      grade: true,
      subject: true,
      room: true,
      _count: { select: { enrollments: { where: { endDate: null } } } },
    },
  });

  return (
    <StaffShell role="teacher" name={session.name} active="/attendance/teacher/groups">
      <PageHeading
        title="My groups"
        subtitle="Open a group to take attendance or give marks for any lesson this term."
      />

      {groups.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No groups are assigned to you yet.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/attendance/teacher/groups/${group.id}?date=${today}`}
              className="card transition-colors hover:border-brand"
            >
              <p className="text-lg font-bold text-navy">{group.name}</p>
              <p className="mt-1 text-sm text-slate-500">
                {subjectLabel(group.subject)} · {bandLabel(group.subject, group.grade)}
                {group.room ? ` · Room ${group.room}` : ""}
              </p>
              <p className="mt-3 text-sm font-semibold text-brand-dark">
                {group._count.enrollments} students
              </p>
            </Link>
          ))}
        </div>
      )}
    </StaffShell>
  );
}
