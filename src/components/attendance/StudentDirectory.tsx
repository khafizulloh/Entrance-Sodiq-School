"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { subjectLabel } from "@/lib/attendance/subjects";
import { MoveRequestDialog, type MoveTarget } from "./MoveRequestDialog";

/**
 * The student list with search, plus the head teacher's manual move.
 * A manual move is created as a request and takes effect once confirmed in
 * the move queue, so every move leaves a record of who approved it.
 */

export type StudentRow = {
  id: string;
  firstName: string;
  lastName: string;
  grade: number;
  className: string | null;
  externalId: string | null;
  groups: Array<{ id: string; name: string; subject: string }>;
  absences: number;
};

export function StudentDirectory({
  students,
  groups,
}: {
  students: StudentRow[];
  groups: MoveTarget[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [grade, setGrade] = useState("");
  const [moving, setMoving] = useState<StudentRow | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const grades = useMemo(
    () => [...new Set(students.map((student) => student.grade))].sort((a, b) => a - b),
    [students],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return students.filter((student) => {
      if (grade && String(student.grade) !== grade) return false;
      if (!needle) return true;
      const haystack = `${student.firstName} ${student.lastName} ${
        student.externalId ?? ""
      } ${student.className ?? ""} ${student.groups
        .map((group) => group.name)
        .join(" ")}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [students, query, grade]);

  // Every group the student is not already in. The move itself stays inside
  // one track: moving into a SAT Math group only ends their SAT Math place.
  const targetsFor = (student: StudentRow) => {
    const inGroups = new Set(student.groups.map((group) => group.id));
    return groups.filter((group) => !inGroups.has(group.id));
  };

  return (
    <div className="space-y-4">
      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="label" htmlFor="student-search">
            Search
          </label>
          <input
            id="student-search"
            className="input"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, UID, class or group"
          />
        </div>
        <div>
          <label className="label" htmlFor="grade-filter">
            Grade
          </label>
          <select
            id="grade-filter"
            className="input"
            value={grade}
            onChange={(event) => setGrade(event.target.value)}
          >
            <option value="">All</option>
            {grades.map((value) => (
              <option key={value} value={String(value)}>
                Grade {value}
              </option>
            ))}
          </select>
        </div>
        <span className="pb-2.5 text-sm text-slate-500">
          {filtered.length} of {students.length}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-navy text-left text-xs uppercase tracking-wider text-white">
            <tr>
              <th className="px-4 py-2.5">First name</th>
              <th className="px-4 py-2.5">Surname</th>
              <th className="px-4 py-2.5">Grade</th>
              <th className="px-4 py-2.5">Class</th>
              <th className="px-4 py-2.5">Groups</th>
              <th className="px-4 py-2.5">Absences</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, 400).map((student) => (
              <tr key={student.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 text-navy">{student.firstName}</td>
                <td className="px-4 py-2.5 font-semibold text-navy">{student.lastName}</td>
                <td className="px-4 py-2.5 text-slate-600">{student.grade}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">
                  {student.className ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-slate-600">
                  {student.groups.length === 0 ? (
                    <span className="text-amber-700">no group</span>
                  ) : (
                    student.groups.map((group) => (
                      <span
                        key={group.id}
                        className="mr-1.5 inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs"
                        title={subjectLabel(group.subject)}
                      >
                        {group.name}
                      </span>
                    ))
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <span
                    className={`font-semibold ${
                      student.absences > 0 ? "text-red-700" : "text-slate-300"
                    }`}
                  >
                    {student.absences}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button
                    type="button"
                    className="rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy hover:border-brand hover:bg-brand/10"
                    onClick={() => setMoving(student)}
                  >
                    Move
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length > 400 && (
          <p className="px-4 py-2 text-xs text-slate-500">
            Showing the first 400. Narrow the search to see the rest.
          </p>
        )}
      </div>

      {moving && (
        <MoveRequestDialog
          pupil={moving}
          fromGroupId={null}
          fromGroupName={moving.groups.map((group) => group.name).join(", ") || null}
          targets={targetsFor(moving)}
          headMode
          onClose={() => setMoving(null)}
          onDone={(text) => {
            setMoving(null);
            setMessage(text);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
