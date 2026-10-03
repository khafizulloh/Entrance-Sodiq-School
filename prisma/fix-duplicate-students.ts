/**
 * Merges duplicate students and leaves one of each.
 *
 * Two records are the same student when they share a UID, or when they share
 * a first name, a surname and a grade. Everything the duplicates hold —
 * attendance, marks, notes, group places, move requests — moves onto the one
 * that is kept, and the empty records are deleted.
 *
 * Nothing is written unless you ask for it:
 *
 *   npm run db:fix:students            shows what it would do
 *   npm run db:fix:students -- --apply does it
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function nameKey(firstName: string, lastName: string, grade: number) {
  return `name:${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${grade}`;
}

/** Union-find, so a UID match and a name match pull the same students together. */
class Groups {
  private parent = new Map<string, string>();

  find(id: string): string {
    const seen = this.parent.get(id);
    if (!seen || seen === id) {
      this.parent.set(id, id);
      return id;
    }
    const root = this.find(seen);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

async function main() {
  const pupils = await prisma.pupil.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { records: true, enrollments: true } } },
  });

  const groups = new Groups();
  const byKey = new Map<string, string>();

  for (const pupil of pupils) {
    groups.find(pupil.id);
    const keys = [nameKey(pupil.firstName, pupil.lastName, pupil.grade)];
    if (pupil.externalId) keys.push(`uid:${pupil.externalId.trim().toLowerCase()}`);

    for (const key of keys) {
      const first = byKey.get(key);
      if (first) groups.union(pupil.id, first);
      else byKey.set(key, pupil.id);
    }
  }

  const clusters = new Map<string, typeof pupils>();
  for (const pupil of pupils) {
    const root = groups.find(pupil.id);
    const list = clusters.get(root) ?? [];
    list.push(pupil);
    clusters.set(root, list);
  }

  const duplicated = [...clusters.values()].filter((list) => list.length > 1);

  console.log(`${pupils.length} students on file.`);
  if (duplicated.length === 0) {
    console.log("No duplicates. Nothing to do.");
    return;
  }

  console.log(
    `${duplicated.length} student${duplicated.length === 1 ? "" : "s"} recorded more than once.\n`,
  );

  let deleted = 0;
  let recordsMoved = 0;
  let recordsDropped = 0;
  let placesMoved = 0;

  for (const list of duplicated) {
    // Keep whichever copy carries the most attendance, then the oldest.
    const sorted = [...list].sort(
      (a, b) =>
        b._count.records - a._count.records ||
        a.createdAt.getTime() - b.createdAt.getTime(),
    );
    const [keeper, ...extras] = sorted;

    // Keep the attendance of the fullest copy, but the spelling of the one
    // that was entered first or carries a UID.
    const oldest = [...list].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];
    const named = list.find((pupil) => pupil.externalId) ?? oldest;

    console.log(
      `${named.firstName} ${named.lastName} (grade ${named.grade}) — ${list.length} copies`,
    );
    console.log(
      `  keeping the one with ${keeper._count.records} record(s) and ${keeper._count.enrollments} group place(s)`,
    );

    for (const extra of extras) {
      console.log(
        `  merging a copy with ${extra._count.records} record(s) and ${extra._count.enrollments} group place(s)`,
      );
      if (!APPLY) continue;

      // Attendance: move it across, and where both copies hold the same
      // lesson keep whichever record says more — a mark beats no mark, then
      // the one changed last.
      const theirs = await prisma.attendanceRecord.findMany({
        where: { pupilId: extra.id },
      });
      const keeperRecords = new Map(
        (
          await prisma.attendanceRecord.findMany({ where: { pupilId: keeper.id } })
        ).map((record) => [record.lessonId, record]),
      );

      for (const record of theirs) {
        const mine = keeperRecords.get(record.lessonId);
        if (!mine) {
          await prisma.attendanceRecord.update({
            where: { id: record.id },
            data: { pupilId: keeper.id },
          });
          keeperRecords.set(record.lessonId, { ...record, pupilId: keeper.id });
          recordsMoved++;
          continue;
        }

        const theirsIsFuller =
          (record.mark !== null && mine.mark === null) ||
          (record.mark !== null) === (mine.mark !== null) &&
            record.updatedAt > mine.updatedAt;

        if (theirsIsFuller) {
          await prisma.attendanceRecord.update({
            where: { id: mine.id },
            data: {
              status: record.status,
              mark: record.mark,
              note: record.note ?? mine.note,
              originGroupId: record.originGroupId ?? mine.originGroupId,
            },
          });
        }
        await prisma.attendanceRecord.delete({ where: { id: record.id } });
        recordsDropped++;
      }

      // Group places: move the ones the kept student does not already hold.
      const theirPlaces = await prisma.enrollment.findMany({
        where: { pupilId: extra.id },
        select: { id: true, groupId: true },
      });
      const keeperGroups = new Set(
        (
          await prisma.enrollment.findMany({
            where: { pupilId: keeper.id },
            select: { groupId: true },
          })
        ).map((place) => place.groupId),
      );

      for (const place of theirPlaces) {
        if (keeperGroups.has(place.groupId)) {
          await prisma.enrollment.delete({ where: { id: place.id } });
        } else {
          await prisma.enrollment.update({
            where: { id: place.id },
            data: { pupilId: keeper.id },
          });
          keeperGroups.add(place.groupId);
          placesMoved++;
        }
      }

      await prisma.moveRequest.updateMany({
        where: { pupilId: extra.id },
        data: { pupilId: keeper.id },
      });

      await prisma.pupil.delete({ where: { id: extra.id } });
      deleted++;
    }

    // A UID or a class from any copy is worth keeping.
    if (APPLY) {
      await prisma.pupil.update({
        where: { id: keeper.id },
        data: {
          firstName: named.firstName,
          lastName: named.lastName,
          externalId: list.find((pupil) => pupil.externalId)?.externalId ?? null,
          className: list.find((pupil) => pupil.className)?.className ?? null,
        },
      });
    }
  }

  // One open place per group, and one per track.
  if (APPLY) {
    const open = await prisma.enrollment.findMany({
      where: { endDate: null },
      orderBy: { startDate: "asc" },
      select: { id: true, pupilId: true, groupId: true, group: { select: { subject: true } } },
    });
    const keptGroup = new Set<string>();
    const keptTrack = new Map<string, string>();
    const close: string[] = [];

    for (const place of open) {
      const groupKey = `${place.pupilId}|${place.groupId}`;
      const trackKey = `${place.pupilId}|${place.group.subject}`;
      if (keptGroup.has(groupKey) || keptTrack.has(trackKey)) {
        close.push(place.id);
        continue;
      }
      keptGroup.add(groupKey);
      keptTrack.set(trackKey, place.groupId);
    }

    if (close.length > 0) {
      await prisma.enrollment.deleteMany({ where: { id: { in: close } } });
      console.log(`\nRemoved ${close.length} repeated group place(s).`);
    }
  }

  console.log("");
  if (APPLY) {
    console.log(
      `Done. ${deleted} duplicate record(s) deleted, ${recordsMoved} attendance record(s) moved, ${recordsDropped} dropped as already there, ${placesMoved} group place(s) moved.`,
    );
  } else {
    console.log("Nothing was changed. Run it again with --apply to do it:");
    console.log("  npm run db:fix:students -- --apply");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
