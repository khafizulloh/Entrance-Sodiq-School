/**
 * Seeds the attendance tracker so it can be used straight away: staff
 * accounts, the groups, the weekly timetable and the tracking period.
 *
 * Run with:  npm run db:seed:attendance
 *
 * Groups and teachers follow the school's own lists. General English groups
 * are named by band — 5-E1 to 5-E4 take grades 5 and 6, 11-E1 to 11-E4 take
 * grades 10 and 11 — and every group in a band meets at the same periods, so
 * a student can be moved between them without a clash.
 *
 * SAT groups are created but have no lessons on the timetable yet. Add them
 * with a timetable upload once the SAT times are set.
 *
 * Students are not seeded: upload the real list under Uploads → Student list.
 * Set ATTENDANCE_SEED_SAMPLE_STUDENTS=true for a few made-up ones to click
 * around with.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEACHERS = [
  { loginId: "nika", fullName: "Nika" },
  { loginId: "izzat", fullName: "Izzat" },
  { loginId: "rayxona", fullName: "Rayxona" },
  { loginId: "mohigul", fullName: "Mohigul" },
  { loginId: "ruqiya", fullName: "Ruqiya" },
  { loginId: "muslima", fullName: "Muslima" },
  { loginId: "khafizulloh", fullName: "Khafizulloh" },
  { loginId: "muhammaddiyor", fullName: "Muhammaddiyor" },
  { loginId: "umar", fullName: "Umar" },
];

/** [day, period] pairs. 1 = Monday ... 5 = Friday. */
type Block = Array<[number, number]>;

// Grades 5–6 study together, grades 10–11 study together.
const BAND_5: Block = [
  [1, 1],
  [1, 2],
  [3, 6],
  [3, 7],
  [4, 3],
  [4, 4],
];
const BAND_7: Block = [
  [2, 3],
  [2, 4],
  [3, 3],
  [3, 4],
  [5, 3],
  [5, 4],
];
const BAND_8: Block = [
  [2, 1],
  [2, 2],
  [4, 1],
  [4, 2],
  [5, 7],
  [5, 8],
];
const BAND_9: Block = [
  [1, 3],
  [1, 4],
  [3, 1],
  [3, 2],
  [4, 7],
  [4, 8],
];
const BAND_11: Block = [
  [1, 5],
  [1, 7],
  [2, 7],
  [2, 8],
  [5, 1],
  [5, 2],
];

type SeedGroup = {
  name: string;
  grade: number;
  subject: string;
  teacher: string;
  block: Block | null;
};

const GROUPS: SeedGroup[] = [
  // Grades 5–6: Mon 1–2, Wed 6–7, Thu 3–4
  { name: "5-E1", grade: 5, subject: "GENERAL_ENGLISH", teacher: "nika", block: BAND_5 },
  { name: "5-E2", grade: 5, subject: "GENERAL_ENGLISH", teacher: "izzat", block: BAND_5 },
  { name: "5-E3", grade: 5, subject: "GENERAL_ENGLISH", teacher: "rayxona", block: BAND_5 },
  { name: "5-E4", grade: 5, subject: "GENERAL_ENGLISH", teacher: "mohigul", block: BAND_5 },

  // Grade 7: Tue 3–4, Wed 3–4, Fri 3–4
  { name: "7-E1", grade: 7, subject: "GENERAL_ENGLISH", teacher: "ruqiya", block: BAND_7 },
  { name: "7-E2", grade: 7, subject: "GENERAL_ENGLISH", teacher: "rayxona", block: BAND_7 },
  { name: "7-E3", grade: 7, subject: "GENERAL_ENGLISH", teacher: "mohigul", block: BAND_7 },

  // Grade 8: Tue 1–2, Thu 1–2, Fri 7–8
  { name: "8-E1", grade: 8, subject: "GENERAL_ENGLISH", teacher: "rayxona", block: BAND_8 },
  { name: "8-E2", grade: 8, subject: "GENERAL_ENGLISH", teacher: "ruqiya", block: BAND_8 },
  { name: "8-E3", grade: 8, subject: "GENERAL_ENGLISH", teacher: "nika", block: BAND_8 },

  // Grade 9: Mon 3–4, Wed 1–2, Thu 7–8
  { name: "9-E1", grade: 9, subject: "GENERAL_ENGLISH", teacher: "nika", block: BAND_9 },
  { name: "9-E2", grade: 9, subject: "GENERAL_ENGLISH", teacher: "izzat", block: BAND_9 },
  { name: "9-E3", grade: 9, subject: "GENERAL_ENGLISH", teacher: "ruqiya", block: BAND_9 },
  { name: "9-E4", grade: 9, subject: "GENERAL_ENGLISH", teacher: "mohigul", block: BAND_9 },

  // Grades 10–11: Mon 5 and 7, Tue 7–8, Fri 1–2
  { name: "11-E1", grade: 11, subject: "GENERAL_ENGLISH", teacher: "nika", block: BAND_11 },
  { name: "11-E2", grade: 11, subject: "GENERAL_ENGLISH", teacher: "ruqiya", block: BAND_11 },
  { name: "11-E3", grade: 11, subject: "GENERAL_ENGLISH", teacher: "mohigul", block: BAND_11 },
  { name: "11-E4", grade: 11, subject: "GENERAL_ENGLISH", teacher: "muslima", block: BAND_11 },

  // SAT: groups exist so students can be assigned. Times come later.
  { name: "SAT - E1", grade: 11, subject: "SAT_ENGLISH", teacher: "khafizulloh", block: null },
  { name: "SAT - E2", grade: 11, subject: "SAT_ENGLISH", teacher: "izzat", block: null },
  { name: "SAT - M1", grade: 11, subject: "SAT_MATH", teacher: "muhammaddiyor", block: null },
  { name: "SAT - M2", grade: 11, subject: "SAT_MATH", teacher: "umar", block: null },
];

const SAMPLE_STUDENTS: Array<[string, string, number, string, string]> = [
  ["Munisa", "Karimova", 5, "5 - Tokyo", "5-E1"],
  ["Dilshod", "Davlatyorov", 6, "6 - Imperial", "5-E1"],
  ["Amirbek", "Zokirov", 5, "5 - London", "5-E2"],
  ["Durbek", "Karimov", 7, "7 - Sydney", "7-E1"],
  ["Mahinabonu", "Faxriddinova", 8, "8 - Columbia", "8-E1"],
  ["Fotima", "Ergashbaeva", 9, "9 - Cambridge", "9-E1"],
  ["Asilbek", "Amreyev", 11, "11 - Yale", "11-E1"],
  ["Abdulhamid", "Axramov", 10, "10 - Stanford", "11-E1"],
];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dbDate(iso: string) {
  return new Date(`${iso}T00:00:00.000Z`);
}

async function main() {
  const headLogin = (process.env.ATTENDANCE_HEAD_LOGIN || "head").toLowerCase();
  const headPassword = process.env.ATTENDANCE_HEAD_PASSWORD || "Head12345!";
  const headName = process.env.ATTENDANCE_HEAD_NAME || "Sodiq School Head Teacher";
  const teacherPassword = process.env.ATTENDANCE_TEACHER_PASSWORD || "Teacher12345!";

  // ---- staff -------------------------------------------------------------
  const head = await prisma.staff.upsert({
    where: { loginId: headLogin },
    update: { fullName: headName, role: "head", isActive: true },
    create: {
      loginId: headLogin,
      fullName: headName,
      role: "head",
      passwordHash: await bcrypt.hash(headPassword, 10),
    },
  });

  const teacherHash = await bcrypt.hash(teacherPassword, 10);
  const staffByLogin = new Map<string, string>();
  for (const teacher of TEACHERS) {
    const record = await prisma.staff.upsert({
      where: { loginId: teacher.loginId },
      update: { fullName: teacher.fullName },
      create: { ...teacher, role: "teacher", passwordHash: teacherHash },
    });
    staffByLogin.set(teacher.loginId, record.id);
  }
  console.log(`Staff: 1 head teacher + ${TEACHERS.length} teachers.`);

  // ---- term: 3 September to 26 December of the current school year --------
  const now = new Date();
  const schoolYear =
    now.getMonth() > 7 || (now.getMonth() === 8 && now.getDate() >= 3)
      ? now.getFullYear()
      : now.getFullYear() - 1;
  const startIso = `${schoolYear}-09-03`;
  const endIso = `${schoolYear}-12-26`;

  const existingTerm = await prisma.term.findFirst({ where: { isActive: true } });
  const term =
    existingTerm ??
    (await prisma.term.create({
      data: {
        name: `September–December ${schoolYear}`,
        startDate: dbDate(startIso),
        endDate: dbDate(endIso),
        isActive: true,
      },
    }));
  console.log(`Term: ${term.name} (${isoDate(term.startDate)} → ${isoDate(term.endDate)}).`);

  // ---- groups ------------------------------------------------------------
  const groupIdByName = new Map<string, string>();
  for (const group of GROUPS) {
    const record = await prisma.group.upsert({
      where: { name: group.name },
      update: {
        grade: group.grade,
        subject: group.subject,
        teacherId: staffByLogin.get(group.teacher) ?? null,
        isActive: true,
      },
      create: {
        name: group.name,
        grade: group.grade,
        subject: group.subject,
        teacherId: staffByLogin.get(group.teacher) ?? null,
      },
    });
    groupIdByName.set(group.name, record.id);
  }
  console.log(`Groups: ${GROUPS.length} (${GROUPS.filter((g) => !g.block).length} SAT groups without times yet).`);

  // ---- timetable ---------------------------------------------------------
  const alreadyUploaded = await prisma.timetableVersion.count();
  if (alreadyUploaded === 0) {
    const version = await prisma.timetableVersion.create({
      data: {
        name: "Starting timetable",
        effectiveFrom: term.startDate,
        note: "Seeded from the school's weekly blocks",
        uploadedById: head.id,
      },
    });

    const slots = GROUPS.flatMap((group) =>
      (group.block ?? []).map(([dayOfWeek, period]) => ({
        versionId: version.id,
        groupId: groupIdByName.get(group.name) as string,
        teacherId: staffByLogin.get(group.teacher) ?? null,
        dayOfWeek,
        period,
        subject: group.subject,
      })),
    );
    await prisma.timetableSlot.createMany({ data: slots, skipDuplicates: true });
    console.log(`Timetable: ${slots.length} weekly lessons from ${isoDate(term.startDate)}.`);
  } else {
    console.log("Timetable: already present, left as it is.");
  }

  // ---- sample students (off unless asked for) -----------------------------
  const wantSamples = process.env.ATTENDANCE_SEED_SAMPLE_STUDENTS === "true";
  const existingPupils = await prisma.pupil.count();
  if (wantSamples && existingPupils === 0) {
    for (const [firstName, lastName, grade, className, groupName] of SAMPLE_STUDENTS) {
      const pupil = await prisma.pupil.create({
        data: { firstName, lastName, grade, className },
      });
      const groupId = groupIdByName.get(groupName);
      if (groupId) {
        await prisma.enrollment.create({
          data: { pupilId: pupil.id, groupId, startDate: term.startDate },
        });
      }
    }
    console.log(`Students: ${SAMPLE_STUDENTS.length} samples added.`);
  } else if (existingPupils > 0) {
    console.log(`Students: ${existingPupils} already on file, left as they are.`);
  } else {
    console.log("Students: none. Upload the real list under Uploads → Student list.");
  }

  console.log("\nSign in at /attendance");
  console.log(`  Head teacher: ${headLogin} / ${headPassword}`);
  console.log(`  Teachers:     ${TEACHERS.map((t) => t.loginId).join(", ")} / ${teacherPassword}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
