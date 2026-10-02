"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Teacher accounts: create one with a full name, login id and password, and
 * change any of them later. No two-step verification, as asked.
 */

export type StaffRow = {
  id: string;
  loginId: string;
  fullName: string;
  role: string;
  isActive: boolean;
  groupCount: number;
};

export function TeacherAccounts({ staff }: { staff: StaffRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-6">
      {message && (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{message}</p>
      )}
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <CreateForm
        onDone={(text) => {
          setMessage(text);
          setError(null);
          router.refresh();
        }}
        onError={(text) => {
          setError(text);
          setMessage(null);
        }}
      />

      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-slate-500">
          Accounts ({staff.length})
        </h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-navy text-left text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-2.5">Full name</th>
                <th className="px-4 py-2.5">Login id</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Groups</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {staff.map((member) => (
                <tr key={member.id} className="border-t border-slate-100 align-top">
                  {editing === member.id ? (
                    <td colSpan={6} className="px-4 py-3">
                      <EditForm
                        member={member}
                        onCancel={() => setEditing(null)}
                        onDone={(text) => {
                          setEditing(null);
                          setMessage(text);
                          setError(null);
                          router.refresh();
                        }}
                        onError={(text) => {
                          setError(text);
                          setMessage(null);
                        }}
                      />
                    </td>
                  ) : (
                    <>
                      <td className="px-4 py-2.5 font-medium text-navy">{member.fullName}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">
                        {member.loginId}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            member.role === "head"
                              ? "bg-brand/20 text-brand-dark"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {member.role === "head" ? "Head teacher" : "Teacher"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{member.groupCount}</td>
                      <td className="px-4 py-2.5">
                        {member.isActive ? (
                          <span className="text-xs font-semibold text-green-700">Active</span>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400">Off</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          className="rounded border border-slate-200 px-2.5 py-1 text-xs font-semibold text-navy hover:border-brand hover:bg-brand/10"
                          onClick={() => setEditing(member.id)}
                        >
                          Change
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function CreateForm({
  onDone,
  onError,
}: {
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [fullName, setFullName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("teacher");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    const res = await fetch("/api/attendance/head/teachers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, loginId, password, role }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      onError(body.error ?? "Could not create the account.");
      return;
    }
    onDone(`Account created. ${fullName} signs in with "${loginId.toLowerCase()}".`);
    setFullName("");
    setLoginId("");
    setPassword("");
    setRole("teacher");
  }

  // Suggest a login id from the last word of the name (how staff are known).
  function suggest(name: string) {
    const parts = name.trim().split(/\s+/);
    const base = (parts[parts.length - 1] ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
    if (base && !loginId) setLoginId(base);
  }

  return (
    <form onSubmit={submit} className="card">
      <h2 className="text-base font-bold text-navy">Create a teacher account</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="new-name">
            Full name
          </label>
          <input
            id="new-name"
            className="input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            onBlur={(event) => suggest(event.target.value)}
            placeholder="Tuxtasinova Nigina"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new-login">
            Login id
          </label>
          <input
            id="new-login"
            className="input"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            placeholder="nigina"
            autoCapitalize="none"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new-password">
            Password
          </label>
          <input
            id="new-password"
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="at least 6 characters"
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="new-role">
            Role
          </label>
          <select
            id="new-role"
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="teacher">Teacher</option>
            <option value="head">Head teacher</option>
          </select>
        </div>
      </div>
      <button type="submit" className="btn-brand mt-4" disabled={busy}>
        {busy ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}

function EditForm({
  member,
  onCancel,
  onDone,
  onError,
}: {
  member: StaffRow;
  onCancel: () => void;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const [fullName, setFullName] = useState(member.fullName);
  const [loginId, setLoginId] = useState(member.loginId);
  const [password, setPassword] = useState("");
  const [role, setRole] = useState(member.role);
  const [isActive, setIsActive] = useState(member.isActive);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);

    const res = await fetch(`/api/attendance/head/teachers/${member.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fullName,
        loginId,
        role,
        isActive,
        ...(password ? { password } : {}),
      }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      onError(body.error ?? "Could not save the changes.");
      return;
    }
    onDone(`${fullName} updated${password ? " with a new password" : ""}.`);
  }

  return (
    <form onSubmit={submit} className="rounded-lg bg-slate-50 p-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="label">Full name</label>
          <input
            className="input"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label">Login id</label>
          <input
            className="input"
            value={loginId}
            onChange={(event) => setLoginId(event.target.value)}
            autoCapitalize="none"
            required
          />
        </div>
        <div>
          <label className="label">New password</label>
          <input
            className="input"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="leave blank to keep"
          />
        </div>
        <div>
          <label className="label">Role</label>
          <select
            className="input"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="teacher">Teacher</option>
            <option value="head">Head teacher</option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(event) => setIsActive(event.target.checked)}
            className="h-4 w-4"
          />
          Can sign in
        </label>
        <div className="ml-auto flex gap-2">
          <button type="button" className="btn-outline" onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="btn-brand" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </form>
  );
}
