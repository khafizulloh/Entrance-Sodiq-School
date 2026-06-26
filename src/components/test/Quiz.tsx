"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ClientTest } from "@/lib/types";
import { Spinner } from "@/components/Spinner";

type Props = {
  test: ClientTest;
  submitting: boolean;
  /** answers: questionId -> selectedOptionId. durationSec: time spent. */
  onSubmit: (
    answers: Record<string, string>,
    durationSec: number,
    auto: boolean,
  ) => void;
};

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** The actual quiz: renders questions, tracks answers, and runs the timer. */
export function Quiz({ test, submitting, onSubmit }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [remaining, setRemaining] = useState(test.timeLimitSec);
  const [showConfirm, setShowConfirm] = useState(false);
  const startRef = useRef(Date.now());
  // Guard so the auto-submit on timeout only fires once.
  const submittedRef = useRef(false);

  const answeredCount = Object.keys(answers).length;
  const total = test.questions.length;
  const allAnswered = answeredCount === total;

  function doSubmit(auto: boolean) {
    if (submittedRef.current) return;
    submittedRef.current = true;
    const durationSec = Math.round((Date.now() - startRef.current) / 1000);
    onSubmit(answers, durationSec, auto);
  }

  // Countdown timer — auto-submits when it reaches zero.
  useEffect(() => {
    const id = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(id);
          doSubmit(true);
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lowTime = remaining <= 30;

  const progressPct = useMemo(
    () => (total > 0 ? Math.round((answeredCount / total) * 100) : 0),
    [answeredCount, total],
  );

  return (
    <div className="mx-auto max-w-2xl">
      {/* Sticky header with timer + progress */}
      <div className="sticky top-0 z-10 -mx-4 mb-4 border-b border-slate-200 bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-navy">{test.title}</p>
            <p className="text-xs text-slate-500">
              {answeredCount} of {total} answered
            </p>
          </div>
          <div
            className={`rounded-lg px-3 py-1.5 font-mono text-sm font-bold ${
              lowTime ? "bg-red-100 text-red-700" : "bg-navy/10 text-navy"
            }`}
            aria-live="polite"
          >
            ⏱ {formatTime(remaining)}
          </div>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full bg-brand transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="space-y-4">
        {test.questions.map((q, idx) => (
          <div key={q.id} className="card">
            <p className="font-medium text-navy-dark">
              <span className="mr-2 text-brand-dark">{idx + 1}.</span>
              {q.text}
            </p>
            <div className="mt-3 space-y-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt.id;
                return (
                  <label
                    key={opt.id}
                    className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition ${
                      selected
                        ? "border-navy bg-navy/5"
                        : "border-slate-200 hover:border-navy/40"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      className="mt-0.5 accent-navy"
                      checked={selected}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [q.id]: opt.id }))
                      }
                    />
                    <span>
                      <span className="font-semibold text-navy">
                        {opt.label}.
                      </span>{" "}
                      {opt.text}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-4 border-t border-slate-200 bg-[var(--background)]/95 px-4 py-3 backdrop-blur">
        <button
          className="btn-brand w-full"
          disabled={submitting}
          onClick={() => {
            if (allAnswered) doSubmit(false);
            else setShowConfirm(true);
          }}
        >
          {submitting ? <Spinner /> : null}
          {submitting ? "Submitting…" : "Submit Test"}
        </button>
      </div>

      {/* Confirm dialog when some questions are unanswered */}
      {showConfirm && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="card max-w-sm">
            <h3 className="text-lg font-bold text-navy">Submit with unanswered questions?</h3>
            <p className="mt-2 text-sm text-slate-600">
              You have answered {answeredCount} of {total} questions. Unanswered
              questions will be marked incorrect.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                className="btn-outline flex-1"
                onClick={() => setShowConfirm(false)}
              >
                Keep answering
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => {
                  setShowConfirm(false);
                  doSubmit(false);
                }}
              >
                Submit anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
