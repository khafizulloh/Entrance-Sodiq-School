import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import {
  StudentDirectory,
  type StudentRow,
} from "@/components/attendance/StudentDirectory";
import type { MoveTarget } from "@/components/attendance/MoveRequestDialog";
import { getStaffSession } from "@/lib/attendance/auth";
import { prisma } from "@/lib/prisma";

// A cookie whose account is gone: clear it, then sign in again.
const SIGNED_OUT = "/api/attendance/auth/logout";

export const metadata = { title: "Students — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadStudents() {
  const session = await getStaffSession();
  if (!session) redirect(SIGNED_OUT);
  if (session.role !== "head") redirect("/attendance/teacher");

  const [pupils, groups, absences, pending] = await Promise.all([
    prisma.pupil.findMany({
      where: { isActive: true },
      orderBy: [{ grade: "asc" }, { firstName: "asc" }, { lastName: "asc" }],
      include: {
        enrollments: {
          where: { endDate: null },
          select: { group: { select: { id: true, name: true, subject: true } } },
        },
      },
    }),
    prisma.group.findMany({
      where: { isActive: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        grade: true,
        subject: true,
        teacher: { select: { fullName: true } },
      },
    }),
    prisma.attendanceRecord.groupBy({
      by: ["pupilId"],
      where: { status: "ABSENT" },
      _count: { _all: true },
    }),
    prisma.moveRequest.count({ where: { status: "PENDING" } }),
  ]);

  const absenceByPupil = new Map(
    absences.map((row) => [row.pupilId, row._count._all]),
  );

  const students: StudentRow[] = pupils.map((pupil) => ({
    id: pupil.id,
    firstName: pupil.firstName,
    lastName: pupil.lastName,
    grade: pupil.grade,
    className: pupil.className,
    externalId: pupil.externalId,
    groups: [
      ...new Map(
        pupil.enrollments.map((enrollment) => [enrollment.group.id, enrollment.group]),
      ).values(),
    ],
    absences: absenceByPupil.get(pupil.id) ?? 0,
  }));

  const groupTargets: MoveTarget[] = groups.map((group) => ({
    id: group.id,
    name: group.name,
    grade: group.grade,
    subject: group.subject,
    teacherName: group.teacher?.fullName ?? null,
  }));

  return (
    <StaffShell
      role="head"
      name={session.name}
      active="/attendance/head/students"
      pendingMoves={pending}
    >
      <PageHeading
        title="Students"
        subtitle="Search the school list and move a student between groups. Every move is confirmed in the move queue."
        action={
          <Link href="/attendance/head/uploads" className="btn-outline">
            Upload student list
          </Link>
        }
      />

      {students.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No students yet. Upload the student list under{" "}
          <Link href="/attendance/head/uploads" className="font-semibold text-brand-dark">
            Uploads
          </Link>
          .
        </div>
      ) : (
        <StudentDirectory students={students} groups={groupTargets} />
      )}
    </StaffShell>
  );
}
