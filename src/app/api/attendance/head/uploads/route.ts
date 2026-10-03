import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireHead } from "@/lib/attendance/auth";
import { isValidIsoDate, schoolToday, toDbDate } from "@/lib/attendance/dates";
import { parseDay, parseSheet, pick, pickInt, splitName } from "@/lib/attendance/sheet";
import {
  type Subject,
  normalizeSubject,
  parseGroupName,
  subjectLabel,
} from "@/lib/attendance/subjects";

/**
 * Excel uploads: the group list with teachers, the student list, and the
 * timetable.
 *
 * The two lists match the sheets the school already keeps:
 *   Groups:   Group | Teacher, optionally repeated side by side across the row.
 *   Students: First Name | Last Name | UID | Grade | Class Name |
 *             Group | Q1 | SAT Eng | SAT Math
 *
 * Every upload reports back row by row, so a bad cell is visible instead of
 * silently dropped. Uploading a timetable creates a new version that takes
 * effect from a chosen date — earlier attendance is never rewritten.
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
  if (type === "groups") {
    const createAccounts = String(form.get("createAccounts") ?? "") !== "false";
    return NextResponse.json(await importGroups(rows, { createAccounts }));
  }
  if (type === "timetable") {
    const name =
      String(form.get("name") ?? "").trim() || `Timetable uploaded ${schoolToday()}`;
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
// Matching teachers by whatever the sheet calls them
// ---------------------------------------------------------------------------

type StaffLite = { id: string; loginId: string; fullName: string };

/**
 * The school's sheets use first names ("Nika", "Rayxona"), so a teacher is
 * matched on their login id, their full name, or any single part of it.
 * A name that matches two accounts is treated as no match.
 */
async function buildTeacherIndex() {
  const staff = await prisma.staff.findMany({
    select: { id: true, loginId: true, fullName: true },
  });

  const exact = new Map<string, StaffLite>();
  const parts = new Map<string, StaffLite | null>();

  for (const member of staff) {
    exact.set(member.loginId.toLowerCase(), member);
    exact.set(keyOf(member.fullName), member);
    for (const part of member.fullName.split(/\s+/).filter(Boolean)) {
      const key = keyOf(part);
      parts.set(key, parts.has(key) ? null : member);
    }
  }

  return {
    find(name: string): StaffLite | null | undefined {
      const trimmed = name.trim();
      if (!trimmed) return undefined;
      return (
        exact.get(trimmed.toLowerCase()) ?? exact.get(keyOf(trimmed)) ?? parts.get(keyOf(trimmed))
      );
    },
    add(member: StaffLite) {
      exact.set(member.loginId.toLowerCase(), member);
      exact.set(keyOf(member.fullName), member);
      for (const part of member.fullName.split(/\s+/).filter(Boolean)) {
        const key = keyOf(part);
        parts.set(key, parts.has(key) ? null : member);
      }
    },
    takenLoginIds: new Set(staff.map((member) => member.loginId.toLowerCase())),
  };
}

function loginIdFrom(fullName: string, taken: Set<string>): string {
  const base =
    fullName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 20) || "teacher";
  let candidate = base;
  let suffix = 2;
  while (taken.has(candidate)) candidate = `${base}${suffix++}`;
  taken.add(candidate);
  return candidate;
}

// ---------------------------------------------------------------------------
// Groups and their teachers
// ---------------------------------------------------------------------------
async function importGroups(
  rows: Array<Record<string, string>>,
  options: { createAccounts: boolean },
): Promise<UploadReport> {
  const report: UploadReport = {
    type: "groups",
    rows: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
    accounts: [],
  };

  const index = await buildTeacherIndex();
  const startingPassword = process.env.ATTENDANCE_TEACHER_PASSWORD || "Teacher12345!";
  let passwordHash: string | null = null;

  // A row can carry several Group/Teacher pairs side by side. Excel names the
  // repeated headings Group_1, Teacher_1 and so on.
  const pairs: Array<[string[], string[]]> = [
    [["Group", "Group Name", "Guruh"], ["Teacher", "Teacher Full Name", "Ustoz"]],
    [["Group_1"], ["Teacher_1"]],
    [["Group_2"], ["Teacher_2"]],
    [["Group_3"], ["Teacher_3"]],
  ];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // the heading is row 1

    for (let pairIndex = 0; pairIndex < pairs.length; pairIndex++) {
      const [groupNames, teacherNames] = pairs[pairIndex];
      const name = pick(row, ...groupNames);
      if (!name) continue;

      const parsed = parseGroupName(name);
      // Explicit columns win, but only on a sheet with a single pair.
      const subjectCell = pairIndex === 0 ? pick(row, "Subject", "Fan") : "";
      const subject: Subject = subjectCell ? normalizeSubject(subjectCell) : parsed.subject;
      const grade =
        (pairIndex === 0 ? pickInt(row, "Grade", "Class", "Sinf") : null) ?? parsed.grade;
      const room = (pairIndex === 0 ? pick(row, "Room", "Xona") : "") || null;

      if (!grade) {
        report.errors.push({
          row: rowNumber,
          message: `Could not work out the grade for "${name}". Add a Grade column.`,
        });
        continue;
      }

      const teacherCell = pick(row, ...teacherNames, "Teacher Login ID", "Login Id");
      let teacher = teacherCell ? index.find(teacherCell) : undefined;

      if (teacherCell && teacher === null) {
        report.warnings.push({
          row: rowNumber,
          message: `"${teacherCell}" matches more than one account. Group saved without a teacher.`,
        });
        teacher = undefined;
      } else if (teacherCell && teacher === undefined) {
        if (options.createAccounts) {
          passwordHash = passwordHash ?? (await hashPassword(startingPassword));
          const loginId = loginIdFrom(teacherCell, index.takenLoginIds);
          const created = await prisma.staff.create({
            data: {
              loginId,
              fullName: teacherCell,
              role: "teacher",
              passwordHash,
            },
            select: { id: true, loginId: true, fullName: true },
          });
          index.add(created);
          report.accounts?.push({
            fullName: created.fullName,
            loginId: created.loginId,
            password: startingPassword,
          });
          teacher = created;
        } else {
          report.warnings.push({
            row: rowNumber,
            message: `No account for "${teacherCell}". Group saved without a teacher.`,
          });
        }
      }

      const existing = await prisma.group.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
      });

      if (existing) {
        await prisma.group.update({
          where: { id: existing.id },
          data: {
            name,
            grade,
            subject,
            isActive: true,
            ...(room ? { room } : {}),
            ...(teacher ? { teacherId: teacher.id } : {}),
          },
        });
        report.updated++;
      } else {
        await prisma.group.create({
          data: { name, grade, subject, room, teacherId: teacher?.id ?? null },
        });
        report.created++;
      }
    }
  }

  if (report.created + report.updated === 0) {
    report.errors.push({
      row: 0,
      message: "No group names found. The sheet needs a Group column and a Teacher column.",
    });
  }

  return report;
}

// ---------------------------------------------------------------------------
// Students, with up to three groups each
// ---------------------------------------------------------------------------
async function importStudents(
  rows: Array<Record<string, string>>,
): Promise<UploadReport> {
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

  /** Finds the group, creating it from its name if the sheet knows one we do not. */
  async function resolveGroup(name: string, rowNumber: number) {
    const existing = groupByName.get(keyOf(name));
    if (existing) return existing;

    const parsed = parseGroupName(name);
    const created = await prisma.group.create({
      data: { name, grade: parsed.grade, subject: parsed.subject },
      select: { id: true, name: true, grade: true, subject: true },
    });
    groupByName.set(keyOf(name), created);
    report.warnings.push({
      row: rowNumber,
      message: `Group "${name}" was not on the group list, so it was created as ${subjectLabel(parsed.subject)}. Assign it a teacher.`,
    });
    return created;
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2;

    let firstName = pick(row, "First Name", "Firstname", "Name", "Ism");
    let lastName = pick(row, "Last Name", "Surname", "Lastname", "Familiya");
    const fullName = pick(row, "Full Name", "Student", "Student Name", "FIO");
    if (!firstName && fullName) {
      const split = splitName(fullName);
      firstName = split.firstName;
      lastName = split.lastName;
    }
    if (!firstName && !lastName) {
      report.errors.push({ row: rowNumber, message: "No student name." });
      continue;
    }

    const grade = pickInt(row, "Grade", "Class", "Sinf");
    if (grade === null) {
      report.errors.push({ row: rowNumber, message: "No grade." });
      continue;
    }

    const className = pick(row, "Class Name", "Classname", "Class", "Sinfi") || null;
    const externalId = pick(row, "UID", "Student ID", "ID", "Code") || null;

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
          data: {
            firstName,
            lastName,
            grade,
            isActive: true,
            ...(className ? { className } : {}),
            ...(externalId ? { externalId } : {}),
          },
        })
      : await prisma.pupil.create({
          data: { firstName, lastName, grade, className, externalId },
        });

    if (existing) report.updated++;
    else report.created++;

    // One column per track. A student always has General English; SAT English
    // and SAT Math are optional, and either one can be taken on its own.
    const wanted: Array<{ name: string; expected: Subject }> = [];
    const general = pick(
      row,
      "Group | Q1",
      "Group",
      "General English",
      "Gen Eng",
      "English Group",
      "Guruh",
    );
    const satEnglish = pick(row, "SAT Eng", "SAT English", "SAT-Eng");
    const satMath = pick(row, "SAT Math", "SAT-Math", "Math");
    if (general) wanted.push({ name: general, expected: "GENERAL_ENGLISH" });
    if (satEnglish) wanted.push({ name: satEnglish, expected: "SAT_ENGLISH" });
    if (satMath) wanted.push({ name: satMath, expected: "SAT_MATH" });

    for (const entry of wanted) {
      const group = await resolveGroup(entry.name, rowNumber);

      if (group.subject !== entry.expected) {
        report.warnings.push({
          row: rowNumber,
          message: `"${group.name}" is a ${subjectLabel(group.subject)} group but sits in the ${subjectLabel(entry.expected)} column. Check the sheet.`,
        });
      }

      const alreadyHere = await prisma.enrollment.findFirst({
        where: { pupilId: pupil.id, groupId: group.id, endDate: null },
      });
      if (alreadyHere) continue;

      // The uploaded list is authoritative: a student listed in a different
      // group for the same track leaves the old one from today.
      await prisma.enrollment.updateMany({
        where: { pupilId: pupil.id, endDate: null, group: { subject: group.subject } },
        data: { endDate: today },
      });
      await prisma.enrollment.create({
        data: { pupilId: pupil.id, groupId: group.id, startDate: today },
      });
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

  const [groups, index] = await Promise.all([
    prisma.group.findMany({
      select: { id: true, name: true, teacherId: true, subject: true, room: true },
    }),
    buildTeacherIndex(),
  ]);
  const groupByName = new Map(groups.map((group) => [keyOf(group.name), group]));

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
  const teacherBusy = new Map<string, number>();
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

    const period = pickInt(row, "Period", "Slot", "Lesson", "Para", "Soat");
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

    const teacherCell = pick(row, "Teacher", "Teacher Full Name", "Teacher Login ID", "Ustoz");
    const match = teacherCell ? index.find(teacherCell) : undefined;
    const teacherId = match?.id ?? group.teacherId ?? null;
    if (teacherCell && !match) {
      report.warnings.push({
        row: rowNumber,
        message: `No single account matches "${teacherCell}". Used the group's own teacher.`,
      });
    }

    const subjectCell = pick(row, "Subject", "Lesson Type", "Fan");
    const subject = subjectCell ? normalizeSubject(subjectCell) : group.subject;
    const room = pick(row, "Room", "Xona") || group.room || null;

    // Clashes are reported, not blocked — the head teacher decides.
    if (teacherId) {
      const busyKey = `${teacherId}|${dayOfWeek}|${period}`;
      const firstRow = teacherBusy.get(busyKey);
      if (firstRow) {
        report.warnings.push({
          row: rowNumber,
          message: `That teacher is already teaching at day ${dayOfWeek} period ${period} (row ${firstRow}).`,
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
