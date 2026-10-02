"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { periodLabel } from "@/lib/attendance/periods";
import {
  type AttendanceStatus,
  STATUS_LABEL,
  STATUS_SHORT,
  subjectLabel,
} from "@/lib/attendance/subjects";
import type { RegisterData } from "@/lib/attendance/register";
import { MoveRequestDialog, type MoveTarget } from "./MoveRequestDialog";

/**
 * The group register: students down the side, two columns per lesson
 * (attendance + mark). Tapping a cell cycles P → A → L → E → blank.
 *
 * "Everyone present" fills the whole column in one tap, so the teacher only
 * changes the students who are missing.
 *
 * Records carried over with a moved student are shown in a lighter style and
 * cannot be edited here — they were taken in the student's previous group.
 */

type Cell = RegisterData["cells"][string][string];

const STATUS_CYCLE: Array<AttendanceStatus | null> = [
  "PRESENT",
  "ABSENT",
  "LATE",
  "EXCUSED",
  null,
];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-100 text-green-800 border-green-300",
  ABSENT: "bg-red-100 text-red-700 border-red-300",
  LATE: "bg-amber-100 text-amber-800 border-amber-300",
  EXCUSED: "bg-sky-100 text-sky-800 border-sky-300",
};

const TRANSFERRED_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-green-50 text-green-500 border-green-100",
  ABSENT: "bg-red-50 text-red-400 border-red-100",
  LATE: "bg-amber-50 text-amber-500 border-amber-100",
  EXCUSED: "bg-sky-50 text-sky-500 border-sky-100",
};

function nextStatus(current: string | undefined): AttendanceStatus | null {
  const index = STATUS_CYCLE.indexOf((current ?? null) as AttendanceStatus | null);
  return STATUS_CYCLE[(index + 1) % STATUS_CYCLE.length];
}

type PendingEntry = { status?: AttendanceStatus | null; mark?: number | null };

export function RegisterTable({
  data,
  moveTargets,
  focusKey,
  canEdit,
}: {
  data: RegisterData;
  moveTargets: MoveTarget[];
  focusKey: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [cells, setCells] = useState(data.cells);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [movePupil, setMovePupil] = useState<RegisterData["pupils"][number] | null>(null);

  // Keep the local grid in step when the server sends a fresh register.
  useEffect(() => setCells(data.cells), [data.cells]);

  const editableColumns = useMemo(
    () => data.columns.filter((column) => !column.isFuture),
    [data.columns],
  );

  const defaultFocus =
    focusKey && data.columns.some((column) => column.key === focusKey)
      ? focusKey
      : (data.columns.find((column) => column.isToday)?.key ??
        editableColumns[editableColumns.length - 1]?.key ??
        null);

  const [focused, setFocused] = useState<string | null>(defaultFocus);
  const focusedColumn = data.columns.find((column) => column.key === focused) ?? null;

  // ---------------------------------------------------------------- saving
  const pending = useRef(new Map<string, Map<string, PendingEntry>>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    const batches = [...pending.current.entries()];
    pending.current.clear();
    if (batches.length === 0) return;

    setSaveState("saving");
    try {
      for (const [key, entries] of batches) {
        const [date, period] = key.split("#");
        const res = await fetch("/api/attendance/attendance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            groupId: data.group.id,
            date,
            period: Number(period),
            entries: [...entries.entries()].map(([pupilId, entry]) => ({
              pupilId,
              ...entry,
            })),
          }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? "Could not save.");
        }
      }
      setSaveState("saved");
      setError(null);
    } catch (saveError) {
      setSaveState("error");
      setError(saveError instanceof Error ? saveError.message : "Could not save.");
    }
  }, [data.group.id]);

  const queue = useCallback(
    (columnKey: string, pupilId: string, entry: PendingEntry) => {
      const column = pending.current.get(columnKey) ?? new Map<string, PendingEntry>();
      column.set(pupilId, { ...column.get(pupilId), ...entry });
      pending.current.set(columnKey, column);

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, 700);
    },
    [flush],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  // ---------------------------------------------------------------- actions
  function cycle(pupilId: string, column: (typeof data.columns)[number]) {
    if (!canEdit || column.isFuture) return;
    const cell = cells[pupilId]?.[column.key];
    if (cell?.transferred) return;

    const status = nextStatus(cell?.status);
    setCells((previous) => {
      const row = { ...(previous[pupilId] ?? {}) };
      if (status === null && (cell?.mark === null || cell?.mark === undefined)) {
        delete row[column.key];
      } else {
        row[column.key] = {
          status: status ?? "",
          mark: cell?.mark ?? null,
          note: cell?.note ?? null,
          transferred: false,
          originGroupName: null,
        };
      }
      return { ...previous, [pupilId]: row };
    });
    queue(column.key, pupilId, { status });
  }

  function setMark(pupilId: string, column: (typeof data.columns)[number], raw: string) {
    if (!canEdit || column.isFuture) return;
    const cell = cells[pupilId]?.[column.key];
    if (cell?.transferred) return;

    const trimmed = raw.trim();
    if (trimmed !== "" && !/^\d{1,3}$/.test(trimmed)) return;
    const mark = trimmed === "" ? null : Math.min(100, Number(trimmed));

    setCells((previous) => {
      const row = { ...(previous[pupilId] ?? {}) };
      const existing = row[column.key];
      if (mark === null && !existing?.status) {
        delete row[column.key];
      } else {
        row[column.key] = {
          status: existing?.status ?? "",
          mark,
          note: existing?.note ?? null,
          transferred: false,
          originGroupName: null,
        };
      }
      return { ...previous, [pupilId]: row };
    });
    queue(column.key, pupilId, { mark });
  }

  async function markAllPresent() {
    if (!canEdit || !focusedColumn || focusedColumn.isFuture) return;
    setSaveState("saving");
    try {
      const res = await fetch("/api/attendance/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: data.group.id,
          date: focusedColumn.date,
          period: focusedColumn.period,
          markAllPresent: true,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Could not save.");

      setCells((previous) => {
        const next = { ...previous };
        for (const pupil of data.pupils) {
          const row = { ...(next[pupil.id] ?? {}) };
          const existing = row[focusedColumn.key];
          if (existing?.transferred) continue;
          row[focusedColumn.key] = {
            status: "PRESENT",
            mark: existing?.mark ?? null,
            note: existing?.note ?? null,
            transferred: false,
            originGroupName: null,
          };
          next[pupil.id] = row;
        }
        return next;
      });
      setSaveState("saved");
      setError(null);
    } catch (markError) {
      setSaveState("error");
      setError(markError instanceof Error ? markError.message : "Could not save.");
    }
  }

  const absencesOf = (pupilId: string) =>
    Object.values(cells[pupilId] ?? {}).filter((cell) => cell.status === "ABSENT").length;

  // ---------------------------------------------------------------- render
  return (
    <div className="space-y-4">
      {/* Today's lesson: the one-tap panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px]">
            <label className="label" htmlFor="lesson-select">
              Lesson
            </label>
            <select
              id="lesson-select"
              className="input"
              value={focused ?? ""}
              onChange={(event) => setFocused(event.target.value || null)}
            >
              {data.columns.length === 0 && <option value="">No lessons</option>}
              {data.columns.map((column) => (
                <option key={column.key} value={column.key} disabled={column.isFuture}>
                  {columnLabel(column.date)} · period {column.period}
                  {column.isToday ? " · today" : ""}
                  {column.isFuture ? " · upcoming" : ""}
                </option>
              ))}
            </select>
          </div>

          {focusedColumn && (
            <div className="text-sm text-slate-600">
              <span className="block font-semibold text-navy">
                {columnLabel(focusedColumn.date)} · Period {focusedColumn.period}
              </span>
              <span className="block text-xs">
                {periodLabel(focusedColumn.period)} · {subjectLabel(focusedColumn.subject)}
                {focusedColumn.room ? ` · Room ${focusedColumn.room}` : ""}
              </span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <SaveBadge state={saveState} />
            <button
              type="button"
              className="btn-brand"
              onClick={markAllPresent}
              disabled={!canEdit || !focusedColumn || focusedColumn.isFuture}
            >
              Everyone present
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {!canEdit && (
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
            You are viewing this register. Only the group&apos;s teacher and the head
            teacher can change it.
          </p>
        )}
      </div>

      {/* The register */}
      {data.pupils.length === 0 ? (
        <div className="card text-sm text-slate-600">
          No students in this group yet. The head teacher uploads the student list under
          Uploads → Students.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr>
                <th
                  className="sticky left-0 z-20 min-w-[200px] border-b border-r border-slate-200 bg-navy px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-white"
                  rowSpan={2}
                >
                  Student
                </th>
                <th
                  className="border-b border-r border-slate-200 bg-navy px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white"
                  rowSpan={2}
                >
                  Absent
                </th>
                {data.columns.map((column) => (
                  <th
                    key={column.key}
                    colSpan={2}
                    className={`border-b border-l border-slate-200 px-2 py-1.5 text-center text-xs font-semibold ${
                      column.key === focused
                        ? "bg-brand text-navy-dark"
                        : column.isToday
                          ? "bg-brand/20 text-navy"
                          : "bg-navy text-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setFocused(column.key)}
                      className="block w-full"
                      title={`${columnLabel(column.date)} · period ${column.period} · ${periodLabel(column.period)}`}
                    >
                      {columnLabel(column.date)}
                      <span className="block text-[10px] font-medium opacity-80">
                        P{column.period}
                      </span>
                    </button>
                  </th>
                ))}
                <th
                  className="border-b border-l border-slate-200 bg-navy px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-white"
                  rowSpan={2}
                >
                  Move
                </th>
              </tr>
              <tr>
                {data.columns.map((column) => (
                  <Fragment key={column.key}>
                    <th className="border-b border-l border-slate-200 bg-slate-100 px-1 py-1 text-[10px] font-semibold uppercase text-slate-500">
                      Att
                    </th>
                    <th className="border-b border-slate-200 bg-slate-100 px-1 py-1 text-[10px] font-semibold uppercase text-slate-500">
                      Mark
                    </th>
                  </Fragment>
                ))}
              </tr>
            </thead>

            <tbody>
              {data.pupils.map((pupil, index) => (
                <tr key={pupil.id} className="odd:bg-white even:bg-slate-50/60">
                  <th className="sticky left-0 z-10 min-w-[200px] border-b border-r border-slate-200 bg-inherit px-3 py-1.5 text-left font-medium text-navy">
                    <span className="mr-2 text-xs text-slate-400">{index + 1}</span>
                    {pupil.firstName}{" "}
                    <span className="font-semibold">{pupil.lastName}</span>
                  </th>

                  <td className="border-b border-r border-slate-200 px-2 py-1.5 text-center">
                    <span
                      className={`inline-block min-w-6 rounded px-1.5 text-xs font-bold ${
                        absencesOf(pupil.id) > 0
                          ? "bg-red-100 text-red-700"
                          : "text-slate-300"
                      }`}
                    >
                      {absencesOf(pupil.id)}
                    </span>
                  </td>

                  {data.columns.map((column) => {
                    const cell = cells[pupil.id]?.[column.key];
                    const status = (cell?.status || "") as AttendanceStatus | "";
                    const transferred = Boolean(cell?.transferred);
                    const styleMap = transferred ? TRANSFERRED_STYLE : STATUS_STYLE;

                    return (
                      <Fragment key={column.key}>
                        <td
                          className={`border-b border-l border-slate-200 p-1 text-center ${
                            column.key === focused ? "bg-brand/5" : ""
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => cycle(pupil.id, column)}
                            disabled={!canEdit || column.isFuture || transferred}
                            title={
                              transferred
                                ? `Taken in ${cell?.originGroupName ?? "the previous group"}`
                                : status
                                  ? STATUS_LABEL[status]
                                  : "Not taken"
                            }
                            className={`h-7 w-8 rounded border text-xs font-bold transition-colors ${
                              status
                                ? styleMap[status]
                                : "border-slate-200 bg-white text-slate-300 hover:border-brand"
                            } ${transferred ? "cursor-default italic" : ""} ${
                              column.isFuture ? "opacity-40" : ""
                            }`}
                          >
                            {status ? STATUS_SHORT[status] : "·"}
                          </button>
                        </td>

                        <td
                          className={`border-b border-slate-200 p-1 text-center ${
                            column.key === focused ? "bg-brand/5" : ""
                          }`}
                        >
                          <input
                            inputMode="numeric"
                            value={cell?.mark ?? ""}
                            onChange={(event) => setMark(pupil.id, column, event.target.value)}
                            disabled={!canEdit || column.isFuture || transferred}
                            title={
                              transferred
                                ? `Mark given in ${cell?.originGroupName ?? "the previous group"}`
                                : undefined
                            }
                            className={`h-7 w-11 rounded border border-slate-200 text-center text-xs outline-none focus:border-brand focus:ring-1 focus:ring-brand ${
                              transferred
                                ? "bg-slate-50 italic text-slate-400"
                                : "bg-white text-navy"
                            }`}
                          />
                        </td>
                      </Fragment>
                    );
                  })}

                  <td className="border-b border-l border-slate-200 px-2 py-1.5 text-center">
                    <button
                      type="button"
                      onClick={() => setMovePupil(pupil)}
                      className="rounded border border-slate-200 px-2 py-0.5 text-[11px] font-semibold text-navy transition-colors hover:border-brand hover:bg-brand/10"
                      title="Wrong student in this list? Request a move."
                    >
                      Move
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Legend />

      {movePupil && (
        <MoveRequestDialog
          pupil={movePupil}
          fromGroupId={data.group.id}
          fromGroupName={data.group.name}
          targets={moveTargets}
          onClose={() => setMovePupil(null)}
          onDone={() => {
            setMovePupil(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function columnLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  const day = parsed.toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
  const month = parsed.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
  return `${day} ${parsed.getUTCDate()} ${month}`;
}

function SaveBadge({ state }: { state: "idle" | "saving" | "saved" | "error" }) {
  if (state === "idle") return null;
  const text =
    state === "saving" ? "Saving…" : state === "saved" ? "Saved" : "Not saved";
  const style =
    state === "saved"
      ? "bg-green-100 text-green-800"
      : state === "error"
        ? "bg-red-100 text-red-700"
        : "bg-slate-100 text-slate-600";
  return (
    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${style}`}>{text}</span>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-600">
      <span className="font-semibold uppercase tracking-wider text-slate-400">Key</span>
      {(["PRESENT", "ABSENT", "LATE", "EXCUSED"] as AttendanceStatus[]).map((status) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className={`inline-flex h-5 w-6 items-center justify-center rounded border text-[11px] font-bold ${STATUS_STYLE[status]}`}
          >
            {STATUS_SHORT[status]}
          </span>
          {STATUS_LABEL[status]}
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span className="inline-flex h-5 w-6 items-center justify-center rounded border border-green-100 bg-green-50 text-[11px] font-bold italic text-green-500">
          P
        </span>
        Faded = taken in the student&apos;s previous group
      </span>
      <span>Tap a cell to change: P → A → L → E → blank</span>
    </div>
  );
}
