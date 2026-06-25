import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/api";

/**
 * Routes operating on a single submission (the [id] is a submissionId).
 *   GET    — full detail incl. each question, the chosen answer, correctness
 *   DELETE — remove a submission (used to clean duplicate/fake entries)
 *   PATCH  — update the linked student (e.g. allow a retake)
 */

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      student: true,
      test: { select: { grade: true, title: true } },
      answers: {
        include: {
          question: { include: { options: true } },
          selectedOption: true,
        },
      },
    },
  });

  if (!submission) return jsonError("Submission not found.", 404);

  return NextResponse.json({
    submissionId: submission.id,
    student: submission.student,
    test: submission.test,
    score: submission.score,
    totalQuestions: submission.totalQuestions,
    percentage: submission.percentage,
    level: submission.level,
    durationSec: submission.durationSec,
    createdAt: submission.createdAt,
    answers: submission.answers.map((a) => ({
      questionId: a.questionId,
      questionText: a.question.text,
      isCorrect: a.isCorrect,
      selectedOptionId: a.selectedOptionId,
      options: a.question.options.map((o) => ({
        id: o.id,
        label: o.label,
        text: o.text,
        isCorrect: o.isCorrect,
        selected: o.id === a.selectedOptionId,
      })),
    })),
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: { studentId: true },
  });
  if (!submission) return jsonError("Submission not found.", 404);

  await prisma.submission.delete({ where: { id } });

  // If the student has no remaining submissions, remove the orphaned record too.
  const remaining = await prisma.submission.count({
    where: { studentId: submission.studentId },
  });
  if (remaining === 0) {
    await prisma.student.delete({ where: { id: submission.studentId } });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  let body: { allowRetake?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.");
  }

  const submission = await prisma.submission.findUnique({
    where: { id },
    select: { studentId: true },
  });
  if (!submission) return jsonError("Submission not found.", 404);

  const updated = await prisma.student.update({
    where: { id: submission.studentId },
    data: { allowRetake: Boolean(body.allowRetake) },
    select: { id: true, allowRetake: true },
  });

  return NextResponse.json(updated);
}
