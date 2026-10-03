import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { getStaffSession } from "@/lib/attendance/auth";
import { prisma } from "@/lib/prisma";
import { MoveStatusBadge } from "@/components/attendance/MoveStatusBadge";

// A cookie whose account is gone: clear it, then sign in again.
const SIGNED_OUT = "/api/attendance/auth/logout";

export const metadata = { title: "My move requests — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function TeacherRequests() {
  const session = await getStaffSession();
  if (!session) redirect(SIGNED_OUT);

  const requests = await prisma.moveRequest.findMany({
    where: { requestedById: session.sub },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      pupil: { select: { firstName: true, lastName: true } },
      fromGroup: { select: { name: true } },
      toGroup: { select: { name: true } },
    },
  });

  return (
    <StaffShell role="teacher" name={session.name} active="/attendance/teacher/requests">
      <PageHeading
        title="My move requests"
        subtitle="Moves you asked for. The head teacher approves them."
      />

      {requests.length === 0 ? (
        <div className="card text-sm text-slate-600">
          You have not requested any moves. Open a group register and tap{" "}
          <span className="font-semibold">Move</span> next to a student who is on the
          wrong list.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-navy text-left text-xs uppercase tracking-wider text-white">
              <tr>
                <th className="px-4 py-2.5">Student</th>
                <th className="px-4 py-2.5">From</th>
                <th className="px-4 py-2.5">To</th>
                <th className="px-4 py-2.5">Records</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Asked</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-navy">
                    {request.pupil.firstName} {request.pupil.lastName}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {request.fromGroup?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{request.toGroup.name}</td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {request.status === "APPROVED"
                      ? `${request.recordsMoved} carried`
                      : request.moveRecords
                        ? "carry across"
                        : "leave behind"}
                  </td>
                  <td className="px-4 py-2.5">
                    <MoveStatusBadge status={request.status} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">
                    {request.createdAt.toISOString().slice(0, 10)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </StaffShell>
  );
}
