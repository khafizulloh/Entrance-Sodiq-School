"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { StudentInfo } from "@/lib/validation";
import type { ClientTest } from "@/lib/types";
import { StudentForm } from "./StudentForm";
import { Quiz } from "./Quiz";

type Stage = "form" | "test";

/** Orchestrates the full student journey: form → fetch test → quiz → submit. */
export function TestFlow() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("form");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<StudentInfo | null>(null);
  const [test, setTest] = useState<ClientTest | null>(null);

  // Step 1: load the test for the chosen grade.
  async function handleInfoSubmit(values: StudentInfo) {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/tests?grade=${values.grade}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not load the test.");
      setInfo(values);
      setTest(data as ClientTest);
      setStage("test");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  // Step 2: submit answers, store result, go to thank-you page.
  async function handleTestSubmit(
    answers: Record<string, string>,
    durationSec: number,
  ) {
    if (!info || !test) return;
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        student: info,
        testId: test.id,
        durationSec,
        answers: test.questions.map((q) => ({
          questionId: q.id,
          selectedOptionId: answers[q.id] ?? null,
        })),
      };
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not submit the test.");

      // Pass the result to the thank-you page via sessionStorage.
      sessionStorage.setItem(
        "sodiq_result",
        JSON.stringify({ ...data, name: info.fullName }),
      );
      router.push("/thank-you");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <div>
      {error && (
        <div className="mx-auto mb-4 max-w-2xl rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {stage === "form" && (
        <StudentForm loading={loading} onSubmit={handleInfoSubmit} />
      )}

      {stage === "test" && test && (
        <Quiz
          test={test}
          submitting={submitting}
          onSubmit={(answers, durationSec) =>
            handleTestSubmit(answers, durationSec)
          }
        />
      )}
    </div>
  );
}
