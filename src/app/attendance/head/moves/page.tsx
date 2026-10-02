import { redirect } from "next/navigation";
import { PageHeading, StaffShell } from "@/components/attendance/StaffShell";
import { MoveQueue, type MoveRow } from "@/components/attendance/MoveQueue";
import { getStaffSession } from "@/lib/attendance/auth";
import { countCarryableRecords } from "@/lib/attendance/moves";
import { telegramEnabled } from "@/lib/attendance/telegram";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Move requests — Sodiq School Attendance" };
export const dynamic = "force-dynamic";

export default async function HeadMoves() {
  const session = await getStaffSession();
  if (!session) redirect("/attendance/login");
  if (session.role !== "head") redirect("/attendance/teacher");

  const requests = await prisma.moveRequest.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: 80,
    include: {
      pupil: { select: { firstName: true, lastName: true, grade: true } },
      fromGroup: { select: { name: true } },
      toGroup: { select: { name: true } },
      requestedBy: { select: { fullName: true } },
    },
  });

  const rows: MoveRow[] = await Promise.all(
    requests.map(async (request) => ({
      id: request.id,
      status: request.status,
      pupilName: `${request.pupil.firstName} ${request.pupil.lastName}`.trim(),
      grade: request.pupil.grade,
      fromGroup: request.fromGroup?.name ?? null,
      toGroup: request.toGroup.name,
      requestedBy: request.requestedBy?.fullName ?? null,
      source: request.source,
      reason: request.reason,
      moveRecords: request.moveRecords,
      recordCount:
        request.status === "PENDING"
          ? await countCarryableRecords(request.pupilId, request.fromGroupId)
          : request.recordsMoved,
      recordsMoved: request.recordsMoved,
      createdAt: request.createdAt.toISOString().slice(0, 10),
      decidedAt: request.decidedAt ? request.decidedAt.toISOString().slice(0, 10) : null,
    })),
  );

  const pendingCount = rows.filter((row) => row.status === "PENDING").length;

  return (
    <StaffShell
      role="head"
      name={session.name}
      active="/attendance/head/moves"
      pendingMoves={pendingCount}
    >
      <PageHeading
        title="Move requests"
        subtitle={
          telegramEnabled()
            ? "Approve here or straight from the Telegram bot."
            : "Approve here. Set TELEGRAM_BOT_TOKEN to get these in Telegram too."
        }
      />
      <MoveQueue requests={rows} />
    </StaffShell>
  );
}
