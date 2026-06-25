import { prisma } from "./prisma";

export type DashboardStats = {
  totalSubmissions: number;
  totalStudents: number;
  avgPercentage: number;
  maxPercentage: number;
  minPercentage: number;
  byGrade: { grade: number; count: number }[];
  byLevel: { level: string; count: number }[];
};

/** Compute the dashboard statistics. Shared by the API route and the page. */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [agg, totalStudents, byGradeRaw, byLevelRaw, tests] = await Promise.all([
    prisma.submission.aggregate({
      _count: true,
      _avg: { percentage: true },
      _max: { percentage: true },
      _min: { percentage: true },
    }),
    prisma.student.count(),
    prisma.submission.groupBy({ by: ["testId"], _count: true }),
    prisma.submission.groupBy({ by: ["level"], _count: true }),
    prisma.test.findMany({ select: { id: true, grade: true } }),
  ]);

  const gradeByTest = new Map(tests.map((t) => [t.id, t.grade]));
  const byGrade = byGradeRaw
    .map((g) => ({ grade: gradeByTest.get(g.testId) ?? 0, count: g._count }))
    .sort((a, b) => a.grade - b.grade);

  const byLevel = byLevelRaw
    .map((l) => ({ level: l.level, count: l._count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSubmissions: agg._count,
    totalStudents,
    avgPercentage: agg._avg.percentage
      ? Math.round(agg._avg.percentage * 100) / 100
      : 0,
    maxPercentage: agg._max.percentage ?? 0,
    minPercentage: agg._min.percentage ?? 0,
    byGrade,
    byLevel,
  };
}
