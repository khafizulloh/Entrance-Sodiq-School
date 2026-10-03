import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHead } from "@/lib/attendance/auth";
import { schoolToday } from "@/lib/attendance/dates";
import { versionForDate } from "@/lib/attendance/timetable";

const schema = z.object({
  teacherId: z.string().min(1).nullable(),
});

/**
 * Change who teaches a group, leaving every other detail alone.
 *
 * The timetable in force today and any future version follow the change, so
 * the new teacher sees the lessons on their dashboard straight away. Older
 * versions and lessons already recorded keep the teacher who actually taught
 * them.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHead();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const group = await prisma.group.findUnique({ where: { id } });
  if (!group) return NextResponse.json({ error: "Group not found." }, { status: 404 });

  const { teacherId } = parsed.data;
  if (teacherId) {
    const teacher = await prisma.staff.findUnique({ where: { id: teacherId } });
    if (!teacher || !teacher.isActive) {
      return NextResponse.json(
        { error: "That teacher account does not exist or is switched off." },
        { status: 400 },
      );
    }
  }

  const inForce = await versionForDate(schoolToday());
  const versions = await prisma.timetableVersion.findMany({
    where: inForce ? { effectiveFrom: { gte: inForce.effectiveFrom } } : { id: "none" },
    select: { id: true },
  });

  const [updated] = await prisma.$transaction([
    prisma.group.update({
      where: { id },
      data: { teacherId },
      include: { teacher: { select: { fullName: true } } },
    }),
    prisma.timetableSlot.updateMany({
      where: { groupId: id, versionId: { in: versions.map((version) => version.id) } },
      data: { teacherId },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    teacherName: updated.teacher?.fullName ?? null,
  });
}
