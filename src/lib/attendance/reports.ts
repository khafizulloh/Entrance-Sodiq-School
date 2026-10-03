import { prisma } from "@/lib/prisma";
import { type IsoDate, toDbDate } from "./dates";

/**
 * "Students missing the most classes", highest first — the list the head
 * teacher asked for.
 */

export type AbsenceRow = {
  pupilId: string;
  firstName: string;
  lastName: string;
  grade: number;
  groups: string[];
  absent: number;
  late: number;
  lessonsRecorded: number;
  missedPercent: number;
};

export async function absenceReport(options: {
  from?: IsoDate;
  to?: IsoDate;
  grade?: number;
  limit?: number;
} = {}): Promise<AbsenceRow[]> {
  const dateFilter =
    options.from || options.to
      ? {
          ...(options.from ? { gte: toDbDate(options.from) } : {}),
          ...(options.to ? { lte: toDbDate(options.to) } : {}),
        }
      : undefined;

  const records = await prisma.attendanceRecord.findMany({
    where: {
      ...(dateFilter ? { lesson: { date: dateFilter } } : {}),
      ...(options.grade ? { pupil: { grade: options.grade } } : {}),
      pupil: { isActive: true, ...(options.grade ? { grade: options.grade } : {}) },
    },
    select: {
      status: true,
      pupilId: true,
      pupil: { select: { firstName: true, lastName: true, grade: true } },
    },
  });

  const byPupil = new Map<string, AbsenceRow>();
  for (const record of records) {
    let row = byPupil.get(record.pupilId);
    if (!row) {
      row = {
        pupilId: record.pupilId,
        firstName: record.pupil.firstName,
        lastName: record.pupil.lastName,
        grade: record.pupil.grade,
        groups: [],
        absent: 0,
        late: 0,
        lessonsRecorded: 0,
        missedPercent: 0,
      };
      byPupil.set(record.pupilId, row);
    }
    row.lessonsRecorded++;
    if (record.status === "ABSENT") row.absent++;
    else if (record.status === "LATE") row.late++;
  }

  const rows = [...byPupil.values()]
    .map((row) => ({
      ...row,
      missedPercent:
        row.lessonsRecorded > 0
          ? Math.round((row.absent / row.lessonsRecorded) * 1000) / 10
          : 0,
    }))
    .filter((row) => row.absent > 0)
    .sort(
      (a, b) =>
        b.absent - a.absent ||
        b.missedPercent - a.missedPercent ||
        a.firstName.localeCompare(b.firstName),
    );

  const limited = options.limit ? rows.slice(0, options.limit) : rows;

  // Attach the groups each listed pupil is in now.
  if (limited.length > 0) {
    const enrollments = await prisma.enrollment.findMany({
      where: { pupilId: { in: limited.map((row) => row.pupilId) }, endDate: null },
      select: { pupilId: true, group: { select: { name: true } } },
    });
    for (const enrollment of enrollments) {
      const row = limited.find((item) => item.pupilId === enrollment.pupilId);
      row?.groups.push(enrollment.group.name);
    }
  }

  return limited;
}
