"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GRADES, LEVELS } from "@/lib/levels";
import { Spinner } from "@/components/Spinner";

type Row = {
  submissionId: string;
  studentId: string;
  fullName: string;
  phone: string;
  parentPhone: string;
  grade: number;
  branch: string | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  level: string;
  allowRetake: boolean;
  createdAt: string;
};

type Filters = {
  q: string;
  grade: string;
  level: string;
  minScore: string;
  maxScore: string;
  dateFrom: string;
  dateTo: string;
};

const emptyFilters: Filters = {
  q: "",
  grade: "",
  level: "",
  minScore: "",
  maxScore: "",
  dateFrom: "",
  dateTo: "",
};

export function StudentsTable() {
  const [filters, setFilters] = useState<Filters>(emptyFilters);
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(
    (p: number) => {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([k, v]) => {
        if (v) params.set(k, v);
      });
      params.set("page", String(p));
      return params.toString();
    },
    [filters],
  );

  const load = useCallback(
    async (p: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/students?${buildQuery(p)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load students.");
        setRows(data.items);
        setTotal(data.total);
        setPage(data.page);
        setTotalPages(data.totalPages);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load.");
      } finally {
        setLoading(false);
      }
    },
    [buildQuery],
  );

  // Reload whenever filters change (debounced on the search box).
  useEffect(() => {
    const t = setTimeout(() => load(1), 300);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(id: string) {
    if (!confirm("Delete this submission? This cannot be undone.")) return;
    const res = await fetch(`/api/admin/students/${id}`, { method: "DELETE" });
    if (res.ok) load(page);
    else alert("Could not delete the submission.");
  }

  async function toggleRetake(id: string, current: boolean) {
    const res = await fetch(`/api/admin/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ allowRetake: !current }),
    });
    if (res.ok) load(page);
  }

  function update<K extends keyof Filters>(key: K, value: string) {
    setFilters((f) => ({ ...f, [key]: value }));
  }

  return (
    <div>
      {/* Filters */}
      <div className="card mb-4">
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label">Search (name / phone)</label>
            <input
              className="input"
              value={filters.q}
              onChange={(e) => update("q", e.target.value)}
              placeholder="Type a name or phone number…"
            />
          </div>
          <div>
            <label className="label">Grade</label>
            <select
              className="input"
              value={filters.grade}
              onChange={(e) => update("grade", e.target.value)}
            >
              <option value="">All grades</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  Grade {g}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Level</label>
            <select
              className="input"
              value={filters.level}
              onChange={(e) => update("level", e.target.value)}
            >
              <option value="">All levels</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Min %</label>
            <input
              type="number"
              className="input"
              value={filters.minScore}
              onChange={(e) => update("minScore", e.target.value)}
              min={0}
              max={100}
            />
          </div>
          <div>
            <label className="label">Max %</label>
            <input
              type="number"
              className="input"
              value={filters.maxScore}
              onChange={(e) => update("maxScore", e.target.value)}
              min={0}
              max={100}
            />
          </div>
          <div>
            <label className="label">From date</label>
            <input
              type="date"
              className="input"
              value={filters.dateFrom}
              onChange={(e) => update("dateFrom", e.target.value)}
            />
          </div>
          <div>
            <label className="label">To date</label>
            <input
              type="date"
              className="input"
              value={filters.dateTo}
              onChange={(e) => update("dateTo", e.target.value)}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            className="btn-outline"
            onClick={() => setFilters(emptyFilters)}
          >
            Clear filters
          </button>
          <a className="btn-gold" href={`/api/admin/export?${buildQuery(1)}`}>
            ⬇ Export CSV
          </a>
          <span className="ml-auto text-sm text-slate-500">
            {total} result{total === 1 ? "" : "s"}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Grade</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Date</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  <Spinner /> Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No students found.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.submissionId} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-navy">
                    {r.fullName}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.phone}</td>
                  <td className="px-4 py-3">Grade {r.grade}</td>
                  <td className="px-4 py-3">
                    {r.score}/{r.totalQuestions}{" "}
                    <span className="text-slate-400">({r.percentage}%)</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded bg-gold/15 px-2 py-0.5 text-xs font-medium text-gold-dark">
                      {r.level}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/admin/students/${r.submissionId}`}
                        className="text-navy hover:text-gold-dark"
                        title="View details"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => toggleRetake(r.submissionId, r.allowRetake)}
                        className={
                          r.allowRetake
                            ? "text-green-600 hover:underline"
                            : "text-slate-500 hover:underline"
                        }
                        title="Allow this student to retake the test"
                      >
                        {r.allowRetake ? "Retake ✓" : "Allow retake"}
                      </button>
                      <button
                        onClick={() => remove(r.submissionId)}
                        className="text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3">
          <button
            className="btn-outline"
            disabled={page <= 1}
            onClick={() => load(page - 1)}
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-600">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn-outline"
            disabled={page >= totalPages}
            onClick={() => load(page + 1)}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
