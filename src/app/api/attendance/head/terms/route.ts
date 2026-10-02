import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireHead } from "@/lib/attendance/auth";
import { toDbDate } from "@/lib/attendance/dates";

const schema = z
  .object({
    name: z.string().trim().min(2, "Give the term a name."),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid start date."),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid end date."),
  })
  .refine((value) => value.startDate < value.endDate, {
    message: "The end date must be after the start date.",
  });

/** Set the period attendance is tracked for and make it the active one. */
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

  const term = await prisma.$transaction(async (tx) => {
    await tx.term.updateMany({ where: { isActive: true }, data: { isActive: false } });
    return tx.term.create({
      data: {
        name: parsed.data.name,
        startDate: toDbDate(parsed.data.startDate),
        endDate: toDbDate(parsed.data.endDate),
        isActive: true,
      },
    });
  });

  return NextResponse.json({ ok: true, termId: term.id });
}
