import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireHead } from "@/lib/attendance/auth";
import { isValidIsoDate, schoolToday, toDbDate } from "@/lib/attendance/dates";
import { parseDay, parseSheet, pick, pickInt, splitName } from "@/lib/attendance/sheet";
import { normalizeSubject } from "@/lib/attendance/subjects";

/**
 * Excel uploads: student lists, group lists (with teachers) and the timetable.
 *
 * Every upload reports back row by row, so a bad cell is visible instead of
 * silently dropped. Uploading a timetable creates a new version that takes
 * effect from a chosen date — earlier attendance is never rewritten.
 */

type RowIssue = { row: number; message: string };

type UploadReport = {
  type: string;
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: RowIssue[];
  warnings: RowIssue[];
  note?: string;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;

function keyOf(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

export async function POST(req: Request) {
  const auth = await requireHead();
  if (!auth.ok) return auth.response;

  const form = await req.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "Send the file as form data." }, { status: 400 });
  }

  const type = String(form.get("type") ?? "");
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  }
  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "The file is larger than 5 MB." }, { status: 400 });
  }

  let rows;
  try {
    rows = parseSheet(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "Could not read that file. Upload an .xlsx, .xls or .csv file." },
      { status: 400 },
    );
  }
  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No rows found. Check that the first row holds the column headings." },
      { status: 400 },
    );
  }

  if (type === "students") return NextResponse.json(await importStudents(rows));
  if (type === "groups") return NextResponse.json(await importGroups(rows));
  if (type === "timetable") {
    const name = String(form.get("name") ?? "").trim() || `Timetable uploaded ${schoolToday()}`;
    const effectiveFrom = String(form.get("effectiveFrom") ?? "").trim();
    if (!isValidIsoDate(effectiveFrom)) {
      return NextResponse.json(
        { error: "Choose the date this timetable starts from." },
        { status: 400 },
      );
    }
    return NextResponse.json(
      await importTimetable(rows, { name, effectiveFrom, uploadedById: auth.session.sub }),
    );
  }

  return NextResponse.json({ error: "Unknown upload type." }, { status: 400 });
}

// ---------------------------------------------------------------------------
// Students
// ---------------------------------------------------------------------------
async function importStudents(rows: Array<Record<string, string>>): Promise<UploadReport> {
  const report: UploadReport = {
    type: "students",
    rows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  const groups = await prisma.group.findMany({
    select: { id: true, name: true, grade: true, subject: true },
  });
  const groupByName = new Map(groups.map((group) => [keyOf(group.name), group]));
  const today = toDbDate(schoolToday());

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // header is row 1

    let firstName = pick(row, "First Name", "Firstname", "Name", "Ism");
    let lastName = pick(row, "Surname", "Last Name", "Lastname", "Familiya");
    const fullName = pick(row, "Full Name", "Student", "Student Name", "FIO");
    if (!firstName && fullName) {
      const split = splitName(fullName);
      firstName = split.firstName;
      lastName = split.lastName;
    }
    if (!firstName) {
      report.errors.push({ row: rowNumber, message: "No student name." });
      continue;
    }

    const groupName = pick(row, "Group", "Group Name", "Class Group", "Guruh");
    const group = groupName ? groupByName.get(keyOf(groupName)) : undefined;
    if (groupName && !group) {
      report.errors.push({
        row: rowNumber,
        message: `Group "${groupName}" does not exist. Upload the group list first.`,
      });
      continue;
    }

    const grade = pickInt(row, "Grade", "Class", "Sinf") ?? group?.grade ?? null;
    if (grade === null) {
      report.errors.push({ row: rowNumber, message: "No grade and no known group." });
      continue;
    }

    const externalId = pick(row, "Student ID", "ID", "Student Id", "Code") || null;

    const existing = externalId
      ? await prisma.pupil.findFirst({ where: { externalId } })
      : await prisma.pupil.findFirst({
          where: {
            firstName: { equals: firstName, mode: "insensitive" },
            lastName: { equals: lastName, mode: "insensitive" },
            grade,
          },
        });

    const pupil = existing
      ? await prisma.pupil.update({
          where: { id: existing.id },
          data: { firstName, lastName, grade, isActive: true },
        })
      : await prisma.pupil.create({
          data: { firstName, lastName, grade, externalId },
        });

    if (existing) report.updated++;
    else report.created++;

    if (!group) continue;

    const alreadyHere = await prisma.enrollment.findFirst({
      where: { pupilId: pupil.id, groupId: group.id, endDate: null },
    });
    if (alreadyHere) continue;

    // The uploaded list is authoritative: a pupil listed in a new group for
    // the same subject leaves the old one from today.
    await prisma.enrollment.updateMany({
      where: {
        pupilId: pupil.id,
        endDate: null,
        group: { subject: group.subject },
      },
      data: { endDate: today },
    });
    await prisma.enrollment.create({
      data: { pupilId: pupil.id, groupId: group.id, startDate: today },
    });
  }

  return report;
}

// ---------------------------------------------------------------------------
// Groups (with the teacher assigned to each)
// ---------------------------------------------------------------------------
async function importGroups(rows: Array<Record<string, string>>): Promise<UploadReport> {
  const report: UploadReport = {
    type: "groups",
    rows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  const staff = await prisma.staff.findMany({
    select: { id: true, loginId: true, fullName: true },
  });
  const byLogin = new Map(staff.map((member) => [member.loginId.toLowerCase(), member]));
  const byName = new Map(staff.map((member) => [keyOf(member.fullName), member]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    const name = pick(row, "Group Name", "Group", "Name");
    if (!name) {
      report.errors.push({ row: rowNumber, message: "No group name." });
      continue;
    }

    const subject = normalizeSubject(pick(row, "Subject", "Lesson", "Fan"));
    const grade =
      pickInt(row, "Grade", "Class", "Sinf") ?? Number(name.match(/\d+/)?.[0] ?? NaN);
    if (!Number.isFinite(grade)) {
      report.errors.push({ row: rowNumber, message: `No grade for "${name}".` });
      continue;
    }

    const teacherLogin = pick(row, "Teacher Login ID", "Teacher Id", "Login Id", "Login");
    const teacherName = pick(row, "Teacher Full Name", "Teacher", "Teacher Name", "Ustoz");
    const teacher =
      (teacherLogin ? byLogin.get(teacherLogin.toLowerCase()) : undefined) ??
      (teacherName ? byName.get(keyOf(teacherName)) : undefined);

    if ((teacherLogin || teacherName) && !teacher) {
      report.warnings.push({
        row: rowNumber,
        message: `No account for teacher "${teacherName || teacherLogin}". Group saved without a teacher.`,
      });
    }

    const room = pick(row, "Room", "Xona") || null;
    const existing = await prisma.group.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });

    if (existing) {
      await prisma.group.update({
        where: { id: existing.id },
        data: {
          name,
          grade: Number(grade),
          subject,
          room,
          isActive: true,
          ...(teacher ? { teacherId: teacher.id } : {}),
        },
      });
      report.updated++;
    } else {
      await prisma.group.create({
        data: {
          name,
          grade: Number(grade),
          subject,
          room,
          teacherId: teacher?.id ?? null,
        },
      });
      report.created++;
    }
  }

  return report;
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------
async function importTimetable(
  rows: Array<Record<string, string>>,
  options: { name: string; effectiveFrom: string; uploadedById: string },
): Promise<UploadReport> {
  const report: UploadReport = {
    type: "timetable",
    rows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    note: `In force from ${options.effectiveFrom}. Attendance before that date keeps the previous timetable.`,
  };

  const [groups, staff] = await Promise.all([
    prisma.group.findMany({ select: { id: true, name: true, teacherId: true, subject: true, room: true } }),
    prisma.staff.findMany({ select: { id: true, loginId: true, fullName: true } }),
  ]);
  const groupByName = new Map(groups.map((group) => [keyOf(group.name), group]));
  const byLogin = new Map(staff.map((member) => [member.loginId.toLowerCase(), member]));
  const byName = new Map(staff.map((member) => [keyOf(member.fullName), member]));

  type Slot = {
    groupId: string;
    teacherId: string | null;
    dayOfWeek: number;
    period: number;
    subject: string;
    room: string | null;
  };
  const slots: Slot[] = [];
  const seen = new Set<string>(); // group + day + period
  const teacherBusy = new Map<string, number>(); // teacher + day + period
  const roomBusy = new Map<string, number>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    const groupName = pick(row, "Group Name", "Group", "Guruh");
    const group = groupName ? groupByName.get(keyOf(groupName)) : undefined;
    if (!group) {
      report.errors.push({
        row: rowNumber,
        message: groupName
          ? `Group "${groupName}" does not exist. Upload the group list first.`
          : "No group name.",
      });
      continue;
    }

    const dayOfWeek = parseDay(pick(row, "Day", "Weekday", "Kun"));
    if (!dayOfWeek) {
      report.errors.push({ row: rowNumber, message: "Day must be Monday to Friday." });
      continue;
    }

    const period = pickInt(row, "Period", "Lesson", "Para", "Soat");
    if (!period || period < 1 || period > 8) {
      report.errors.push({ row: rowNumber, message: "Period must be 1 to 8." });
      continue;
    }

    const slotKey = `${group.id}|${dayOfWeek}|${period}`;
    if (seen.has(slotKey)) {
      report.skipped++;
      report.warnings.push({
        row: rowNumber,
        message: `${group.name} already has a lesson on day ${dayOfWeek} period ${period}.`,
      });
      continue;
    }
    seen.add(slotKey);

    const teacherLogin = pick(row, "Teacher Login ID", "Teacher Id", "Login Id", "Login");
    const teacherName = pick(row, "Teacher Full Name", "Teacher", "Teacher Name", "Ustoz");
    const teacher =
      (teacherLogin ? byLogin.get(teacherLogin.toLowerCase()) : undefined) ??
      (teacherName ? byName.get(keyOf(teacherName)) : undefined);
    const teacherId = teacher?.id ?? group.teacherId ?? null;
    if ((teacherLogin || teacherName) && !teacher) {
      report.warnings.push({
        row: rowNumber,
        message: `No account for teacher "${teacherName || teacherLogin}".`,
      });
    }

    const subject = pick(row, "Subject", "Lesson Type", "Fan")
      ? normalizeSubject(pick(row, "Subject", "Lesson Type", "Fan"))
      : group.subject;
    const room = pick(row, "Room", "Xona") || group.room || null;

    // Clashes are reported, not blocked — the head teacher decides.
    if (teacherId) {
      const busyKey = `${teacherId}|${dayOfWeek}|${period}`;
      const firstRow = teacherBusy.get(busyKey);
      if (firstRow) {
        report.warnings.push({
          row: rowNumber,
          message: `${teacher?.fullName ?? "That teacher"} is already teaching at day ${dayOfWeek} period ${period} (row ${firstRow}).`,
        });
      } else {
        teacherBusy.set(busyKey, rowNumber);
      }
    }
    if (room) {
      const busyKey = `${keyOf(room)}|${dayOfWeek}|${period}`;
      const firstRow = roomBusy.get(busyKey);
      if (firstRow) {
        report.warnings.push({
          row: rowNumber,
          message: `Room ${room} is already in use at day ${dayOfWeek} period ${period} (row ${firstRow}). Joint lessons are fine.`,
        });
      } else {
        roomBusy.set(busyKey, rowNumber);
      }
    }

    slots.push({ groupId: group.id, teacherId, dayOfWeek, period, subject, room });
  }

  if (slots.length === 0) {
    report.errors.push({ row: 0, message: "No usable rows, so no timetable was saved." });
    return report;
  }

  await prisma.$transaction(async (tx) => {
    const version = await tx.timetableVersion.create({
      data: {
        name: options.name,
        effectiveFrom: toDbDate(options.effectiveFrom),
        uploadedById: options.uploadedById,
        note: `${slots.length} lessons`,
      },
    });
    await tx.timetableSlot.createMany({
      data: slots.map((slot) => ({ ...slot, versionId: version.id })),
      skipDuplicates: true,
    });
  });

  report.created = slots.length;
  return report;
}
