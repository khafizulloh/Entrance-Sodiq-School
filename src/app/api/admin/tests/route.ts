import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";

/** GET /api/admin/tests — list all grade tests with question counts. */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const tests = await prisma.test.findMany({
    orderBy: { grade: "asc" },
    include: { _count: { select: { questions: true, submissions: true } } },
  });

  return NextResponse.json(
    tests.map((t) => ({
      id: t.id,
      grade: t.grade,
      title: t.title,
      description: t.description,
      timeLimitSec: t.timeLimitSec,
      isActive: t.isActive,
      questionCount: t._count.questions,
      submissionCount: t._count.submissions,
    })),
  );
}
