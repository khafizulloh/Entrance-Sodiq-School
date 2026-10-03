"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { MoveStatusBadge } from "./MoveStatusBadge";

/**
 * The head teacher's move queue. Approving carries out the move and, when
 * asked for, carries the student's existing records across.
 */

export type MoveRow = {
  id: string;
  status: string;
  pupilName: string;
  grade: number;
  fromGroup: string | null;
  toGroup: string;
  requestedBy: string | null;
  source: string;
  reason: string | null;
  moveRecords: boolean;
  recordCount: number;
  recordsMoved: number;
  createdAt: string;
  decidedAt: string | null;
};

export function MoveQueue({ requests }: { requests: MoveRow[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function decide(id: string, decision: "APPROVE" | "REJECT") {
    setBusyId(id);
    setError(null);
    setDone(null);

    const res = await fetch(`/api/attendance/moves/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    const body = await res.json().catch(() => ({}));
    setBusyId(null);

    if (!res.ok) {
      setError(body.error ?? "Could not apply the decision.");
      return;
    }

    const request = requests.find((row) => row.id === id);
    setDone(
      decision === "APPROVE"
        ? !request?.fromGroup
          ? `Done. ${request?.pupilName ?? "The student"} is now in ${request?.toGroup ?? "the group"}.`
          : body.recordsMoved > 0
            ? `Moved. ${body.recordsMoved} earlier record(s) carried across and shown in a lighter colour in the new group.`
            : "Moved. The student had no records to carry."
        : "Request rejected.",
    );
    router.refresh();
  }

  const pending = requests.filter((request) => request.status === "PENDING");
  const decided = requests.filter((request) => request.status !== "PENDING");

  return (
    <div className="space-y-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {done && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{done}</p>
      )}

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          Waiting for you ({pending.length})
        </h2>

        {pending.length === 0 ? (
          <div className="card text-sm text-slate-600">
            No requests waiting. Teachers&apos; requests land here, and in the Telegram bot
            if it is set up.
          </div>
        ) : (
          <div className="space-y-3">
            {pending.map((request) => (
              <div
                key={request.id}
                className="rounded-xl border-2 border-brand bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <span
                      className={`mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                        request.fromGroup
                          ? "bg-navy/10 text-navy"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {request.fromGroup ? "Move" : "Add to a group"}
                    </span>
                    <p className="text-lg font-bold text-navy">{request.pupilName}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      Grade {request.grade} · {request.fromGroup ?? "no group yet"}{" "}
                      <span className="font-bold text-brand-dark">→</span> {request.toGroup}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {request.source === "HEAD"
                        ? "Created by you — confirm to apply"
                        : `Requested by ${request.requestedBy ?? "a teacher"}`}{" "}
                      · {request.createdAt}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => decide(request.id, "REJECT")}
                      disabled={busyId === request.id}
                    >
                      Reject
                    </button>
                    <button
                      type="button"
                      className="btn-brand"
                      onClick={() => decide(request.id, "APPROVE")}
                      disabled={busyId === request.id}
                    >
                      {busyId === request.id ? "Applying…" : "Approve"}
                    </button>
                  </div>
                </div>

                {request.reason && (
                  <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    “{request.reason}”
                  </p>
                )}

                <p className="mt-3 text-xs text-slate-500">
                  {!request.fromGroup
                    ? `${request.pupilName} has no group in this track yet, so approving simply puts them in ${request.toGroup}.`
                    : request.recordCount === 0
                      ? "This student has no attendance records yet, so the move is a clean swap of class lists."
                      : request.moveRecords
                        ? `${request.recordCount} existing record(s) will travel with the student and appear faded in ${request.toGroup}, marked as taken in ${request.fromGroup}.`
                        : `${request.recordCount} existing record(s) will stay with ${request.fromGroup} only.`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
            Decided
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-sm">
              <thead className="bg-navy text-left text-xs uppercase tracking-wider text-white">
                <tr>
                  <th className="px-4 py-2.5">Student</th>
                  <th className="px-4 py-2.5">Move</th>
                  <th className="px-4 py-2.5">Records</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Decided</th>
                </tr>
              </thead>
              <tbody>
                {decided.map((request) => (
                  <tr key={request.id} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-navy">{request.pupilName}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {request.fromGroup ?? "—"} → {request.toGroup}
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {request.status === "APPROVED" ? request.recordsMoved : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <MoveStatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      {request.decidedAt ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
