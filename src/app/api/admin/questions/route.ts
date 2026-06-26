import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/api";
import { questionInputSchema } from "@/lib/validation";

/**
 * GET  /api/admin/questions?testId=...  — list questions (with options) for a test.
 * POST /api/admin/questions             — create a question with its 4 options.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const testId = req.nextUrl.searchParams.get("testId");
  if (!testId) return jsonError("testId is required.");

  const questions = await prisma.question.findMany({
    where: { testId },
    orderBy: { order: "asc" },
    include: { options: { orderBy: { label: "asc" } } },
  });

  return NextResponse.json(questions);
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

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
  const { testId, text, order, source, options } = parsed.data;

  const test = await prisma.test.findUnique({ where: { id: testId } });
  if (!test) return jsonError("Test not found.", 404);

  const created = await prisma.question.create({
    data: {
      testId,
      text,
      order,
      source: source ?? null,
      options: { create: options },
    },
    include: { options: true },
  });

  return NextResponse.json(created, { status: 201 });
}
