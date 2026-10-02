import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { TermForm, UploadPanel } from "@/components/attendance/UploadPanel";
import { getStaffSession } from "@/lib/attendance/auth";
import { schoolToday, toIsoDate } from "@/lib/attendance/dates";
import { activeTerm } from "@/lib/attendance/timetable";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Uploads — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadUploads() {
  const session = await getStaffSession();
  if (!session) redirect("/attendance/login");
  if (session.role !== "head") redirect("/attendance/teacher");

  const [term, pending] = await Promise.all([
    activeTerm(),
    prisma.moveRequest.count({ where: { status: "PENDING" } }),
  ]);
  const today = schoolToday();

  return (
    <StaffShell
      role="head"
      name={session.name}
      active="/attendance/head/uploads"
      pendingMoves={pending}
    >
      <PageHeading
        title="Uploads"
        subtitle="Upload in this order: teachers first (under Teachers), then groups, then students, then the timetable."
      />

      <UploadPanel today={today} />

      <div className="mt-6">
        <TermForm
          term={
            term
              ? {
                  name: term.name,
                  startDate: toIsoDate(term.startDate),
                  endDate: toIsoDate(term.endDate),
                }
              : null
          }
          today={today}
        />
      </div>
    </StaffShell>
  );
}
