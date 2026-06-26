import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { GRADES } from "../src/lib/levels";

const prisma = new PrismaClient();

/**
 * Seed script:
 *  - creates the default admin user (from env)
 *  - creates one test per grade (2..11) with sample multiple-choice questions
 *
 * Run with: npm run db:seed
 */

type SeedQuestion = {
  text: string;
  // Approved publisher source: Cambridge / Oxford / Pearson.
  source: string;
  options: { label: "A" | "B" | "C" | "D"; text: string; isCorrect: boolean }[];
};

// A small bank of sample questions used for every grade's test.
// Admins can edit/add/delete these from the dashboard after seeding.
function sampleQuestionsForGrade(grade: number): SeedQuestion[] {
  return [
    {
      text: "Choose the correct word: She ___ to school every day.",
      source: "Cambridge",
      options: [
        { label: "A", text: "go", isCorrect: false },
        { label: "B", text: "goes", isCorrect: true },
        { label: "C", text: "going", isCorrect: false },
        { label: "D", text: "gone", isCorrect: false },
      ],
    },
    {
      text: "What is the opposite of 'big'?",
      source: "Oxford",
      options: [
        { label: "A", text: "large", isCorrect: false },
        { label: "B", text: "huge", isCorrect: false },
        { label: "C", text: "small", isCorrect: true },
        { label: "D", text: "tall", isCorrect: false },
      ],
    },
    {
      text: "Pick the correct article: I saw ___ elephant at the zoo.",
      source: "Pearson",
      options: [
        { label: "A", text: "a", isCorrect: false },
        { label: "B", text: "an", isCorrect: true },
        { label: "C", text: "the", isCorrect: false },
        { label: "D", text: "no article", isCorrect: false },
      ],
    },
    {
      text: `Math (Grade ${grade}): What is ${grade} + ${grade}?`,
      source: "Cambridge",
      options: [
        { label: "A", text: `${grade * 2 - 1}`, isCorrect: false },
        { label: "B", text: `${grade * 2}`, isCorrect: true },
        { label: "C", text: `${grade * 2 + 1}`, isCorrect: false },
        { label: "D", text: `${grade * 3}`, isCorrect: false },
      ],
    },
    {
      text: "Choose the correctly spelled word.",
      source: "Oxford",
      options: [
        { label: "A", text: "recieve", isCorrect: false },
        { label: "B", text: "receive", isCorrect: true },
        { label: "C", text: "receeve", isCorrect: false },
        { label: "D", text: "receve", isCorrect: false },
      ],
    },
  ];
}

async function main() {
  // 1) Admin user
  const email = process.env.ADMIN_EMAIL ?? "admin@sodiqschool.uz";
  const password = process.env.ADMIN_PASSWORD ?? "Admin12345!";
  const name = process.env.ADMIN_NAME ?? "Sodiq School Admin";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.adminUser.upsert({
    where: { email },
    update: { passwordHash, name },
    create: { email, passwordHash, name },
  });
  console.log(`✓ Admin user ready: ${email}`);

  // 2) One test per grade with sample questions
  for (const grade of GRADES) {
    const test = await prisma.test.upsert({
      where: { grade },
      update: {},
      create: {
        grade,
        title: `Grade ${grade} Entrance Test`,
        description: `Entrance assessment for Grade ${grade} applicants.`,
        timeLimitSec: 900,
        isActive: true,
      },
    });

    // Only seed questions if this test has none yet (avoid duplicates on re-run).
    const existing = await prisma.question.count({ where: { testId: test.id } });
    if (existing === 0) {
      const questions = sampleQuestionsForGrade(grade);
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await prisma.question.create({
          data: {
            testId: test.id,
            text: q.text,
            order: i,
            source: q.source,
            options: { create: q.options },
          },
        });
      }
      console.log(`✓ Grade ${grade}: seeded ${questions.length} questions`);
    } else {
      console.log(`• Grade ${grade}: ${existing} questions already exist, skipped`);
    }
  }

  console.log("\nSeeding complete. ✅");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
