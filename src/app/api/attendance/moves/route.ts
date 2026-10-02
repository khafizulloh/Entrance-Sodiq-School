import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/attendance/auth";
import { MoveError, createMoveRequest } from "@/lib/attendance/moves";

const schema = z.object({
  pupilId: z.string().min(1),
  toGroupId: z.string().min(1, "Choose the group to move the student to."),
  fromGroupId: z.string().min(1).nullable().optional(),
  reason: z.string().max(400).nullable().optional(),
  moveRecords: z.boolean().optional(),
});

/** A teacher requests a move; the head teacher starts one directly. */
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

  try {
    const { request, recordCount } = await createMoveRequest({
      ...parsed.data,
      requestedById: session.sub,
      source: session.role === "head" ? "HEAD" : "TEACHER",
    });
    return NextResponse.json({ ok: true, requestId: request.id, recordCount });
  } catch (error) {
    if (error instanceof MoveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}

/** Pending requests for the head teacher; own requests for a teacher. */
export async function GET() {
  const auth = await requireStaff();
  if (!auth.ok) return auth.response;
  const { session } = auth;

  const requests = await prisma.moveRequest.findMany({
    where: session.role === "head" ? {} : { requestedById: session.sub },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      pupil: { select: { firstName: true, lastName: true, grade: true } },
      fromGroup: { select: { name: true } },
      toGroup: { select: { name: true } },
      requestedBy: { select: { fullName: true } },
    },
  });

  return NextResponse.json({ requests });
}
