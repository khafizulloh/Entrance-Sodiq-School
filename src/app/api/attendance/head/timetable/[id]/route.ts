import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHead } from "@/lib/attendance/auth";
import { toDbDate } from "@/lib/attendance/dates";

const schema = z.object({
  name: z.string().trim().min(2).optional(),
  effectiveFrom: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date.")
    .optional(),
});

/**
 * Change when a timetable version starts, or rename it.
 *
 * Moving the start date earlier is how lessons from the start of term get
 * their dates, so registers taken on paper can be typed in. Attendance
 * already recorded is untouched — only which dates have lessons changes.
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
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const version = await prisma.timetableVersion.findUnique({ where: { id } });
  if (!version) {
    return NextResponse.json({ error: "Timetable version not found." }, { status: 404 });
  }

  const updated = await prisma.timetableVersion.update({
    where: { id },
    data: {
      ...(parsed.data.name ? { name: parsed.data.name } : {}),
      ...(parsed.data.effectiveFrom
        ? { effectiveFrom: toDbDate(parsed.data.effectiveFrom) }
        : {}),
    },
  });

  return NextResponse.json({
    ok: true,
    effectiveFrom: updated.effectiveFrom.toISOString().slice(0, 10),
  });
}
