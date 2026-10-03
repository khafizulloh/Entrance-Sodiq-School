import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { TeacherAccounts, type StaffRow } from "@/components/attendance/TeacherAccounts";
import { getStaffSession } from "@/lib/attendance/auth";
import { prisma } from "@/lib/prisma";

// A cookie whose account is gone: clear it, then sign in again.
const SIGNED_OUT = "/api/attendance/auth/logout";

export const metadata = { title: "Teachers — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadTeachers() {
  const session = await getStaffSession();
  if (!session) redirect(SIGNED_OUT);
  if (session.role !== "head") redirect("/attendance/teacher");

  const [staff, pending] = await Promise.all([
    prisma.staff.findMany({
      orderBy: [{ role: "asc" }, { fullName: "asc" }],
      select: {
        id: true,
        loginId: true,
        fullName: true,
        role: true,
        isActive: true,
        _count: { select: { groups: true } },
      },
    }),
    prisma.moveRequest.count({ where: { status: "PENDING" } }),
  ]);

  const rows: StaffRow[] = staff.map((member) => ({
    id: member.id,
    loginId: member.loginId,
    fullName: member.fullName,
    role: member.role,
    isActive: member.isActive,
    groupCount: member._count.groups,
  }));

  return (
    <StaffShell
      role="head"
      name={session.name}
      active="/attendance/head/teachers"
      pendingMoves={pending}
    >
      <PageHeading
        title="Teachers"
        subtitle="Create accounts and change a login id or password whenever you need to."
      />
      <TeacherAccounts staff={rows} />
    </StaffShell>
  );
}
