import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { StaffSession } from "@/lib/attendance/auth";
import {
  type MonthKey,
  addDays,
  maxDate,
  minDate,
  monthEnd,
  monthKeyOf,
  monthLabel,
  monthStart,
  monthsBetween,
  schoolToday,
  toIsoDate,
} from "@/lib/attendance/dates";
import { buildRegister, columnKey } from "@/lib/attendance/register";
import { bandLabel, subjectLabel } from "@/lib/attendance/subjects";
import { activeTerm } from "@/lib/attendance/timetable";
import { PageHeading, StaffShell } from "./StaffShell";
import { RegisterTable } from "./RegisterTable";
import type { MoveTarget } from "./MoveRequestDialog";

/**
 * One group's register, shared by the teacher and head-teacher routes.
 * The head teacher can open any group; a teacher only their own.
 *
 * A term can run for four months, so the register is browsed one month at a
 * time. Any month of the term can be opened and filled in, which is how
 * lessons already recorded on paper get typed in.
 */
export async function GroupRegisterView({
  groupId,
  session,
  date,
  period,
  month,
  backHref,
}: {
  groupId: string;
  session: StaffSession;
  date?: string;
  period?: string;
  month?: string;
  backHref: string;
}) {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { teacher: { select: { id: true, fullName: true } } },
  });
  if (!group) notFound();

  // A teacher may open a group they are assigned to, or one they teach on the
  // timetable (cover lessons and joint lessons).
  let canEdit = session.role === "head" || group.teacherId === session.sub;
  if (!canEdit) {
    const slot = await prisma.timetableSlot.findFirst({
      where: { groupId, teacherId: session.sub },
    });
    canEdit = Boolean(slot);
  }
  if (session.role !== "head" && !canEdit) {
    return (
      <StaffShell role={session.role} name={session.name}>
        <div className="card">
          <h1 className="text-lg font-bold text-navy">This group is not yours</h1>
          <p className="mt-2 text-sm text-slate-600">
            You can only open the registers of groups you teach.
          </p>
          <Link href={backHref} className="btn-primary mt-4">
            Back
          </Link>
        </div>
      </StaffShell>
    );
  }

  const today = schoolToday();
  const term = await activeTerm();
  const termFrom = term ? toIsoDate(term.startDate) : addDays(today, -45);
  const termTo = term ? toIsoDate(term.endDate) : today;

  // Which month to show: the one asked for, else the month of the lesson that
  // was tapped, else this month — always inside the term.
  const months = monthsBetween(termFrom, termTo);
  const ALL = "ALL";
  const wanted =
    month && (month === ALL || months.includes(month))
      ? month
      : date && months.includes(monthKeyOf(date))
        ? monthKeyOf(date)
        : months.includes(monthKeyOf(today))
          ? monthKeyOf(today)
          : (months[months.length - 1] ?? monthKeyOf(today));

  const from =
    wanted === ALL ? termFrom : maxDate(termFrom, monthStart(wanted as MonthKey));
  const to = wanted === ALL ? termTo : minDate(termTo, monthEnd(wanted as MonthKey));

  const register = await buildRegister(groupId, from, to);
  if (!register) notFound();

  const targets = await prisma.group.findMany({
    where: {
      id: { not: groupId },
      grade: group.grade,
      subject: group.subject,
      isActive: true,
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      grade: true,
      subject: true,
      teacher: { select: { fullName: true } },
    },
  });
  const moveTargets: MoveTarget[] = targets.map((target) => ({
    id: target.id,
    name: target.name,
    grade: target.grade,
    subject: target.subject,
    teacherName: target.teacher?.fullName ?? null,
  }));

  const focusKey = date && period ? columnKey(date, Number(period)) : null;

  const taken = register.columns.filter((column) =>
    register.pupils.some((pupil) => register.cells[pupil.id]?.[column.key]),
  ).length;
  const past = register.columns.filter((column) => !column.isFuture).length;

  return (
    <StaffShell role={session.role} name={session.name}>
      <PageHeading
        title={group.name}
        subtitle={`${subjectLabel(group.subject)} · ${bandLabel(group.subject, group.grade)}${
          group.room ? ` · Room ${group.room}` : ""
        } · ${register.pupils.length} students${
          group.teacher ? ` · ${group.teacher.fullName}` : ""
        }`}
        action={
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-slate-500 sm:block">
              {taken}/{past} lessons recorded this month
            </span>
            <Link href={backHref} className="btn-outline">
              Back
            </Link>
          </div>
        }
      />

      <RegisterTable
        data={register}
        moveTargets={moveTargets}
        focusKey={focusKey}
        canEdit={canEdit}
        months={months.map((key) => ({ key, label: monthLabel(key) }))}
        selectedMonth={wanted}
      />
    </StaffShell>
  );
}
