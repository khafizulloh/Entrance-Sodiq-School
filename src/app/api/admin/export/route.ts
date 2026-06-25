import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api";
import { buildSubmissionWhere } from "@/lib/filters";
import { toCsv } from "@/lib/csv";

/**
 * GET /api/admin/export — download the (filtered) submissions as CSV.
 * Accepts the same filter params as the students list.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const where = buildSubmissionWhere(req.nextUrl.searchParams);

  const submissions = await prisma.submission.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      student: true,
      test: { select: { grade: true } },
    },
  });

  const csv = toCsv(submissions, [
    { header: "Full Name", value: (s) => s.student.fullName },
    { header: "Phone", value: (s) => s.student.phone },
    { header: "Parent Phone", value: (s) => s.student.parentPhone },
    { header: "Grade", value: (s) => s.student.grade },
    { header: "Previous School", value: (s) => s.student.previousSchool ?? "" },
    { header: "Branch", value: (s) => s.student.branch ?? "" },
    { header: "Telegram", value: (s) => s.student.telegram ?? "" },
    {
      header: "Date of Birth",
      value: (s) =>
        s.student.dateOfBirth
          ? s.student.dateOfBirth.toISOString().slice(0, 10)
          : "",
    },
    { header: "Score", value: (s) => s.score },
    { header: "Total Questions", value: (s) => s.totalQuestions },
    { header: "Percentage", value: (s) => s.percentage },
    { header: "Level", value: (s) => s.level },
    { header: "Duration (sec)", value: (s) => s.durationSec },
    {
      header: "Submitted At",
      value: (s) => s.createdAt.toISOString().replace("T", " ").slice(0, 19),
    },
  ]);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="sodiq-students-${Date.now()}.csv"`,
    },
  });
}
