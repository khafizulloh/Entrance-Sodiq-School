import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { submissionSchema } from "@/lib/validation";
import { getLevelFromPercentage } from "@/lib/levels";

/**
 * POST /api/submit
 * Receives the student info + their answers, scores the test on the server,
 * stores everything, and returns the result.
 *
 * Duplicate prevention: a phone number that already has a submission for the
 * same test is rejected, unless an admin has set the student's allowRetake flag.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.");
  }

  const parsed = submissionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid submission.");
  }
  const { student, testId, answers, durationSec } = parsed.data;

  // Load the test with the correct answers (server-side only).
  const test = await prisma.test.findUnique({
    where: { id: testId },
    include: { questions: { include: { options: true } } },
  });
  if (!test || !test.isActive) {
    return jsonError("This test is not available.", 404);
  }

  // Duplicate check: same phone already submitted for this test?
  const existingStudent = await prisma.student.findFirst({
    where: { phone: student.phone },
    include: { submissions: { where: { testId } } },
  });
  if (
    existingStudent &&
    existingStudent.submissions.length > 0 &&
    !existingStudent.allowRetake
  ) {
    return jsonError(
      "A test has already been submitted with this phone number. Please contact the school if you need to retake it.",
      409,
    );
  }

  // Build a lookup of the correct option per question.
  const correctByQuestion = new Map<string, string>();
  for (const q of test.questions) {
    const correct = q.options.find((o) => o.isCorrect);
    if (correct) correctByQuestion.set(q.id, correct.id);
  }

  // Score: only count answers to real questions of this test.
  const validQuestionIds = new Set(test.questions.map((q) => q.id));
  let score = 0;
  const answerRecords = answers
    .filter((a) => validQuestionIds.has(a.questionId))
    .map((a) => {
      const isCorrect =
        a.selectedOptionId != null &&
        correctByQuestion.get(a.questionId) === a.selectedOptionId;
      if (isCorrect) score += 1;
      return {
        questionId: a.questionId,
        selectedOptionId: a.selectedOptionId,
        isCorrect,
      };
    });

  const totalQuestions = test.questions.length;
  const percentage =
    totalQuestions > 0 ? Math.round((score / totalQuestions) * 10000) / 100 : 0;
  const level = getLevelFromPercentage(percentage);

  // Persist everything in a single transaction.
  const result = await prisma.$transaction(async (tx) => {
    // Reuse the existing student record (by phone) or create a new one.
    const studentRecord = existingStudent
      ? await tx.student.update({
          where: { id: existingStudent.id },
          data: {
            fullName: student.fullName,
            parentPhone: student.parentPhone,
            grade: student.grade,
            previousSchool: student.previousSchool || null,
            branch: student.branch || null,
            telegram: student.telegram || null,
            dateOfBirth: student.dateOfBirth
              ? new Date(student.dateOfBirth)
              : null,
            // Consume the one-time retake permission.
            allowRetake: false,
          },
        })
      : await tx.student.create({
          data: {
            fullName: student.fullName,
            phone: student.phone,
            parentPhone: student.parentPhone,
            grade: student.grade,
            previousSchool: student.previousSchool || null,
            branch: student.branch || null,
            telegram: student.telegram || null,
            dateOfBirth: student.dateOfBirth
              ? new Date(student.dateOfBirth)
              : null,
          },
        });

    const submission = await tx.submission.create({
      data: {
        studentId: studentRecord.id,
        testId: test.id,
        score,
        totalQuestions,
        percentage,
        level,
        durationSec,
        answers: { create: answerRecords },
      },
    });

    return submission;
  });

  return NextResponse.json({
    submissionId: result.id,
    score,
    totalQuestions,
    percentage,
    level,
  });
}
