import { AdminShell } from "@/components/admin/AdminShell";
import { StudentsTable } from "@/components/admin/StudentsTable";

export const metadata = { title: "Students — Sodiq Admin" };

export default function AdminStudentsPage() {
  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-navy">Students</h1>
      <p className="mb-4 text-sm text-slate-500">
        Search, filter, view details, export, and manage submissions.
      </p>
      <StudentsTable />
    </AdminShell>
  );
}
