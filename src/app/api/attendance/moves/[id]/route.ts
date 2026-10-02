import { NextResponse } from "next/server";
import { z } from "zod";
import { requireHead } from "@/lib/attendance/auth";
import { MoveError, approveMoveRequest, rejectMoveRequest } from "@/lib/attendance/moves";

const schema = z.object({
  decision: z.enum(["APPROVE", "REJECT"]),
  note: z.string().max(400).nullable().optional(),
});

/** Approve or reject a move request. Head teacher only. */
export async function POST(
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

  try {
    const result =
      parsed.data.decision === "APPROVE"
        ? await approveMoveRequest(id, auth.session.sub, parsed.data.note)
        : await rejectMoveRequest(id, auth.session.sub, parsed.data.note);

    return NextResponse.json({
      ok: true,
      status: result.status,
      recordsMoved: result.recordsMoved,
    });
  } catch (error) {
    if (error instanceof MoveError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
