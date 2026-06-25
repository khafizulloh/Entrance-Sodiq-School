"use client";

import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/Spinner";
import {
  QuestionEditor,
  emptyQuestion,
  type QuestionData,
} from "./QuestionEditor";

type TestRow = {
  id: string;
  grade: number;
  title: string;
  description: string | null;
  timeLimitSec: number;
  isActive: boolean;
  questionCount: number;
  submissionCount: number;
};

type ApiQuestion = {
  id: string;
  text: string;
  order: number;
  options: { id: string; label: string; text: string; isCorrect: boolean }[];
};

export function QuestionsManager() {
  const [tests, setTests] = useState<TestRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ApiQuestion[]>([]);
  const [loadingTests, setLoadingTests] = useState(true);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [editing, setEditing] = useState<QuestionData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selected = tests.find((t) => t.id === selectedId) ?? null;

  const loadTests = useCallback(async () => {
    setLoadingTests(true);
    try {
      const res = await fetch("/api/admin/tests");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load tests.");
      setTests(data);
      setSelectedId((cur) => cur ?? data[0]?.id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tests.");
    } finally {
      setLoadingTests(false);
    }
  }, []);

  const loadQuestions = useCallback(async (testId: string) => {
    setLoadingQuestions(true);
    setEditing(null);
    try {
      const res = await fetch(`/api/admin/questions?testId=${testId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load questions.");
      setQuestions(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load questions.");
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  useEffect(() => {
    loadTests();
  }, [loadTests]);

  useEffect(() => {
    if (selectedId) loadQuestions(selectedId);
  }, [selectedId, loadQuestions]);

  async function saveTestSettings(patch: Partial<TestRow>) {
    if (!selected) return;
    const res = await fetch(`/api/admin/tests/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) loadTests();
    else alert("Could not update test settings.");
  }

  async function saveQuestion(q: QuestionData) {
    if (!selectedId) return;
    const isEdit = Boolean(q.id);
    const url = isEdit
      ? `/api/admin/questions/${q.id}`
      : "/api/admin/questions";
    const res = await fetch(url, {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        testId: selectedId,
        text: q.text,
        order: q.order,
        options: q.options,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Could not save question.");
    setEditing(null);
    await loadQuestions(selectedId);
    loadTests(); // refresh question counts
  }

  async function deleteQuestion(id: string) {
    if (!confirm("Delete this question?")) return;
    const res = await fetch(`/api/admin/questions/${id}`, { method: "DELETE" });
    if (res.ok && selectedId) {
      loadQuestions(selectedId);
      loadTests();
    }
  }

  function startEdit(q: ApiQuestion) {
    setEditing({
      id: q.id,
      text: q.text,
      order: q.order,
      options: ["A", "B", "C", "D"].map((label) => {
        const found = q.options.find((o) => o.label === label);
        return {
          label: label as "A" | "B" | "C" | "D",
          text: found?.text ?? "",
          isCorrect: found?.isCorrect ?? false,
        };
      }),
    });
  }

  if (loadingTests) {
    return (
      <p className="text-slate-400">
        <Spinner /> Loading tests…
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      {/* Grade list */}
      <aside className="space-y-1">
        {tests.map((t) => (
          <button
            key={t.id}
            onClick={() => setSelectedId(t.id)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
              t.id === selectedId
                ? "bg-navy text-white"
                : "bg-white text-navy hover:bg-navy/5"
            }`}
          >
            <span className="font-medium">Grade {t.grade}</span>
            <span
              className={`text-xs ${
                t.id === selectedId ? "text-slate-300" : "text-slate-400"
              }`}
            >
              {t.questionCount}q{t.isActive ? "" : " · off"}
            </span>
          </button>
        ))}
      </aside>

      {/* Selected test */}
      <div>
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {selected && (
          <>
            <TestSettings test={selected} onSave={saveTestSettings} />

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-navy">
                Questions ({selected.questionCount})
              </h2>
              {!editing && (
                <button
                  className="btn-gold"
                  onClick={() => setEditing(emptyQuestion(questions.length))}
                >
                  + Add question
                </button>
              )}
            </div>

            {editing && !editing.id && (
              <div className="mt-3">
                <QuestionEditor
                  initial={editing}
                  onCancel={() => setEditing(null)}
                  onSave={saveQuestion}
                />
              </div>
            )}

            <div className="mt-4 space-y-3">
              {loadingQuestions ? (
                <p className="text-slate-400">
                  <Spinner /> Loading questions…
                </p>
              ) : questions.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No questions yet. Click “Add question” to create one.
                </p>
              ) : (
                questions.map((q, idx) =>
                  editing?.id === q.id ? (
                    <QuestionEditor
                      key={q.id}
                      initial={editing}
                      onCancel={() => setEditing(null)}
                      onSave={saveQuestion}
                    />
                  ) : (
                    <div key={q.id} className="card">
                      <div className="flex items-start justify-between gap-3">
                        <p className="font-medium text-navy-dark">
                          <span className="mr-1 text-gold-dark">{idx + 1}.</span>
                          {q.text}
                        </p>
                        <div className="flex shrink-0 gap-2 text-sm">
                          <button
                            className="text-navy hover:underline"
                            onClick={() => startEdit(q)}
                          >
                            Edit
                          </button>
                          <button
                            className="text-red-600 hover:underline"
                            onClick={() => deleteQuestion(q.id)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                      <ul className="mt-2 space-y-1 text-sm">
                        {q.options.map((o) => (
                          <li
                            key={o.id}
                            className={
                              o.isCorrect
                                ? "font-medium text-green-700"
                                : "text-slate-600"
                            }
                          >
                            {o.label}. {o.text}
                            {o.isCorrect ? " ✓" : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
                )
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Editable settings panel for a single test (title, timer, active). */
function TestSettings({
  test,
  onSave,
}: {
  test: TestRow;
  onSave: (patch: Partial<TestRow>) => void;
}) {
  const [title, setTitle] = useState(test.title);
  const [minutes, setMinutes] = useState(Math.round(test.timeLimitSec / 60));

  // Keep local fields in sync when switching grades.
  useEffect(() => {
    setTitle(test.title);
    setMinutes(Math.round(test.timeLimitSec / 60));
  }, [test.id, test.title, test.timeLimitSec]);

  return (
    <div className="card">
      <div className="flex flex-wrap items-end gap-4">
        <div className="min-w-[200px] flex-1">
          <label className="label">Test title (Grade {test.grade})</label>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        <div className="w-40">
          <label className="label">Time limit (minutes)</label>
          <input
            type="number"
            min={1}
            className="input"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
          />
        </div>
        <label className="flex items-center gap-2 pb-2.5 text-sm font-medium text-navy">
          <input
            type="checkbox"
            className="h-4 w-4 accent-navy"
            checked={test.isActive}
            onChange={(e) => onSave({ isActive: e.target.checked })}
          />
          Active
        </label>
        <button
          className="btn-primary"
          onClick={() => onSave({ title, timeLimitSec: minutes * 60 })}
        >
          Save settings
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {test.submissionCount} submission(s) for this grade.
      </p>
    </div>
  );
}
