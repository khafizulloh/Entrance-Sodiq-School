"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The head teacher's three Excel uploads. Each one reports back row by row,
 * so a bad cell is visible instead of silently dropped.
 */

type RowIssue = { row: number; message: string };

type NewAccount = { fullName: string; loginId: string; password: string };

type UploadReport = {
  type: string;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: RowIssue[];
  warnings: RowIssue[];
  accounts?: NewAccount[];
  source?: { sheetName: string; headerRow: number; columns: string[] };
  note?: string;
};

export function UploadPanel({ today }: { today: string }) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <UploadCard
        type="groups"
        title="Groups and teachers"
        description="Creates every group and gives it a teacher. Group names tell the app what they are: 5-E1 is General English for grades 5–6, SAT - E1 is SAT English, SAT - M1 is SAT Math. Pairs of Group and Teacher columns side by side are read too."
        columns="Group · Teacher · Room"
        needsAccounts
      />
      <UploadCard
        type="students"
        title="Student list"
        description="One row per student, with up to three groups each. A student already on the list is updated, not duplicated."
        columns="First Name · Last Name · UID · Grade · Class Name · Group | Q1 · SAT Eng · SAT Math"
      />
      <UploadCard
        type="timetable"
        title="Timetable"
        description="Saved as a new version that starts on the date you choose. Attendance before that date keeps the old timetable."
        columns="Group · Day · Period · Teacher · Room"
        needsDate
        today={today}
      />
    </div>
  );
}

function UploadCard({
  type,
  title,
  description,
  columns,
  needsDate = false,
  needsAccounts = false,
  today,
}: {
  type: string;
  title: string;
  description: string;
  columns: string;
  needsDate?: boolean;
  needsAccounts?: boolean;
  today?: string;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState(today ?? "");
  const [createAccounts, setCreateAccounts] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<UploadReport | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!file) return;

    setBusy(true);
    setError(null);
    setReport(null);

    const form = new FormData();
    form.set("type", type);
    form.set("file", file);
    if (needsDate) {
      form.set("effectiveFrom", effectiveFrom);
      form.set("name", name);
    }
    if (needsAccounts) {
      form.set("createAccounts", createAccounts ? "true" : "false");
    }

    const res = await fetch("/api/attendance/head/uploads", {
      method: "POST",
      body: form,
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Upload failed.");
      return;
    }
    setReport(body as UploadReport);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card flex flex-col">
      <h2 className="text-base font-bold text-navy">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-xs text-slate-500">
        <span className="font-semibold text-navy">Columns:</span> {columns}
      </p>

      <a
        href={`/api/attendance/head/templates?type=${type}`}
        className="mt-2 text-xs font-semibold text-brand-dark hover:underline"
      >
        ⬇ Download the Excel template
      </a>

      {needsDate && (
        <div className="mt-3 space-y-3">
          <div>
            <label className="label" htmlFor={`${type}-from`}>
              In force from
            </label>
            <input
              id={`${type}-from`}
              type="date"
              className="input"
              value={effectiveFrom}
              onChange={(event) => setEffectiveFrom(event.target.value)}
              required
            />
          </div>
          <div>
            <label className="label" htmlFor={`${type}-name`}>
              Name <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id={`${type}-name`}
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Term 2 timetable"
            />
          </div>
        </div>
      )}

      {needsAccounts && (
        <label className="mt-3 flex items-start gap-2.5 rounded-lg bg-slate-50 p-3 text-sm">
          <input
            type="checkbox"
            checked={createAccounts}
            onChange={(event) => setCreateAccounts(event.target.checked)}
            className="mt-0.5 h-4 w-4"
          />
          <span>
            <span className="font-medium text-navy">Create missing teacher accounts</span>
            <span className="mt-0.5 block text-xs text-slate-500">
              Any teacher named in the file who has no account gets one, with a starting
              password you can change under Teachers.
            </span>
          </span>
        </label>
      )}

      <div className="mt-3">
        <label className="label" htmlFor={`${type}-file`}>
          Excel file
        </label>
        <input
          id={`${type}-file`}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          className="w-full rounded-lg border border-slate-300 bg-white p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-navy file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
          required
        />
      </div>

      <button type="submit" className="btn-brand mt-4" disabled={busy || !file}>
        {busy ? "Uploading…" : "Upload"}
      </button>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {report && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="font-semibold text-navy">
            {report.rows} row{report.rows === 1 ? "" : "s"} read · {report.created} added ·{" "}
            {report.updated} updated
            {report.skipped > 0 ? ` · ${report.skipped} skipped` : ""}
          </p>
          {report.note && <p className="mt-1 text-xs text-slate-600">{report.note}</p>}

          {report.source && (
            <p className="mt-1 text-[11px] text-slate-500">
              Read the sheet &ldquo;{report.source.sheetName}&rdquo;, headings on row{" "}
              {report.source.headerRow}: {report.source.columns.join(" · ")}
            </p>
          )}

          {report.accounts && report.accounts.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-navy">
                New teacher accounts ({report.accounts.length})
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                {report.accounts.map((account) => (
                  <li key={account.loginId}>
                    {account.fullName} — login{" "}
                    <span className="font-mono font-semibold">{account.loginId}</span>,
                    password{" "}
                    <span className="font-mono font-semibold">{account.password}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-[11px] text-slate-500">
                Write these down and change the passwords under Teachers.
              </p>
            </div>
          )}

          {report.errors.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-red-700">
                Not imported ({report.errors.length})
              </p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-red-700">
                {report.errors.map((issue, index) => (
                  <li key={index}>
                    {issue.row > 0 ? `Row ${issue.row}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.warnings.length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-700">
                Check these ({report.warnings.length})
              </p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs text-amber-700">
                {report.warnings.map((issue, index) => (
                  <li key={index}>
                    {issue.row > 0 ? `Row ${issue.row}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

/** Sets the two-month window attendance is tracked for. */
export function TermForm({
  term,
  today,
}: {
  term: { name: string; startDate: string; endDate: string } | null;
  today: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(term?.name ?? "");
  const [startDate, setStartDate] = useState(term?.startDate ?? today);
  const [endDate, setEndDate] = useState(term?.endDate ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setDone(false);

    const res = await fetch("/api/attendance/head/terms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, startDate, endDate }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error ?? "Could not save the term.");
      return;
    }
    setDone(true);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="card">
      <h2 className="text-base font-bold text-navy">Tracking period</h2>
      <p className="mt-1 text-sm text-slate-600">
        The registers cover these dates. Two months for now — change it whenever you need
        to.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label" htmlFor="term-name">
            Name
          </label>
          <input
            id="term-name"
            className="input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="October–November"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="term-start">
            First day
          </label>
          <input
            id="term-start"
            type="date"
            className="input"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="term-end">
            Last day
          </label>
          <input
            id="term-end"
            type="date"
            className="input"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
          />
        </div>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {done && (
        <p className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Saved. The registers now cover {startDate} to {endDate}.
        </p>
      )}

      <button type="submit" className="btn-primary mt-4" disabled={busy}>
        {busy ? "Saving…" : term ? "Update the period" : "Set the period"}
      </button>
    </form>
  );
}
