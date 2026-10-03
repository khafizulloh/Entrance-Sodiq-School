"use client";

import { useState } from "react";
import { SUBJECTS, bandLabel, subjectLabel } from "@/lib/attendance/subjects";

/**
 * Asks the head teacher to put a student in another group. Nothing changes
 * until they approve, in the app or from the Telegram bot.
 *
 * Whether that is a move or simply joining depends on the track chosen: a
 * student with no SAT Math group is added to one, while a student already in
 * 5-E1 is moved out of it. The wording follows the choice.
 */

export type MoveTarget = {
  id: string;
  name: string;
  grade: number;
  subject: string;
  teacherName: string | null;
};

export function MoveRequestDialog({
  pupil,
  fromGroupId,
  fromGroupName,
  targets,
  currentByTrack,
  onClose,
  onDone,
  headMode = false,
}: {
  pupil: { id: string; firstName: string; lastName: string };
  fromGroupId: string | null;
  fromGroupName: string | null;
  targets: MoveTarget[];
  /** The group the student is in now for each track, if any. */
  currentByTrack: Record<string, string>;
  onClose: () => void;
  onDone: (message: string) => void;
  headMode?: boolean;
}) {
  const [toGroupId, setToGroupId] = useState("");
  const [moveRecords, setMoveRecords] = useState(true);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const chosen = targets.find((target) => target.id === toGroupId) ?? null;
  const leaving = chosen ? (currentByTrack[chosen.subject] ?? null) : null;
  // No group in that track yet, so this adds them rather than moving them.
  const isAdd = Boolean(chosen) && !leaving;
  const action = isAdd ? "Add to a group" : headMode ? "Move student" : "Request a move";

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    const res = await fetch("/api/attendance/moves", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pupilId: pupil.id,
        toGroupId,
        fromGroupId,
        reason: reason.trim() || null,
        moveRecords,
      }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setError(body.error ?? "Could not send the request.");
      setBusy(false);
      return;
    }

    onDone(
      headMode
        ? `${isAdd ? "Request" : "Move"} created. Confirm it in the move requests queue.`
        : "Request sent to the head teacher.",
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-navy/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
        <h2 className="text-lg font-bold text-navy">{action}</h2>
        <p className="mt-1 text-sm text-slate-600">
          {pupil.firstName} {pupil.lastName}
          {fromGroupName ? ` · currently in ${fromGroupName}` : " · no group yet"}
        </p>

        <form onSubmit={submit} className="mt-4 space-y-4">
          <div>
            <label className="label" htmlFor="toGroup">
              Move to
            </label>
            <select
              id="toGroup"
              className="input"
              value={toGroupId}
              onChange={(event) => setToGroupId(event.target.value)}
              required
            >
              <option value="">Choose a group…</option>
              {SUBJECTS.filter((subject) =>
                targets.some((target) => target.subject === subject),
              ).map((subject) => (
                <optgroup key={subject} label={subjectLabel(subject)}>
                  {targets
                    .filter((target) => target.subject === subject)
                    .map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.name} · {bandLabel(target.subject, target.grade)}
                        {target.teacherName ? ` · ${target.teacherName}` : ""}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
            {targets.length === 0 && (
              <p className="mt-1.5 text-xs text-slate-500">
                No other group in this track.
              </p>
            )}
            <p className="mt-1.5 text-xs text-slate-500">
              A student only moves within one track. General English, SAT English and
              SAT Math are kept apart.
            </p>
          </div>

          {chosen && (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
              {isAdd ? (
                <>
                  {pupil.firstName} has no {subjectLabel(chosen.subject)} group.
                  Approving puts them in{" "}
                  <span className="font-semibold text-navy">{chosen.name}</span>.
                </>
              ) : (
                <>
                  {pupil.firstName} is in{" "}
                  <span className="font-semibold text-navy">{leaving}</span> for{" "}
                  {subjectLabel(chosen.subject)}. Approving moves them to{" "}
                  <span className="font-semibold text-navy">{chosen.name}</span>.
                </>
              )}
            </p>
          )}

          {!isAdd && (
            <label className="flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm">
              <input
                type="checkbox"
                checked={moveRecords}
                onChange={(event) => setMoveRecords(event.target.checked)}
                className="mt-0.5 h-4 w-4"
              />
              <span>
                <span className="font-medium text-navy">
                  Carry existing records across
                </span>
                <span className="mt-0.5 block text-xs text-slate-500">
                  Attendance and marks already taken follow the student and show in the
                  new group&apos;s register in a lighter colour, so everyone can see they
                  were taken in the previous group.
                </span>
              </span>
            </label>
          )}

          <div>
            <label className="label" htmlFor="reason">
              Reason <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              id="reason"
              className="input min-h-[72px]"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="e.g. This student is on my list but attends 5-E2."
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex gap-2">
            <button type="button" className="btn-outline flex-1" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-brand flex-1"
              disabled={busy || !toGroupId}
            >
              {busy ? "Sending…" : headMode ? action : "Send request"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
