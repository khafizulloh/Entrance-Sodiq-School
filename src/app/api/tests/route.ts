import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";

/**
 * GET /api/tests?grade=5
 * Returns the active test for a grade, including its questions and options.
 * IMPORTANT: the `isCorrect` flag is never sent to the client — scoring
 * happens only on the server to prevent cheating.
 */
export async function GET(req: NextRequest) {
  const gradeParam = req.nextUrl.searchParams.get("grade");
  const grade = Number(gradeParam);
  if (!gradeParam || Number.isNaN(grade)) {
    return jsonError("A valid grade is required.");
  }

  const test = await prisma.test.findUnique({
    where: { grade },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: {
          options: {
            select: { id: true, label: true, text: true }, // no isCorrect
          },
        },
      },
    },
  });

  if (!test || !test.isActive) {
    return jsonError("No active test is available for this grade yet.", 404);
  }
  if (test.questions.length === 0) {
    return jsonError("This test has no questions yet. Please contact the school.", 404);
  }

  return NextResponse.json({
    id: test.id,
    grade: test.grade,
    title: test.title,
    description: test.description,
    timeLimitSec: test.timeLimitSec,
    questions: test.questions.map((q) => ({
      id: q.id,
      text: q.text,
      options: q.options,
    })),
  });
}
