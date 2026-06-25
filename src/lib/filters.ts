import type { Prisma } from "@prisma/client";

/**
 * Build a Prisma `where` filter for submissions from URL search params.
 * Shared by the students list and the CSV export so they always match.
 */
export function buildSubmissionWhere(
  params: URLSearchParams,
): Prisma.SubmissionWhereInput {
  const where: Prisma.SubmissionWhereInput = {};
  const and: Prisma.SubmissionWhereInput[] = [];

  const q = params.get("q")?.trim();
  if (q) {
    and.push({
      student: {
        OR: [
          { fullName: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
          { parentPhone: { contains: q } },
        ],
      },
    });
  }

  const grade = Number(params.get("grade"));
  if (grade) and.push({ student: { grade } });

  const level = params.get("level");
  if (level) and.push({ level });

  const minScore = params.get("minScore");
  const maxScore = params.get("maxScore");
  if (minScore || maxScore) {
    const pct: Prisma.FloatFilter = {};
    if (minScore) pct.gte = Number(minScore);
    if (maxScore) pct.lte = Number(maxScore);
    and.push({ percentage: pct });
  }

  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  if (dateFrom || dateTo) {
    const created: Prisma.DateTimeFilter = {};
    if (dateFrom) created.gte = new Date(dateFrom);
    if (dateTo) {
      // Include the whole "to" day.
      const d = new Date(dateTo);
      d.setHours(23, 59, 59, 999);
      created.lte = d;
    }
    and.push({ createdAt: created });
  }

  if (and.length) where.AND = and;
  return where;
}
