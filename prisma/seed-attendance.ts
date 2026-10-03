/**
 * Seeds the attendance tracker so it can be used (or demonstrated) right away:
 * staff accounts, groups, the parallel-block timetable, class lists and a
 * two-month tracking period.
 *
 * Run with:  npm run db:seed:attendance
 *
 * The timetable here follows the blocks in the school's current timetable
 * report: every group in a grade meets at the same periods, so a student can
 * be moved between groups of the same grade without a clash. Teacher names and
 * the group-to-teacher pairings for the named groups are starting values —
 * upload the real group list and timetable to replace them.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TEACHERS = [
  { loginId: "nigina", fullName: "Tuxtasinova Nigina" },
  { loginId: "mohigul", fullName: "Anvarbekova Mohigul" },
  { loginId: "ruqiya", fullName: "Maxbubova Ruqiya" },
  { loginId: "rayxon", fullName: "Bo'riyeva Rayxon" },
  { loginId: "izzat", fullName: "Vaxobjonov Izzat" },
  { loginId: "muslima", fullName: "To'xtamurodova Muslima" },
  { loginId: "umarjon", fullName: "Baxtiyorov Umarjon" },
  { loginId: "khafizulloh", fullName: "Ahmad Khafizulloh" },
  { loginId: "muhammadiyor", fullName: "Isomiddinov Muhammadiyor" },
];

/** [day, period] pairs. 1 = Monday ... 5 = Friday. */
type Block = Array<[number, number]>;

const BLOCK_5_6: Block = [
  [1, 1],
  [1, 2],
  [3, 6],
  [3, 7],
  [4, 3],
  [4, 4],
];
const BLOCK_7: Block = [
  [2, 3],
  [2, 4],
  [3, 3],
  [3, 4],
  [5, 3],
  [5, 4],
];
const BLOCK_8: Block = [
  [2, 1],
  [2, 2],
  [4, 1],
  [4, 2],
  [5, 7],
  [5, 8],
];
const BLOCK_9: Block = [
  [1, 3],
  [1, 4],
  [3, 1],
  [3, 2],
  [4, 7],
  [4, 8],
];
const BLOCK_IELTS: Block = [
  [1, 5],
  [1, 7],
  [2, 7],
  [2, 8],
  [5, 1],
  [5, 2],
];
const BLOCK_SAT_MATH_10: Block = [
  [3, 7],
  [3, 8],
  [4, 7],
  [4, 8],
  [5, 7],
  [5, 8],
];
const BLOCK_SAT_MATH_11: Block = [
  [3, 3],
  [3, 4],
  [5, 3],
  [5, 4],
];

const GROUPS = [
  // Grades 5–6 meet Mon 1–2, Wed 6–7, Thu 3–4.
  { name: "5 TOKYO", grade: 5, subject: "ENGLISH", room: "201", teacher: "nigina", block: BLOCK_5_6 },
  { name: "5 LONDON", grade: 5, subject: "ENGLISH", room: "202", teacher: "ruqiya", block: BLOCK_5_6 },
  { name: "6 IMPERIAL", grade: 6, subject: "ENGLISH", room: "203", teacher: "rayxon", block: BLOCK_5_6 },
  { name: "6/2", grade: 6, subject: "ENGLISH", room: null, teacher: "mohigul", block: BLOCK_5_6 },

  // Grade 7 meets Tue 3–4, Wed 3–4, Fri 3–4.
  { name: "7 SYDNEY", grade: 7, subject: "ENGLISH", room: "204", teacher: "nigina", block: BLOCK_7 },
  { name: "7 UPENN", grade: 7, subject: "ENGLISH", room: "205", teacher: "ruqiya", block: BLOCK_7 },
  { name: "7/3", grade: 7, subject: "ENGLISH", room: null, teacher: "mohigul", block: BLOCK_7 },

  // Grade 8 meets Tue 1–2, Thu 1–2, Fri 7–8.
  { name: "8 COLUMBIA", grade: 8, subject: "ENGLISH", room: "206", teacher: "mohigul", block: BLOCK_8 },
  { name: "8 COLORADO", grade: 8, subject: "ENGLISH", room: "207", teacher: "ruqiya", block: BLOCK_8 },
  { name: "8/3", grade: 8, subject: "ENGLISH", room: null, teacher: "nigina", block: BLOCK_8 },

  // Grade 9 meets Mon 3–4, Wed 1–2, Thu 7–8.
  { name: "9 MIT", grade: 9, subject: "ENGLISH", room: "208", teacher: "nigina", block: BLOCK_9 },
  { name: "9 CAMBRIDGE", grade: 9, subject: "ENGLISH", room: "209", teacher: "rayxon", block: BLOCK_9 },
  { name: "9/3", grade: 9, subject: "ENGLISH", room: null, teacher: "mohigul", block: BLOCK_9 },
  { name: "9/4", grade: 9, subject: "ENGLISH", room: null, teacher: "izzat", block: BLOCK_9 },

  // Grades 10–11 IELTS meet Mon 5 and 7, Tue 7–8, Fri 1–2.
  { name: "11 YALE", grade: 11, subject: "IELTS", room: "301", teacher: "izzat", block: BLOCK_IELTS },
  { name: "10 OXFORD", grade: 10, subject: "IELTS", room: "302", teacher: "ruqiya", block: BLOCK_IELTS },
  { name: "10 STANFORD", grade: 10, subject: "IELTS", room: "303", teacher: "rayxon", block: BLOCK_IELTS },
  { name: "10/3", grade: 10, subject: "IELTS", room: null, teacher: "muslima", block: BLOCK_IELTS },

  // SAT Math. A student can be in an English/IELTS group and a SAT Math group.
  { name: "SAT MATH 10", grade: 10, subject: "SAT_MATH", room: "305", teacher: "umarjon", block: BLOCK_SAT_MATH_10 },
  { name: "SAT MATH 11", grade: 11, subject: "SAT_MATH", room: "306", teacher: "muhammadiyor", block: BLOCK_SAT_MATH_11 },
];

const FIRST_NAMES = [
  "Ali", "Nodira", "Sardor", "Zilola", "Jasur", "Madina", "Bekzod", "Oydin",
  "Temur", "Shahzoda", "Akmal", "Gulnora", "Davron", "Kamola", "Ruslan",
  "Dilnoza", "Islom", "Sevinch", "Aziz", "Mohira", "Farrux", "Nilufar",
  "Ulugbek", "Zarina",
];
const LAST_NAMES = [
  "Karimov", "Yusupova", "Qosimov", "Rahmonova", "Tursunov", "Ibragimova",
  "Sultonov", "Nazarova", "Ergashev", "Yo'ldosheva", "Hamidov", "Saidova",
  "Mirzayev", "Olimova", "Rasulov", "Juraeva",
];

function pupilName(index: number) {
  return {
    firstName: FIRST_NAMES[index % FIRST_NAMES.length],
    lastName: LAST_NAMES[Math.floor(index / FIRST_NAMES.length) % LAST_NAMES.length],
  };
}

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
  // Before 3 September we are still in last year's term.
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
        room: group.room,
        teacherId: staffByLogin.get(group.teacher) ?? null,
        isActive: true,
      },
      create: {
        name: group.name,
        grade: group.grade,
        subject: group.subject,
        room: group.room,
        teacherId: staffByLogin.get(group.teacher) ?? null,
      },
    });
    groupIdByName.set(group.name, record.id);
  }
  console.log(`Groups: ${GROUPS.length}.`);

  // ---- timetable ---------------------------------------------------------
  const alreadyUploaded = await prisma.timetableVersion.count();
  if (alreadyUploaded === 0) {
    const version = await prisma.timetableVersion.create({
      data: {
        name: "Starting timetable",
        effectiveFrom: term.startDate,
        note: "Seeded from the current timetable blocks",
        uploadedById: head.id,
      },
    });

    const slots = GROUPS.flatMap((group) =>
      group.block.map(([dayOfWeek, period]) => ({
        versionId: version.id,
        groupId: groupIdByName.get(group.name) as string,
        teacherId: staffByLogin.get(group.teacher) ?? null,
        dayOfWeek,
        period,
        subject: group.subject,
        room: group.room,
      })),
    );
    await prisma.timetableSlot.createMany({ data: slots, skipDuplicates: true });
    console.log(`Timetable: ${slots.length} weekly lessons from ${isoDate(term.startDate)}.`);
  } else {
    console.log("Timetable: already present, left as it is.");
  }

  // ---- class lists -------------------------------------------------------
  const existingPupils = await prisma.pupil.count();
  if (existingPupils === 0) {
    let index = 0;
    for (const group of GROUPS) {
      const groupId = groupIdByName.get(group.name) as string;
      // SAT Math groups are filled from the pupils already in grade 10/11.
      if (group.subject === "SAT_MATH") continue;

      for (let seat = 0; seat < 8; seat++) {
        const name = pupilName(index++);
        const pupil = await prisma.pupil.create({
          data: {
            firstName: name.firstName,
            lastName: name.lastName,
            grade: group.grade,
            externalId: `S-${String(index).padStart(4, "0")}`,
          },
        });
        await prisma.enrollment.create({
          data: { pupilId: pupil.id, groupId, startDate: term.startDate },
        });
      }
    }

    // Half of each senior IELTS group also takes SAT Math.
    for (const satGroup of GROUPS.filter((group) => group.subject === "SAT_MATH")) {
      const groupId = groupIdByName.get(satGroup.name) as string;
      const candidates = await prisma.pupil.findMany({
        where: { grade: satGroup.grade },
        take: 6,
      });
      for (const pupil of candidates) {
        await prisma.enrollment.create({
          data: { pupilId: pupil.id, groupId, startDate: term.startDate },
        });
      }
    }
    const total = await prisma.pupil.count();
    console.log(`Students: ${total} across the class lists.`);
  } else {
    console.log(`Students: ${existingPupils} already on file, left as they are.`);
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
