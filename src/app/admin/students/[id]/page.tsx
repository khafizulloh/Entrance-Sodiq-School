import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const submission = await prisma.submission.findUnique({
    where: { id },
    include: {
      student: true,
      test: { select: { grade: true, title: true } },
      answers: {
        include: {
          question: { include: { options: { orderBy: { label: "asc" } } } },
        },
      },
    },
  });

  if (!submission) notFound();
  const s = submission.student;

  const info: { label: string; value: string }[] = [
    { label: "Full name", value: s.fullName },
    { label: "Phone", value: s.phone },
    { label: "Parent phone", value: s.parentPhone },
    { label: "Grade", value: `Grade ${s.grade}` },
    { label: "Previous school", value: s.previousSchool || "—" },
    { label: "Preferred branch", value: s.branch || "—" },
    { label: "Telegram", value: s.telegram || "—" },
    {
      label: "Date of birth",
      value: s.dateOfBirth ? s.dateOfBirth.toISOString().slice(0, 10) : "—",
    },
  ];

  return (
    <AdminShell>
      <Link href="/admin/students" className="text-sm text-navy hover:text-gold-dark">
        ← Back to students
      </Link>
      <h1 className="mt-2 text-2xl font-bold text-navy">{s.fullName}</h1>
      <p className="text-sm text-slate-500">
        Submitted {new Date(submission.createdAt).toLocaleString()} ·{" "}
        {submission.test.title}
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        {/* Personal info */}
        <div className="card lg:col-span-1">
          <h2 className="font-semibold text-navy">Personal Information</h2>
          <dl className="mt-3 space-y-2 text-sm">
            {info.map((row) => (
              <div key={row.label} className="flex justify-between gap-3">
                <dt className="text-slate-500">{row.label}</dt>
                <dd className="text-right font-medium text-navy-dark">
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 rounded-lg bg-navy/5 p-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Score</span>
              <span className="font-bold text-navy">
                {submission.score}/{submission.totalQuestions}
              </span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">Percentage</span>
              <span className="font-bold text-navy">{submission.percentage}%</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">Level</span>
              <span className="font-bold text-gold-dark">{submission.level}</span>
            </div>
            <div className="mt-1 flex justify-between text-sm">
              <span className="text-slate-500">Time taken</span>
              <span className="font-medium text-navy-dark">
                {Math.floor(submission.durationSec / 60)}m{" "}
                {submission.durationSec % 60}s
              </span>
            </div>
          </div>
        </div>

        {/* Answers */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold text-navy">Answers</h2>
          <div className="mt-4 space-y-4">
            {submission.answers.map((a, idx) => {
              const correctOpt = a.question.options.find((o) => o.isCorrect);
              return (
                <div
                  key={a.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-navy-dark">
                      <span className="mr-1 text-gold-dark">{idx + 1}.</span>
                      {a.question.text}
                    </p>
                    <span
                      className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                        a.isCorrect
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {a.isCorrect ? "Correct" : "Wrong"}
                    </span>
                  </div>
                  <div className="mt-3 space-y-1.5 text-sm">
                    {a.question.options.map((o) => {
                      const isSelected = o.id === a.selectedOptionId;
                      const isCorrect = o.isCorrect;
                      return (
                        <div
                          key={o.id}
                          className={`flex items-center gap-2 rounded px-2 py-1 ${
                            isCorrect
                              ? "bg-green-50 text-green-800"
                              : isSelected
                                ? "bg-red-50 text-red-800"
                                : "text-slate-600"
                          }`}
                        >
                          <span className="font-semibold">{o.label}.</span>
                          <span>{o.text}</span>
                          {isCorrect && (
                            <span className="ml-auto text-xs font-semibold">
                              ✓ correct answer
                            </span>
                          )}
                          {isSelected && !isCorrect && (
                            <span className="ml-auto text-xs font-semibold">
                              student&apos;s choice
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {!a.selectedOptionId && (
                      <p className="text-xs italic text-slate-400">
                        Not answered (correct answer: {correctOpt?.label}).
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
