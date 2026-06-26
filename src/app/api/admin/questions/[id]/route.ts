import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/api";
import { questionInputSchema } from "@/lib/validation";

/**
 * PATCH  /api/admin/questions/[id] — update question text/order and replace its options.
 * DELETE /api/admin/questions/[id] — delete a question (and its options, cascade).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.");
  }

  const parsed = questionInputSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid question.");
  }
  const { text, order, source, options } = parsed.data;

  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) return jsonError("Question not found.", 404);

  // Replace options atomically (simplest correct approach for a fixed set of 4).
  const updated = await prisma.$transaction(async (tx) => {
    await tx.option.deleteMany({ where: { questionId: id } });
    return tx.question.update({
      where: { id },
      data: {
        text,
        order,
        source: source ?? null,
        options: { create: options },
      },
      include: { options: { orderBy: { label: "asc" } } },
    });
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const existing = await prisma.question.findUnique({ where: { id } });
  if (!existing) return jsonError("Question not found.", 404);

  await prisma.question.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
