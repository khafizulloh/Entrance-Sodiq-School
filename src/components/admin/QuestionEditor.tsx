"use client";

import { useState } from "react";
import { Spinner } from "@/components/Spinner";
import { SOURCES } from "@/lib/levels";

export type OptionInput = {
  label: "A" | "B" | "C" | "D";
  text: string;
  isCorrect: boolean;
};

export type QuestionData = {
  id?: string;
  text: string;
  order: number;
  source: string | null;
  options: OptionInput[];
};

const LABELS: OptionInput["label"][] = ["A", "B", "C", "D"];

export function emptyQuestion(order: number): QuestionData {
  return {
    text: "",
    order,
    source: null,
    options: LABELS.map((label) => ({ label, text: "", isCorrect: false })),
  };
}

/** Inline form for creating or editing a single question with 4 options. */
export function QuestionEditor({
  initial,
  onCancel,
  onSave,
}: {
  initial: QuestionData;
  onCancel: () => void;
  onSave: (q: QuestionData) => Promise<void>;
}) {
  const [text, setText] = useState(initial.text);
  const [source, setSource] = useState<string>(initial.source ?? "");
  const [options, setOptions] = useState<OptionInput[]>(initial.options);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setOption(idx: number, patch: Partial<OptionInput>) {
    setOptions((opts) =>
      opts.map((o, i) => (i === idx ? { ...o, ...patch } : o)),
    );
  }

  function setCorrect(idx: number) {
    setOptions((opts) => opts.map((o, i) => ({ ...o, isCorrect: i === idx })));
  }

  async function save() {
    setError(null);
    if (!text.trim()) return setError("Question text is required.");
    if (options.some((o) => !o.text.trim()))
      return setError("All four options need text.");
    if (options.filter((o) => o.isCorrect).length !== 1)
      return setError("Mark exactly one option as correct.");

    setSaving(true);
    try {
      await onSave({
        ...initial,
        text: text.trim(),
        source: source || null,
        options,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border-2 border-navy/20 bg-navy/5 p-4">
      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <label className="label">Question</label>
      <textarea
        className="input min-h-[70px]"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Enter the question…"
      />

      <div className="mt-3 max-w-xs">
        <label className="label">Source (publisher)</label>
        <select
          className="input"
          value={source}
          onChange={(e) => setSource(e.target.value)}
        >
          <option value="">— Not set —</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-400">
          Only Cambridge, Oxford, or Pearson materials.
        </p>
      </div>

      <p className="mt-3 mb-1 text-sm font-medium text-navy-dark">
        Options (select the correct one)
      </p>
      <div className="space-y-2">
        {options.map((o, idx) => (
          <div key={o.label} className="flex items-center gap-2">
            <input
              type="radio"
              name="correct-option"
              className="accent-navy"
              checked={o.isCorrect}
              onChange={() => setCorrect(idx)}
              title="Mark as correct answer"
            />
            <span className="w-5 font-semibold text-navy">{o.label}</span>
            <input
              className="input"
              value={o.text}
              onChange={(e) => setOption(idx, { text: e.target.value })}
              placeholder={`Option ${o.label}`}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 flex gap-2">
        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? <Spinner /> : null}
          {saving ? "Saving…" : "Save question"}
        </button>
        <button className="btn-outline" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </div>
  );
}
