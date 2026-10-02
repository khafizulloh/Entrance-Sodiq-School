import { prisma } from "@/lib/prisma";
import {
  type IsoDate,
  dayOfWeekOf,
  schoolToday,
  toDbDate,
  toIsoDate,
  weekdaysBetween,
} from "./dates";

/**
 * Timetable resolution.
 *
 * Each upload creates a TimetableVersion with an `effectiveFrom` date. The
 * timetable in force on any date is the newest version whose `effectiveFrom`
 * is on or before that date, so uploading a new timetable changes the
 * attendance dates from that day on and leaves earlier days untouched.
 */

export type ResolvedSlot = {
  id: string;
  groupId: string;
  groupName: string;
  grade: number;
  subject: string;
  room: string | null;
  teacherId: string | null;
  teacherName: string | null;
  dayOfWeek: number;
  period: number;
};

export type DatedLesson = {
  date: IsoDate;
  period: number;
  slotId: string | null;
  subject: string;
  room: string | null;
};

/** The timetable version in force on a date, or null if none has been uploaded. */
export async function versionForDate(date: IsoDate) {
  return prisma.timetableVersion.findFirst({
    where: { effectiveFrom: { lte: toDbDate(date) } },
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
  });
}

/** All versions, newest first. */
export async function listVersions() {
  return prisma.timetableVersion.findMany({
    orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
    include: {
      uploadedBy: { select: { fullName: true } },
      _count: { select: { slots: true } },
    },
  });
}

/** Slots of the timetable in force on `date`, optionally for one teacher. */
export async function slotsForDate(
  date: IsoDate,
  filter: { teacherId?: string; groupId?: string } = {},
): Promise<ResolvedSlot[]> {
  const version = await versionForDate(date);
  if (!version) return [];

  const slots = await prisma.timetableSlot.findMany({
    where: {
      versionId: version.id,
      ...(filter.teacherId ? { teacherId: filter.teacherId } : {}),
      ...(filter.groupId ? { groupId: filter.groupId } : {}),
    },
    include: {
      group: { select: { id: true, name: true, grade: true } },
      teacher: { select: { id: true, fullName: true } },
    },
    orderBy: [{ dayOfWeek: "asc" }, { period: "asc" }],
  });

  return slots.map((slot) => ({
    id: slot.id,
    groupId: slot.groupId,
    groupName: slot.group.name,
    grade: slot.group.grade,
    subject: slot.subject,
    room: slot.room,
    teacherId: slot.teacherId,
    teacherName: slot.teacher?.fullName ?? null,
    dayOfWeek: slot.dayOfWeek,
    period: slot.period,
  }));
}

/** A teacher's weekly grid (Mon–Fri) as of today, or of a given date. */
export async function teacherWeek(teacherId: string, date: IsoDate = schoolToday()) {
  const slots = await slotsForDate(date, { teacherId });
  const byDay = new Map<number, ResolvedSlot[]>();
  for (let day = 1; day <= 5; day++) byDay.set(day, []);
  for (const slot of slots) byDay.get(slot.dayOfWeek)?.push(slot);
  return byDay;
}

/**
 * Every dated lesson a group has between two dates, honouring the timetable
 * version in force on each individual date.
 */
export async function groupLessonDates(
  groupId: string,
  from: IsoDate,
  to: IsoDate,
): Promise<DatedLesson[]> {
  const dates = weekdaysBetween(from, to);
  if (dates.length === 0) return [];

  const versions = await prisma.timetableVersion.findMany({
    orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    select: { id: true, effectiveFrom: true },
  });
  if (versions.length === 0) return [];

  const slots = await prisma.timetableSlot.findMany({
    where: { groupId },
    select: {
      id: true,
      versionId: true,
      dayOfWeek: true,
      period: true,
      subject: true,
      room: true,
    },
  });

  const slotsByVersion = new Map<string, typeof slots>();
  for (const slot of slots) {
    const list = slotsByVersion.get(slot.versionId) ?? [];
    list.push(slot);
    slotsByVersion.set(slot.versionId, list);
  }

  const out: DatedLesson[] = [];
  for (const date of dates) {
    // Newest version effective on or before this date.
    let active: (typeof versions)[number] | null = null;
    for (const version of versions) {
      if (toIsoDate(version.effectiveFrom) <= date) active = version;
      else break;
    }
    if (!active) continue;

    const day = dayOfWeekOf(date);
    const daySlots = (slotsByVersion.get(active.id) ?? [])
      .filter((slot) => slot.dayOfWeek === day)
      .sort((a, b) => a.period - b.period);

    for (const slot of daySlots) {
      out.push({
        date,
        period: slot.period,
        slotId: slot.id,
        subject: slot.subject,
        room: slot.room,
      });
    }
  }
  return out;
}

/** The term attendance is tracked for (the active one, else the newest). */
export async function activeTerm() {
  const active = await prisma.term.findFirst({
    where: { isActive: true },
    orderBy: { startDate: "desc" },
  });
  if (active) return active;
  return prisma.term.findFirst({ orderBy: { startDate: "desc" } });
}
