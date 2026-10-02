import { prisma } from "@/lib/prisma";
import { schoolToday, toDbDate } from "./dates";
import { sendMoveRequestNotification } from "./telegram";

/**
 * Student moves between groups.
 *
 * A teacher requests a move; the head teacher approves it (in the app or from
 * the Telegram bot). The head teacher can also start a move themselves, which
 * still has to be confirmed before it takes effect.
 *
 * On approval the pupil's current enrollment is closed and a new one opens
 * from today, so the old group's past registers stay exactly as they were.
 * Existing records keep living on their original lessons; approving with
 * `moveRecords` stamps them with `originGroupId`, which is what makes them
 * appear on the new group's register in a lighter style.
 */

export type MoveRequestInput = {
  pupilId: string;
  toGroupId: string;
  fromGroupId?: string | null;
  reason?: string | null;
  moveRecords?: boolean;
  requestedById: string;
  source: "TEACHER" | "HEAD";
};

export async function countCarryableRecords(pupilId: string, fromGroupId: string | null) {
  if (!fromGroupId) return 0;
  return prisma.attendanceRecord.count({
    where: { pupilId, lesson: { groupId: fromGroupId } },
  });
}

/** Create a pending move request and ping the head teacher on Telegram. */
export async function createMoveRequest(input: MoveRequestInput) {
  const pupil = await prisma.pupil.findUnique({ where: { id: input.pupilId } });
  if (!pupil) throw new MoveError("Student not found.");

  const toGroup = await prisma.group.findUnique({ where: { id: input.toGroupId } });
  if (!toGroup) throw new MoveError("Destination group not found.");

  // Where the pupil sits now, for this group's subject.
  const current = await prisma.enrollment.findFirst({
    where: {
      pupilId: input.pupilId,
      endDate: null,
      group: { subject: toGroup.subject },
    },
    include: { group: true },
  });

  const fromGroupId = input.fromGroupId ?? current?.groupId ?? null;
  if (fromGroupId === input.toGroupId) {
    throw new MoveError("The student is already in that group.");
  }

  const duplicate = await prisma.moveRequest.findFirst({
    where: { pupilId: input.pupilId, status: "PENDING" },
  });
  if (duplicate) {
    throw new MoveError("This student already has a move request waiting for approval.");
  }

  const request = await prisma.moveRequest.create({
    data: {
      pupilId: input.pupilId,
      fromGroupId,
      toGroupId: input.toGroupId,
      reason: input.reason?.trim() || null,
      moveRecords: input.moveRecords ?? true,
      requestedById: input.requestedById,
      source: input.source,
      status: "PENDING",
    },
    include: {
      pupil: true,
      fromGroup: true,
      toGroup: true,
      requestedBy: { select: { fullName: true } },
    },
  });

  const recordCount = await countCarryableRecords(input.pupilId, fromGroupId);

  await sendMoveRequestNotification({
    requestId: request.id,
    pupilName: `${request.pupil.firstName} ${request.pupil.lastName}`.trim(),
    fromGroup: request.fromGroup?.name ?? "no group",
    toGroup: request.toGroup.name,
    requestedBy: request.requestedBy?.fullName ?? "Unknown",
    recordCount,
    reason: request.reason,
  });

  return { request, recordCount };
}

/** Approve a pending request and carry out the move. */
export async function approveMoveRequest(
  requestId: string,
  decidedById: string | null,
  note?: string | null,
) {
  const request = await prisma.moveRequest.findUnique({
    where: { id: requestId },
    include: { pupil: true, fromGroup: true, toGroup: true },
  });
  if (!request) throw new MoveError("Move request not found.");
  if (request.status !== "PENDING") {
    throw new MoveError(`This request was already ${request.status.toLowerCase()}.`);
  }

  const today = toDbDate(schoolToday());

  const result = await prisma.$transaction(async (tx) => {
    // Close the enrollment the pupil is moving out of.
    if (request.fromGroupId) {
      await tx.enrollment.updateMany({
        where: { pupilId: request.pupilId, groupId: request.fromGroupId, endDate: null },
        data: { endDate: today },
      });
    }

    // Open (or reopen) the enrollment in the destination group.
    const existing = await tx.enrollment.findFirst({
      where: { pupilId: request.pupilId, groupId: request.toGroupId, endDate: null },
    });
    if (!existing) {
      await tx.enrollment.create({
        data: { pupilId: request.pupilId, groupId: request.toGroupId, startDate: today },
      });
    }

    // Carry the pupil's existing records across. They stay attached to the
    // lessons they were taken in; the stamp is what makes the new group's
    // register show them, greyed out, as taken in the previous group.
    let recordsMoved = 0;
    if (request.moveRecords && request.fromGroupId) {
      const stamped = await tx.attendanceRecord.updateMany({
        where: {
          pupilId: request.pupilId,
          originGroupId: null,
          lesson: { groupId: request.fromGroupId },
        },
        data: { originGroupId: request.fromGroupId },
      });
      recordsMoved = stamped.count;
    }

    return tx.moveRequest.update({
      where: { id: requestId },
      data: {
        status: "APPROVED",
        decidedById,
        decidedAt: new Date(),
        decisionNote: note?.trim() || null,
        recordsMoved,
      },
      include: { pupil: true, fromGroup: true, toGroup: true },
    });
  });

  return result;
}

export async function rejectMoveRequest(
  requestId: string,
  decidedById: string | null,
  note?: string | null,
) {
  const request = await prisma.moveRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new MoveError("Move request not found.");
  if (request.status !== "PENDING") {
    throw new MoveError(`This request was already ${request.status.toLowerCase()}.`);
  }

  return prisma.moveRequest.update({
    where: { id: requestId },
    data: {
      status: "REJECTED",
      decidedById,
      decidedAt: new Date(),
      decisionNote: note?.trim() || null,
    },
    include: { pupil: true, fromGroup: true, toGroup: true },
  });
}

export class MoveError extends Error {}
