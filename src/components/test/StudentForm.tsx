"use client";

import { useState } from "react";
import { studentInfoSchema, type StudentInfo } from "@/lib/validation";
import { GRADES, BRANCHES } from "@/lib/levels";
import { Spinner } from "@/components/Spinner";

type Props = {
  loading: boolean;
  onSubmit: (info: StudentInfo) => void;
};

const empty: StudentInfo = {
  fullName: "",
  phone: "",
  parentPhone: "",
  grade: 0 as unknown as number,
  previousSchool: "",
  branch: "",
  telegram: "",
  dateOfBirth: "",
};

/** Personal information form shown before the test begins. */
export function StudentForm({ loading, onSubmit }: Props) {
  const [values, setValues] = useState<StudentInfo>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function update<K extends keyof StudentInfo>(key: K, value: StudentInfo[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = studentInfoSchema.safeParse(values);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.errors) {
        const key = String(issue.path[0]);
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    onSubmit(parsed.data);
  }

  return (
    <form onSubmit={handleSubmit} className="card mx-auto max-w-2xl" noValidate>
      <h1 className="text-2xl font-bold text-navy">Student Registration</h1>
      <p className="mt-1 text-sm text-slate-500">
        Please fill in your details. Fields marked with * are required.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="Full name *" error={errors.fullName} className="sm:col-span-2">
          <input
            className="input"
            value={values.fullName}
            onChange={(e) => update("fullName", e.target.value)}
            placeholder="e.g. Ali Valiyev"
          />
        </Field>

        <Field label="Phone number *" error={errors.phone}>
          <input
            className="input"
            value={values.phone}
            onChange={(e) => update("phone", e.target.value)}
            placeholder="+998 90 123 45 67"
            inputMode="tel"
          />
        </Field>

        <Field label="Parent phone number *" error={errors.parentPhone}>
          <input
            className="input"
            value={values.parentPhone}
            onChange={(e) => update("parentPhone", e.target.value)}
            placeholder="+998 90 123 45 67"
            inputMode="tel"
          />
        </Field>

        <Field label="Current grade *" error={errors.grade}>
          <select
            className="input"
            value={values.grade || ""}
            onChange={(e) => update("grade", Number(e.target.value))}
          >
            <option value="">Select grade</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                Grade {g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Preferred branch / study option" error={errors.branch}>
          <select
            className="input"
            value={values.branch}
            onChange={(e) => update("branch", e.target.value)}
          >
            <option value="">Select branch</option>
            {BRANCHES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Previous school" error={errors.previousSchool}>
          <input
            className="input"
            value={values.previousSchool}
            onChange={(e) => update("previousSchool", e.target.value)}
            placeholder="Name of previous school"
          />
        </Field>

        <Field label="Telegram username" error={errors.telegram}>
          <input
            className="input"
            value={values.telegram}
            onChange={(e) => update("telegram", e.target.value)}
            placeholder="@username"
          />
        </Field>

        <Field label="Date of birth" error={errors.dateOfBirth}>
          <input
            type="date"
            className="input"
            value={values.dateOfBirth}
            onChange={(e) => update("dateOfBirth", e.target.value)}
          />
        </Field>
      </div>

      <button type="submit" className="btn-gold mt-6 w-full" disabled={loading}>
        {loading ? <Spinner /> : null}
        {loading ? "Loading test…" : "Continue to Test →"}
      </button>
    </form>
  );
}

function Field({
  label,
  error,
  children,
  className = "",
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
