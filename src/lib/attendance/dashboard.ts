import { prisma } from "@/lib/prisma";
import { schoolNow, toDbDate, toIsoDate } from "./dates";
import { currentPeriod } from "./periods";
import { type ResolvedSlot, slotsForDate, teacherWeek } from "./timetable";

/** Data behind the teacher and head-teacher dashboards. */

export type TodayLesson = ResolvedSlot & {
  lessonId: string | null;
  recordCount: number;
  rosterCount: number;
  isNow: boolean;
  isNext: boolean;
};

export async function teacherDashboard(teacherId: string) {
  const now = schoolNow();
  const current = currentPeriod(now.minutes);

  const [week, slots, groups] = await Promise.all([
    teacherWeek(teacherId, now.date),
    slotsForDate(now.date, { teacherId }),
    prisma.group.findMany({
      where: { teacherId, isActive: true },
      orderBy: [{ grade: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        grade: true,
        subject: true,
        room: true,
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  const todaySlots = slots
    .filter((slot) => slot.dayOfWeek === now.dayOfWeek)
    .sort((a, b) => a.period - b.period);

  const lessons = await prisma.lesson.findMany({
    where: {
      date: toDbDate(now.date),
      groupId: { in: todaySlots.map((slot) => slot.groupId) },
    },
    select: {
      id: true,
      groupId: true,
      period: true,
      _count: { select: { records: true } },
    },
  });
  const lessonByKey = new Map(
    lessons.map((lesson) => [`${lesson.groupId}|${lesson.period}`, lesson]),
  );

  const rosterCounts = await rosterCountsFor(todaySlots.map((slot) => slot.groupId));

  const nowPeriod = current?.state === "running" ? current.period.index : null;
  const nextPeriod = current?.state === "upcoming" ? current.period.index : null;

  const today: TodayLesson[] = todaySlots.map((slot) => {
    const lesson = lessonByKey.get(`${slot.groupId}|${slot.period}`);
    return {
      ...slot,
      lessonId: lesson?.id ?? null,
      recordCount: lesson?._count.records ?? 0,
      rosterCount: rosterCounts.get(slot.groupId) ?? 0,
      isNow: slot.period === nowPeriod,
      isNext: slot.period === nextPeriod,
    };
  });

  // The lesson to show front and centre: the one running now, else the next.
  const currentLesson =
    today.find((lesson) => lesson.isNow) ??
    today.find((lesson) => lesson.isNext) ??
    today.find((lesson) => current && lesson.period > current.period.index) ??
    null;

  return { now, current, week, today, currentLesson, groups };
}

export async function headDashboard() {
  const now = schoolNow();
  const current = currentPeriod(now.minutes);

  const [groupCount, pupilCount, teacherCount, pendingMoves, slots, term] =
    await Promise.all([
      prisma.group.count({ where: { isActive: true } }),
      prisma.pupil.count({ where: { isActive: true } }),
      prisma.staff.count({ where: { role: "teacher", isActive: true } }),
      prisma.moveRequest.count({ where: { status: "PENDING" } }),
      slotsForDate(now.date),
      prisma.term.findFirst({ where: { isActive: true } }),
    ]);

  const todaySlots = slots
    .filter((slot) => slot.dayOfWeek === now.dayOfWeek)
    .sort((a, b) => a.period - b.period);

  const lessons = await prisma.lesson.findMany({
    where: { date: toDbDate(now.date) },
    select: {
      id: true,
      groupId: true,
      period: true,
      _count: { select: { records: true } },
    },
  });
  const lessonByKey = new Map(
    lessons.map((lesson) => [`${lesson.groupId}|${lesson.period}`, lesson]),
  );

  const rosterCounts = await rosterCountsFor(todaySlots.map((slot) => slot.groupId));

  const decorate = (slot: ResolvedSlot) => {
    const lesson = lessonByKey.get(`${slot.groupId}|${slot.period}`);
    return {
      ...slot,
      lessonId: lesson?.id ?? null,
      recordCount: lesson?._count.records ?? 0,
      rosterCount: rosterCounts.get(slot.groupId) ?? 0,
    };
  };

  const runningNow =
    current?.state === "running"
      ? todaySlots.filter((slot) => slot.period === current.period.index).map(decorate)
      : [];
  const upNext =
    current?.state === "upcoming"
      ? todaySlots.filter((slot) => slot.period === current.period.index).map(decorate)
      : [];

  const doneToday = todaySlots.filter(
    (slot) => (lessonByKey.get(`${slot.groupId}|${slot.period}`)?._count.records ?? 0) > 0,
  ).length;

  const missingToday = todaySlots
    .filter((slot) => current && slot.period < current.period.index)
    .filter(
      (slot) =>
        (lessonByKey.get(`${slot.groupId}|${slot.period}`)?._count.records ?? 0) === 0,
    )
    .map(decorate);

  return {
    now,
    current,
    stats: {
      groupCount,
      pupilCount,
      teacherCount,
      pendingMoves,
      lessonsToday: todaySlots.length,
      doneToday,
    },
    term: term
      ? {
          name: term.name,
          startDate: toIsoDate(term.startDate),
          endDate: toIsoDate(term.endDate),
        }
      : null,
    runningNow,
    upNext,
    missingToday,
    todaySlots: todaySlots.map(decorate),
  };
}

/** How many pupils are currently in each group. */
async function rosterCountsFor(groupIds: string[]): Promise<Map<string, number>> {
  if (groupIds.length === 0) return new Map();
  const rows = await prisma.enrollment.groupBy({
    by: ["groupId"],
    where: { groupId: { in: groupIds }, endDate: null },
    _count: { _all: true },
  });
  return new Map(rows.map((row) => [row.groupId, row._count._all]));
}
