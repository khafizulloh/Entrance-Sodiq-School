import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { buildSubmissionWhere } from "@/lib/filters";

/**
 * GET /api/admin/students
 * Lists test submissions with the student info. Supports search, filters,
 * and pagination. Query params: q, grade, level, minScore, maxScore,
 * dateFrom, dateTo, page, pageSize.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const params = req.nextUrl.searchParams;
  const where = buildSubmissionWhere(params);

  const page = Math.max(1, Number(params.get("page")) || 1);
  const pageSize = Math.min(100, Math.max(5, Number(params.get("pageSize")) || 20));

  const [total, submissions] = await Promise.all([
    prisma.submission.count({ where }),
    prisma.submission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        student: true,
        test: { select: { grade: true, title: true } },
      },
    }),
  ]);

  return NextResponse.json({
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    items: submissions.map((s) => ({
      submissionId: s.id,
      studentId: s.studentId,
      fullName: s.student.fullName,
      phone: s.student.phone,
      parentPhone: s.student.parentPhone,
      grade: s.student.grade,
      branch: s.student.branch,
      score: s.score,
      totalQuestions: s.totalQuestions,
      percentage: s.percentage,
      level: s.level,
      allowRetake: s.student.allowRetake,
      createdAt: s.createdAt,
    })),
  });
}
