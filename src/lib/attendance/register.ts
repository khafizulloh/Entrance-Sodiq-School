import { prisma } from "@/lib/prisma";
import { type IsoDate, schoolToday, toDbDate, toIsoDate } from "./dates";
import { groupLessonDates } from "./timetable";

/**
 * Builds the group register: pupils down the side, one column pair
 * (attendance + mark) per lesson across the top.
 *
 * Records that travelled with a moved pupil keep the group they were taken in,
 * and are returned with `transferred: true` so the table can show them in a
 * lighter style.
 */

export type RegisterColumn = {
  key: string; // "2026-10-02#1"
  date: IsoDate;
  period: number;
  subject: string;
  room: string | null;
  lessonId: string | null; // null until attendance is first saved
  isToday: boolean;
  isFuture: boolean;
};

export type RegisterPupil = {
  id: string;
  firstName: string;
  lastName: string;
  joinedOn: IsoDate;
};

export type RegisterCell = {
  status: string;
  mark: number | null;
  note: string | null;
  transferred: boolean;
  originGroupName: string | null;
};

export type RegisterData = {
  group: {
    id: string;
    name: string;
    grade: number;
    subject: string;
    room: string | null;
    teacherId: string | null;
    teacherName: string | null;
  };
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
  columns: RegisterColumn[];
  pupils: RegisterPupil[];
  /** pupilId -> columnKey -> cell */
  cells: Record<string, Record<string, RegisterCell>>;
};

export function columnKey(date: IsoDate, period: number): string {
  return `${date}#${period}`;
}

/** Pupils currently enrolled in a group, sorted by first name then surname. */
export async function groupRoster(groupId: string): Promise<RegisterPupil[]> {
  const enrollments = await prisma.enrollment.findMany({
    where: { groupId, endDate: null, pupil: { isActive: true } },
    include: { pupil: true },
  });

  return enrollments
    .map((enrollment) => ({
      id: enrollment.pupil.id,
      firstName: enrollment.pupil.firstName,
      lastName: enrollment.pupil.lastName,
      joinedOn: toIsoDate(enrollment.startDate),
    }))
    .sort(
      (a, b) =>
        a.firstName.localeCompare(b.firstName) || a.lastName.localeCompare(b.lastName),
    );
}

export async function buildRegister(
  groupId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<RegisterData | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { teacher: { select: { id: true, fullName: true } } },
  });
  if (!group) return null;

  const today = schoolToday();
  const [dated, pupils, lessons] = await Promise.all([
    groupLessonDates(groupId, from, to),
    groupRoster(groupId),
    prisma.lesson.findMany({
      where: { groupId, date: { gte: toDbDate(from), lte: toDbDate(to) } },
      select: { id: true, date: true, period: true },
    }),
  ]);

  const lessonByKey = new Map(
    lessons.map((lesson) => [columnKey(toIsoDate(lesson.date), lesson.period), lesson.id]),
  );

  const columns: RegisterColumn[] = dated.map((lesson) => {
    const key = columnKey(lesson.date, lesson.period);
    return {
      key,
      date: lesson.date,
      period: lesson.period,
      subject: lesson.subject,
      room: lesson.room,
      lessonId: lessonByKey.get(key) ?? null,
      isToday: lesson.date === today,
      isFuture: lesson.date > today,
    };
  });

  const cells: Record<string, Record<string, RegisterCell>> = {};
  for (const pupil of pupils) cells[pupil.id] = {};

  if (pupils.length > 0) {
    // Records are looked up by pupil (not by group) so that attendance taken
    // in a pupil's previous group still shows on the new group's register.
    const records = await prisma.attendanceRecord.findMany({
      where: {
        pupilId: { in: pupils.map((p) => p.id) },
        lesson: { date: { gte: toDbDate(from), lte: toDbDate(to) } },
      },
      include: {
        lesson: {
          select: {
            date: true,
            period: true,
            groupId: true,
            group: { select: { name: true, subject: true } },
          },
        },
      },
    });

    for (const record of records) {
      const foreign = record.lesson.groupId !== groupId;
      // A record taken elsewhere only shows here when it was explicitly
      // carried across by an approved move (`originGroupId` is stamped then)
      // and it is the same subject — a pupil can also be in a SAT Math group.
      if (foreign && !record.originGroupId) continue;
      if (foreign && record.lesson.group.subject !== group.subject) continue;

      const key = columnKey(toIsoDate(record.lesson.date), record.lesson.period);
      const existing = cells[record.pupilId]?.[key];
      // The group's own record always wins over an inherited one.
      if (existing && !existing.transferred) continue;

      cells[record.pupilId][key] = {
        status: record.status,
        mark: record.mark,
        note: record.note,
        transferred: foreign,
        originGroupName: foreign ? record.lesson.group.name : null,
      };
    }
  }

  return {
    group: {
      id: group.id,
      name: group.name,
      grade: group.grade,
      subject: group.subject,
      room: group.room,
      teacherId: group.teacherId,
      teacherName: group.teacher?.fullName ?? null,
    },
    from,
    to,
    today,
    columns,
    pupils,
    cells,
  };
}
