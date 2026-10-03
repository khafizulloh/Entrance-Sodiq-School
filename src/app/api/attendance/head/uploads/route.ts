import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireHead } from "@/lib/attendance/auth";
import { isValidIsoDate, schoolToday, toDbDate, toIsoDate } from "@/lib/attendance/dates";
import {
  type ParsedSheet,
  parseDay,
  parseSheet,
  pick,
  pickInt,
  rowNumberOf,
  splitName,
} from "@/lib/attendance/sheet";
import {
  type Subject,
  normalizeSubject,
  parseGroupName,
  subjectLabel,
} from "@/lib/attendance/subjects";
import { versionForDate } from "@/lib/attendance/timetable";

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

/** Told to the browser while a long upload runs. */
export type Progress = {
  type: "progress";
  stage: string;
  done: number;
  total: number;
};

type OnProgress = (stage: string, done?: number, total?: number) => void;

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
  /** What the app understood the file to be, so a mismatch is obvious. */
  source?: { sheetName: string; headerRow: number; columns: string[] };
  note?: string;
};

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ISSUES = 25;

/** Keeps the report readable when a whole column is wrong. */
function trimIssues(report: UploadReport): UploadReport {
  for (const key of ["errors", "warnings"] as const) {
    const list = report[key];
    if (list.length > MAX_ISSUES) {
      const extra = list.length - MAX_ISSUES;
      report[key] = list.slice(0, MAX_ISSUES);
      report[key].push({
        row: 0,
        message: `…and ${extra} more row${extra === 1 ? "" : "s"} like this.`,
      });
    }
  }
  return report;
}

function keyOf(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Streams the upload back line by line (newline-delimited JSON) so the page
 * can show what stage it has reached instead of an endless "Uploading…".
 * The last line is the finished report.
 */
function streamed(run: (send: OnProgress) => Promise<UploadReport>): Response {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const write = (payload: unknown) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      const send: OnProgress = (stage, done = 0, total = 0) =>
        write({ type: "progress", stage, done, total });

      try {
        const report = await run(send);
        write({ type: "report", report });
      } catch (error) {
        console.error("Upload failed:", error);
        write({
          type: "error",
          error:
            "Something went wrong part-way through. Nothing else was changed — fix the file and upload it again.",
        });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Stops a proxy holding the lines back until the end.
      "X-Accel-Buffering": "no",
    },
  });
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

  let sheet: ParsedSheet;
  try {
    sheet = parseSheet(await file.arrayBuffer());
  } catch {
    return NextResponse.json(
      { error: "Could not read that file. Upload an .xlsx, .xls or .csv file." },
      { status: 400 },
    );
  }
  if (sheet.rows.length === 0) {
    return NextResponse.json(
      {
        error:
          "No rows of data found. Check the sheet has a row of column headings with the students below it.",
      },
      { status: 400 },
    );
  }

  if (type === "students") return streamed((send) => importStudents(sheet, send));
  if (type === "groups") {
    const createAccounts = String(form.get("createAccounts") ?? "") !== "false";
    return streamed((send) => importGroups(sheet, { createAccounts }, send));
  }
  if (type === "timetable") {
    const name =
      String(form.get("name") ?? "").trim() || `Timetable uploaded ${schoolToday()}`;
    const mode = String(form.get("mode") ?? "add") === "replace" ? "replace" : "add";
    const effectiveFrom = String(form.get("effectiveFrom") ?? "").trim();

    if (mode === "replace" && !isValidIsoDate(effectiveFrom)) {
      return NextResponse.json(
        { error: "Choose the date the new timetable starts from." },
        { status: 400 },
      );
    }
    return streamed((send) =>
      importTimetable(
        sheet,
        { mode, name, effectiveFrom, uploadedById: auth.session.sub },
        send,
      ),
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
  sheet: ParsedSheet,
  options: { createAccounts: boolean },
  onProgress: OnProgress = () => {},
): Promise<UploadReport> {
  const rows = sheet.rows;
  const report: UploadReport = {
    type: "groups",
    rows: rows.length,
    source: {
      sheetName: sheet.sheetName,
      headerRow: sheet.headerRow,
      columns: sheet.columns,
    },
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

  onProgress("Reading the sheet", 0, rows.length);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = rowNumberOf(row, sheet.headerRow + 1 + i);
    onProgress("Saving groups", i, rows.length);

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
    report.errors.unshift({
      row: 0,
      message: `Nothing was read. The app used the sheet "${sheet.sheetName}" with headings on row ${sheet.headerRow}: ${
        sheet.columns.join(" · ") || "none found"
      }. It needs a Group column and a Teacher column.`,
    });
  }

  return trimIssues(report);
}

// ---------------------------------------------------------------------------
// Students, with up to three groups each
//
// Written in bulk rather than row by row: a 250-student list used to mean
// about 1,500 separate database round trips, which took over a minute on a
// hosted database. It now takes a handful of queries.
// ---------------------------------------------------------------------------

type StudentIntent = {
  rowNumber: number;
  firstName: string;
  lastName: string;
  grade: number;
  className: string | null;
  externalId: string | null;
  groups: string[];
  expected: Subject[];
};

function nameKey(firstName: string, lastName: string, grade: number) {
  return `${firstName.trim().toLowerCase()}|${lastName.trim().toLowerCase()}|${grade}`;
}

async function importStudents(
  sheet: ParsedSheet,
  onProgress: OnProgress = () => {},
): Promise<UploadReport> {
  const rows = sheet.rows;
  const report: UploadReport = {
    type: "students",
    rows: rows.length,
    source: {
      sheetName: sheet.sheetName,
      headerRow: sheet.headerRow,
      columns: sheet.columns,
    },
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  // ---- 1. read every row ------------------------------------------------
  onProgress("Reading the sheet", 0, rows.length);
  const intents: StudentIntent[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = rowNumberOf(row, sheet.headerRow + 1 + i);

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

    // One column per track. General English is the one everybody has.
    const groups: string[] = [];
    const expected: Subject[] = [];
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
    if (general) {
      groups.push(general);
      expected.push("GENERAL_ENGLISH");
    }
    if (satEnglish) {
      groups.push(satEnglish);
      expected.push("SAT_ENGLISH");
    }
    if (satMath) {
      groups.push(satMath);
      expected.push("SAT_MATH");
    }

    intents.push({
      rowNumber,
      firstName,
      lastName,
      grade,
      className: pick(row, "Class Name", "Classname", "Class", "Sinfi") || null,
      externalId: pick(row, "UID", "Student ID", "ID", "Code") || null,
      groups,
      expected,
    });
  }

  if (intents.length === 0) {
    report.errors.unshift({
      row: 0,
      message: `No students were read. The app used the sheet "${sheet.sheetName}" with headings on row ${sheet.headerRow}: ${
        sheet.columns.join(" · ") || "none found"
      }. It needs a First Name column and a Last Name column (or one Full Name column).`,
    });
    return trimIssues(report);
  }

  // ---- 2. the groups they name ------------------------------------------
  onProgress("Checking the groups", 0, intents.length);
  const known = await prisma.group.findMany({
    select: { id: true, name: true, grade: true, subject: true },
  });
  const groupByName = new Map(known.map((group) => [keyOf(group.name), group]));

  const missing = new Map<string, string>(); // key -> name as written
  for (const intent of intents) {
    for (const name of intent.groups) {
      if (!groupByName.has(keyOf(name))) missing.set(keyOf(name), name);
    }
  }
  if (missing.size > 0) {
    const createdGroups = await prisma.group.createManyAndReturn({
      data: [...missing.values()].map((name) => {
        const parsed = parseGroupName(name);
        return { name, grade: parsed.grade, subject: parsed.subject };
      }),
      select: { id: true, name: true, grade: true, subject: true },
    });
    for (const group of createdGroups) {
      groupByName.set(keyOf(group.name), group);
      report.warnings.push({
        row: 0,
        message: `Group "${group.name}" was not on the group list, so it was created as ${subjectLabel(group.subject)}. Give it a teacher.`,
      });
    }
  }

  // ---- 3. who is already on file ----------------------------------------
  onProgress("Matching against the students you already have", 0, intents.length);
  const uids = intents.map((intent) => intent.externalId).filter(Boolean) as string[];
  const grades = [...new Set(intents.map((intent) => intent.grade))];

  const [byUidRows, byGradeRows] = await Promise.all([
    uids.length > 0
      ? prisma.pupil.findMany({ where: { externalId: { in: uids } } })
      : Promise.resolve([]),
    prisma.pupil.findMany({ where: { grade: { in: grades } } }),
  ]);

  const byUid = new Map(byUidRows.map((pupil) => [pupil.externalId as string, pupil]));
  const byName = new Map<string, (typeof byGradeRows)[number]>();
  for (const pupil of byGradeRows) {
    const key = nameKey(pupil.firstName, pupil.lastName, pupil.grade);
    if (!byName.has(key)) byName.set(key, pupil);
  }

  type Resolved = { intent: StudentIntent; pupilId: string };
  const resolved: Resolved[] = [];
  const toCreate: StudentIntent[] = [];
  const toUpdate: Array<{ id: string; intent: StudentIntent }> = [];

  for (const intent of intents) {
    const existing =
      (intent.externalId ? byUid.get(intent.externalId) : undefined) ??
      byName.get(nameKey(intent.firstName, intent.lastName, intent.grade));

    if (!existing) {
      toCreate.push(intent);
      continue;
    }

    const changed =
      existing.firstName !== intent.firstName ||
      existing.lastName !== intent.lastName ||
      existing.grade !== intent.grade ||
      !existing.isActive ||
      (intent.className !== null && existing.className !== intent.className) ||
      (intent.externalId !== null && existing.externalId !== intent.externalId);

    if (changed) toUpdate.push({ id: existing.id, intent });
    resolved.push({ intent, pupilId: existing.id });
    report.updated++;
  }

  // ---- 4. write the students --------------------------------------------
  if (toCreate.length > 0) {
    onProgress("Adding new students", 0, toCreate.length);
    const createdPupils = await prisma.pupil.createManyAndReturn({
      data: toCreate.map((intent) => ({
        firstName: intent.firstName,
        lastName: intent.lastName,
        grade: intent.grade,
        className: intent.className,
        externalId: intent.externalId,
      })),
      select: { id: true },
    });
    createdPupils.forEach((pupil, index) => {
      resolved.push({ intent: toCreate[index], pupilId: pupil.id });
    });
    report.created = createdPupils.length;
    onProgress("Adding new students", createdPupils.length, createdPupils.length);
  }

  if (toUpdate.length > 0) {
    onProgress("Updating students already on file", 0, toUpdate.length);
    const batchSize = 20;
    for (let i = 0; i < toUpdate.length; i += batchSize) {
      const batch = toUpdate.slice(i, i + batchSize);
      await Promise.all(
        batch.map((entry) =>
          prisma.pupil.update({
            where: { id: entry.id },
            data: {
              firstName: entry.intent.firstName,
              lastName: entry.intent.lastName,
              grade: entry.intent.grade,
              isActive: true,
              ...(entry.intent.className ? { className: entry.intent.className } : {}),
              ...(entry.intent.externalId ? { externalId: entry.intent.externalId } : {}),
            },
          }),
        ),
      );
      onProgress(
        "Updating students already on file",
        Math.min(i + batchSize, toUpdate.length),
        toUpdate.length,
      );
    }
  }

  // ---- 5. put them in their groups --------------------------------------
  onProgress("Putting students in their groups", 0, resolved.length);
  const today = toDbDate(schoolToday());
  const pupilIds = resolved.map((entry) => entry.pupilId);

  const active = await prisma.enrollment.findMany({
    where: { pupilId: { in: pupilIds }, endDate: null },
    select: { id: true, pupilId: true, groupId: true, group: { select: { subject: true } } },
  });

  // One place per student per track.
  const current = new Map<string, { id: string | null; groupId: string }>();
  for (const enrollment of active) {
    current.set(`${enrollment.pupilId}|${enrollment.group.subject}`, {
      id: enrollment.id,
      groupId: enrollment.groupId,
    });
  }

  const toEnd: string[] = [];
  const toEnroll: Array<{ pupilId: string; groupId: string; startDate: Date }> = [];

  for (const entry of resolved) {
    entry.intent.groups.forEach((name, index) => {
      const group = groupByName.get(keyOf(name));
      if (!group) return;

      const expected = entry.intent.expected[index];
      if (group.subject !== expected) {
        report.warnings.push({
          row: entry.intent.rowNumber,
          message: `"${group.name}" is a ${subjectLabel(group.subject)} group but sits in the ${subjectLabel(expected)} column. Check the sheet.`,
        });
      }

      const key = `${entry.pupilId}|${group.subject}`;
      const existing = current.get(key);
      if (existing?.groupId === group.id) return;

      // The uploaded list is authoritative: a student listed in a different
      // group for the same track leaves the old one from today.
      if (existing?.id) toEnd.push(existing.id);
      toEnroll.push({ pupilId: entry.pupilId, groupId: group.id, startDate: today });
      current.set(key, { id: null, groupId: group.id });
    });
  }

  for (let i = 0; i < toEnd.length; i += 500) {
    await prisma.enrollment.updateMany({
      where: { id: { in: toEnd.slice(i, i + 500) } },
      data: { endDate: today },
    });
  }
  if (toEnroll.length > 0) {
    await prisma.enrollment.createMany({ data: toEnroll });
  }
  onProgress("Putting students in their groups", resolved.length, resolved.length);

  if (report.created + report.updated === 0) {
    report.errors.unshift({
      row: 0,
      message: `No students were read. The app used the sheet "${sheet.sheetName}" with headings on row ${sheet.headerRow}: ${
        sheet.columns.join(" · ") || "none found"
      }. It needs a First Name column and a Last Name column (or one Full Name column).`,
    });
  }

  return trimIssues(report);
}

// ---------------------------------------------------------------------------
// Timetable
// ---------------------------------------------------------------------------
async function importTimetable(
  sheet: ParsedSheet,
  options: {
    mode: "add" | "replace";
    name: string;
    effectiveFrom: string;
    uploadedById: string;
  },
  onProgress: OnProgress = () => {},
): Promise<UploadReport> {
  const rows = sheet.rows;
  const report: UploadReport = {
    type: "timetable",
    rows: rows.length,
    source: {
      sheetName: sheet.sheetName,
      headerRow: sheet.headerRow,
      columns: sheet.columns,
    },
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    warnings: [],
  };

  // Adding tops up the timetable already in force, so a sheet holding only a
  // few groups does not take every other group's lessons away.
  const target =
    options.mode === "add"
      ? ((await versionForDate(schoolToday())) ??
        (await prisma.timetableVersion.findFirst({
          orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }],
        })))
      : null;

  onProgress("Reading the sheet", 0, rows.length);
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

  // When adding, the lessons already on the timetable count as taken.
  if (target) {
    const existing = await prisma.timetableSlot.findMany({
      where: { versionId: target.id },
      select: { groupId: true, teacherId: true, dayOfWeek: true, period: true, room: true },
    });
    for (const slot of existing) {
      seen.add(`${slot.groupId}|${slot.dayOfWeek}|${slot.period}`);
      if (slot.teacherId) {
        teacherBusy.set(`${slot.teacherId}|${slot.dayOfWeek}|${slot.period}`, 0);
      }
      if (slot.room) {
        roomBusy.set(`${keyOf(slot.room)}|${slot.dayOfWeek}|${slot.period}`, 0);
      }
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = rowNumberOf(row, sheet.headerRow + 1 + i);

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
        message: `${group.name} already has a lesson on day ${dayOfWeek} period ${period}, so this row was left out.`,
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
      if (firstRow !== undefined) {
        report.warnings.push({
          row: rowNumber,
          message: `That teacher is already teaching at day ${dayOfWeek} period ${period} ${
            firstRow ? `(row ${firstRow})` : "on the current timetable"
          }.`,
        });
      } else {
        teacherBusy.set(busyKey, rowNumber);
      }
    }
    if (room) {
      const busyKey = `${keyOf(room)}|${dayOfWeek}|${period}`;
      const firstRow = roomBusy.get(busyKey);
      if (firstRow !== undefined) {
        report.warnings.push({
          row: rowNumber,
          message: `Room ${room} is already in use at day ${dayOfWeek} period ${period} ${
            firstRow ? `(row ${firstRow})` : "on the current timetable"
          }. Joint lessons are fine.`,
        });
      } else {
        roomBusy.set(busyKey, rowNumber);
      }
    }

    slots.push({ groupId: group.id, teacherId, dayOfWeek, period, subject, room });
  }

  if (slots.length === 0) {
    report.errors.unshift({
      row: 0,
      message: `No usable rows, so no timetable was saved. The app used the sheet "${sheet.sheetName}" with headings on row ${sheet.headerRow}: ${
        sheet.columns.join(" · ") || "none found"
      }.`,
    });
    return trimIssues(report);
  }

  onProgress("Saving the lessons", 0, slots.length);
  if (options.mode === "add" && target) {
    const added = await prisma.timetableSlot.createMany({
      data: slots.map((slot) => ({ ...slot, versionId: target.id })),
      skipDuplicates: true,
    });
    report.created = added.count;
    report.note = `Added to "${target.name}", in force from ${toIsoDate(target.effectiveFrom)}. Every other group's lessons were left alone.`;
    return trimIssues(report);
  }

  const startsOn =
    options.mode === "replace" ? options.effectiveFrom : schoolToday();

  await prisma.$transaction(async (tx) => {
    const version = await tx.timetableVersion.create({
      data: {
        name: options.name,
        effectiveFrom: toDbDate(startsOn),
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
  report.note =
    options.mode === "replace"
      ? `This is the whole timetable from ${startsOn}. Attendance before that date keeps the previous timetable.`
      : `No timetable existed, so one was created starting ${startsOn}.`;
  return trimIssues(report);
}
