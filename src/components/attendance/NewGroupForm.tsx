"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  SUBJECTS,
  bandLabel,
  parseGroupName,
  subjectLabel,
} from "@/lib/attendance/subjects";

/**
 * Creates a group from the Groups page.
 *
 * The name normally says everything: "9-E5" is General English for grade 9,
 * "SAT - M3" is SAT Math. What the app worked out is shown while you type,
 * and can be set by hand for a name that does not follow the pattern.
 */
export function NewGroupForm({
  teachers,
}: {
  teachers: Array<{ id: string; fullName: string }>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [room, setRoom] = useState("");
  const [override, setOverride] = useState(false);
  const [subject, setSubject] = useState<string>("GENERAL_ENGLISH");
  const [grade, setGrade] = useState("5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const guess = useMemo(
    () => (name.trim() ? parseGroupName(name) : null),
    [name],
  );

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(null);

    const res = await fetch("/api/attendance/head/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        teacherId: teacherId || null,
        room: room || null,
        ...(override ? { subject, grade: Number(grade) } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not create the group.");
      return;
    }

    setDone(
      `${body.group.name} created. Add its lessons with a timetable upload.`,
    );
    setName("");
    setTeacherId("");
    setRoom("");
    setOverride(false);
    router.refresh();
  }

  if (!open) {
    return (
      <button type="button" className="btn-brand" onClick={() => setOpen(true)}>
        New group
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy/50 p-4 sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-3xl rounded-xl bg-white p-6 text-left shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-navy">New group</h2>
            <p className="mt-1 text-sm text-slate-600">
              For one extra group. A whole list of them is quicker to upload.
            </p>
          </div>
          <button
            type="button"
            className="text-sm font-semibold text-slate-500 hover:text-navy"
            onClick={() => setOpen(false)}
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="group-name">
              Name
            </label>
            <input
              id="group-name"
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="9-E5"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="group-teacher">
              Teacher{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <select
              id="group-teacher"
              className="input"
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
            >
              <option value="">No teacher yet</option>
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.fullName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="group-room">
              Room{" "}
              <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="group-room"
              className="input"
              value={room}
              onChange={(event) => setRoom(event.target.value)}
              placeholder="201"
            />
          </div>
          <div className="flex items-end">
            <p className="pb-2.5 text-xs text-slate-600">
              {guess ? (
                <>
                  Read as{" "}
                  <span className="font-semibold text-navy">
                    {subjectLabel(guess.subject)}
                  </span>
                  , {bandLabel(guess.subject, guess.grade).toLowerCase()}
                </>
              ) : (
                "Type a name to see how it will be read."
              )}
            </p>
          </div>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={override}
            onChange={(event) => setOverride(event.target.checked)}
            className="h-4 w-4"
          />
          Set the track and grades myself
        </label>

        {override && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label" htmlFor="group-subject">
                Track
              </label>
              <select
                id="group-subject"
                className="input"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
              >
                {SUBJECTS.map((value) => (
                  <option key={value} value={value}>
                    {subjectLabel(value)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="group-grade">
                Grades
              </label>
              <select
                id="group-grade"
                className="input"
                value={grade}
                onChange={(event) => setGrade(event.target.value)}
              >
                <option value="5">Grades 5–6</option>
                <option value="7">Grade 7</option>
                <option value="8">Grade 8</option>
                <option value="9">Grade 9</option>
                <option value="11">Grades 10–11</option>
              </select>
              <p className="mt-1 text-[11px] text-slate-500">
                Students can only be moved between groups of the same track and
                grades.
              </p>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {done && (
          <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
            {done}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="btn-outline"
            onClick={() => setOpen(false)}
          >
            {done ? "Close" : "Cancel"}
          </button>
          <button
            type="submit"
            className="btn-brand"
            disabled={busy || !name.trim()}
          >
            {busy ? "Creating…" : "Create group"}
          </button>
        </div>
      </form>
    </div>
  );
}
