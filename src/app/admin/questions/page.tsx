import { AdminShell } from "@/components/admin/AdminShell";
import { QuestionsManager } from "@/components/admin/QuestionsManager";

export const metadata = { title: "Tests & Questions — Sodiq Admin" };

export default function AdminQuestionsPage() {
  return (
    <AdminShell>
      <h1 className="text-2xl font-bold text-navy">Tests &amp; Questions</h1>
      <p className="mb-4 text-sm text-slate-500">
        Manage each grade&apos;s test: edit the title, timer, active state, and
        questions.
      </p>
      <QuestionsManager />
    </AdminShell>
  );
}
