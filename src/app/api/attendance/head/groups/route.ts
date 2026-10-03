import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHead } from "@/lib/attendance/auth";
import { SUBJECTS, parseGroupName } from "@/lib/attendance/subjects";

const schema = z.object({
  name: z.string().trim().min(1, "Give the group a name."),
  subject: z.enum(SUBJECTS).optional(),
  grade: z.number().int().min(1).max(11).optional(),
  teacherId: z.string().min(1).nullable().optional(),
  room: z.string().trim().max(40).nullable().optional(),
});

/**
 * Creates one group. The name usually says what it is — 5-E1 is General
 * English for grades 5 and 6, SAT - M1 is SAT Math — but the track and the
 * band can be set outright for a name that does not follow the pattern.
 */
export async function POST(req: Request) {
  const auth = await requireHead();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const { name, teacherId, room } = parsed.data;

  const taken = await prisma.group.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
    select: { id: true, name: true },
  });
  if (taken) {
    return NextResponse.json(
      { error: `There is already a group called "${taken.name}".` },
      { status: 409 },
    );
  }

  if (teacherId) {
    const teacher = await prisma.staff.findUnique({ where: { id: teacherId } });
    if (!teacher || !teacher.isActive) {
      return NextResponse.json(
        { error: "That teacher account does not exist or is switched off." },
        { status: 400 },
      );
    }
  }

  const guess = parseGroupName(name);
  const subject = parsed.data.subject ?? guess.subject;
  const grade = parsed.data.grade ?? guess.grade;
  if (!grade) {
    return NextResponse.json(
      { error: "Choose which grades this group is for." },
      { status: 400 },
    );
  }

  const group = await prisma.group.create({
    data: { name, subject, grade, room: room || null, teacherId: teacherId ?? null },
    select: { id: true, name: true, subject: true, grade: true },
  });

  return NextResponse.json({ ok: true, group });
}
