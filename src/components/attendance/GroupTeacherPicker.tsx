"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Changes who teaches a group, and nothing else. The lesson slots from today
 * on follow the new teacher, so the group appears on their dashboard.
 */
export function GroupTeacherPicker({
  groupId,
  teacherId,
  teachers,
}: {
  groupId: string;
  teacherId: string | null;
  teachers: Array<{ id: string; fullName: string }>;
}) {
  const router = useRouter();
  const [value, setValue] = useState(teacherId ?? "");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setState("saving");
    setError(null);

    const res = await fetch(`/api/attendance/head/groups/${groupId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId: next || null }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setValue(previous);
      setState("error");
      setError(body.error ?? "Could not change the teacher.");
      return;
    }

    setState("saved");
    router.refresh();
  }

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        Teacher
      </label>
      <select
        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-navy-dark outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
        value={value}
        onChange={(event) => change(event.target.value)}
        disabled={state === "saving"}
      >
        <option value="">No teacher assigned</option>
        {teachers.map((teacher) => (
          <option key={teacher.id} value={teacher.id}>
            {teacher.fullName}
          </option>
        ))}
      </select>

      {state === "saving" && (
        <p className="mt-1 text-[11px] text-slate-500">Saving…</p>
      )}
      {state === "saved" && (
        <p className="mt-1 text-[11px] font-semibold text-green-700">
          Saved. The timetable from today follows the new teacher.
        </p>
      )}
      {error && <p className="mt-1 text-[11px] text-red-700">{error}</p>}
    </div>
  );
}
