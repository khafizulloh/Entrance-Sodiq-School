"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { TestResult } from "@/lib/types";

type StoredResult = TestResult & { name?: string };

/** Reads the result saved by the test flow and displays it. */
export function ThankYouResult() {
  const [result, setResult] = useState<StoredResult | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = sessionStorage.getItem("sodiq_result");
    if (raw) {
      try {
        setResult(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    setLoaded(true);
  }, []);

  return (
    <div className="card mx-auto max-w-lg text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand/20 text-3xl">
        🎉
      </div>
      <h1 className="mt-4 text-2xl font-bold text-navy">Thank you!</h1>
      <p className="mt-2 text-sm text-slate-600">
        Your result has been submitted. Our team will contact you soon.
      </p>

      {loaded && result ? (
        <div className="mt-6 rounded-xl border border-navy/10 bg-navy/5 p-5">
          {result.name ? (
            <p className="text-sm text-slate-600">Result for</p>
          ) : null}
          {result.name ? (
            <p className="text-lg font-semibold text-navy">{result.name}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-4">
            <Stat label="Score" value={`${result.score}/${result.totalQuestions}`} />
            <Stat label="Percentage" value={`${result.percentage}%`} />
          </div>
          <div className="mt-4 rounded-lg bg-brand/15 px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-brand-dark">
              Suggested Level
            </p>
            <p className="text-lg font-bold text-navy">{result.level}</p>
          </div>
        </div>
      ) : loaded ? (
        <p className="mt-6 text-sm text-slate-500">
          No recent result found. If you just finished a test, your submission
          was still saved.
        </p>
      ) : null}

      <Link href="/" className="btn-outline mt-6 inline-flex">
        Back to Home
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white p-3 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-xl font-bold text-navy">{value}</p>
    </div>
  );
}
