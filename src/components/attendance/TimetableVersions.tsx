"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The uploaded timetable versions. Each one's start date can be corrected,
 * which is what makes lessons appear for dates earlier in the term.
 */

export type VersionRow = {
  id: string;
  name: string;
  effectiveFrom: string;
  slotCount: number;
  uploadedBy: string | null;
  state: "in-force" | "later" | "replaced";
};

export function TimetableVersions({ versions }: { versions: VersionRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead className="bg-navy text-left text-xs uppercase tracking-wider text-white">
          <tr>
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">In force from</th>
            <th className="px-4 py-2.5">Lessons</th>
            <th className="px-4 py-2.5">Uploaded by</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {versions.map((version) => (
            <VersionRowEditor key={version.id} version={version} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VersionRowEditor({ version }: { version: VersionRow }) {
  const router = useRouter();
  const [date, setDate] = useState(version.effectiveFrom);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const changed = date !== version.effectiveFrom;

  async function save() {
    setState("saving");
    setError(null);

    const res = await fetch(`/api/attendance/head/timetable/${version.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ effectiveFrom: date }),
    });
    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      setState("error");
      setError(body.error ?? "Could not change the date.");
      return;
    }
    setState("saved");
    router.refresh();
  }

  return (
    <tr className="border-t border-slate-100">
      <td className="px-4 py-2.5 font-medium text-navy">{version.name}</td>
      <td className="px-4 py-2.5">
        <input
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm text-navy-dark outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
        {error && <p className="mt-1 text-[11px] text-red-700">{error}</p>}
        {state === "saved" && !changed && (
          <p className="mt-1 text-[11px] font-semibold text-green-700">Saved</p>
        )}
      </td>
      <td className="px-4 py-2.5 text-slate-600">{version.slotCount}</td>
      <td className="px-4 py-2.5 text-slate-600">{version.uploadedBy ?? "—"}</td>
      <td className="px-4 py-2.5">
        {changed ? (
          <button
            type="button"
            className="btn-brand px-3 py-1.5 text-xs"
            onClick={save}
            disabled={state === "saving"}
          >
            {state === "saving" ? "Saving…" : "Save date"}
          </button>
        ) : version.state === "in-force" ? (
          <span className="rounded-full bg-brand/20 px-2.5 py-0.5 text-xs font-semibold text-brand-dark">
            In force now
          </span>
        ) : version.state === "later" ? (
          <span className="text-xs text-slate-500">starts later</span>
        ) : (
          <span className="text-xs text-slate-400">replaced</span>
        )}
      </td>
    </tr>
  );
}
