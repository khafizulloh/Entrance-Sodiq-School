import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/attendance/auth";
import { dayOfWeekOf, schoolToday, toDbDate } from "@/lib/attendance/dates";
import { groupRoster } from "@/lib/attendance/register";
import { ATTENDANCE_STATUSES } from "@/lib/attendance/subjects";
import { slotsForDate } from "@/lib/attendance/timetable";

/**
 * Saves attendance and marks for one lesson.
 *
 * Two shapes:
 *   { groupId, date, period, markAllPresent: true }   -> whole group present
 *   { groupId, date, period, entries: [...] }         -> individual changes
 *
 * The lesson row is created the first time anything is saved for that
 * group / date / period.
 */

const entrySchema = z.object({
  pupilId: z.string().min(1),
  status: z.enum(ATTENDANCE_STATUSES).nullable().optional(),
  mark: z.number().int().min(0).max(100).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
});

const schema = z.object({
  groupId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date."),
  period: z.number().int().min(1).max(8),
  markAllPresent: z.boolean().optional(),
  entries: z.array(entrySchema).max(300).optional(),
});

export async function POST(req: Request) {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }
  const { groupId, date, period, markAllPresent, entries } = parsed.data;

  if (date > schoolToday()) {
    return NextResponse.json(
      { error: "You cannot take attendance for a future lesson." },
      { status: 400 },
    );
  }

  const group = await prisma.group.findUnique({ where: { id: groupId } });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  // The lesson has to exist on the timetable in force on that date.
  const slots = await slotsForDate(date, { groupId });
  const day = dayOfWeekOf(date);
  const slot = slots.find((s) => s.dayOfWeek === day && s.period === period);
  if (!slot) {
    return NextResponse.json(
      { error: "That group has no lesson at this period on this date." },
      { status: 400 },
    );
  }

  const mayEdit =
    session.role === "head" ||
    group.teacherId === session.sub ||
    slot.teacherId === session.sub;
  if (!mayEdit) {
    return NextResponse.json(
      { error: "You can only take attendance for your own groups." },
      { status: 403 },
    );
  }

  const lesson = await prisma.lesson.upsert({
    where: { groupId_date_period: { groupId, date: toDbDate(date), period } },
    create: {
      groupId,
      date: toDbDate(date),
      period,
      slotId: slot.id,
      teacherId: slot.teacherId ?? group.teacherId ?? session.sub,
    },
    update: {},
  });

  const roster = await groupRoster(groupId);
  const rosterIds = new Set(roster.map((pupil) => pupil.id));

  if (markAllPresent) {
    // Keep any mark already given; only the attendance column is filled in.
    const existing = await prisma.attendanceRecord.findMany({
      where: { lessonId: lesson.id },
      select: { pupilId: true },
    });
    const have = new Set(existing.map((record) => record.pupilId));

    await prisma.$transaction([
      prisma.attendanceRecord.updateMany({
        where: { lessonId: lesson.id, pupilId: { in: [...have] } },
        data: { status: "PRESENT", markedById: session.sub },
      }),
      prisma.attendanceRecord.createMany({
        data: roster
          .filter((pupil) => !have.has(pupil.id))
          .map((pupil) => ({
            lessonId: lesson.id,
            pupilId: pupil.id,
            status: "PRESENT",
            markedById: session.sub,
          })),
        skipDuplicates: true,
      }),
    ]);
  }

  if (entries?.length) {
    const invalid = entries.find((entry) => !rosterIds.has(entry.pupilId));
    if (invalid) {
      return NextResponse.json(
        { error: "One of the students is not in this group." },
        { status: 400 },
      );
    }

    for (const entry of entries) {
      // Clearing the attendance of a pupil with no mark removes the record.
      if (entry.status === null && (entry.mark === null || entry.mark === undefined)) {
        await prisma.attendanceRecord.deleteMany({
          where: { lessonId: lesson.id, pupilId: entry.pupilId },
        });
        continue;
      }

      await prisma.attendanceRecord.upsert({
        where: {
          lessonId_pupilId: { lessonId: lesson.id, pupilId: entry.pupilId },
        },
        create: {
          lessonId: lesson.id,
          pupilId: entry.pupilId,
          status: entry.status ?? "PRESENT",
          mark: entry.mark ?? null,
          note: entry.note ?? null,
          markedById: session.sub,
        },
        update: {
          ...(entry.status !== undefined && entry.status !== null
            ? { status: entry.status }
            : {}),
          ...(entry.mark !== undefined ? { mark: entry.mark } : {}),
          ...(entry.note !== undefined ? { note: entry.note } : {}),
          markedById: session.sub,
        },
      });
    }
  }

  const records = await prisma.attendanceRecord.findMany({
    where: { lessonId: lesson.id },
    select: { pupilId: true, status: true, mark: true, note: true },
  });

  return NextResponse.json({ ok: true, lessonId: lesson.id, records });
}
