import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireHead } from "@/lib/attendance/auth";

const schema = z.object({
  fullName: z.string().trim().min(2, "Enter the teacher's full name."),
  loginId: z
    .string()
    .trim()
    .min(3, "Login id must be at least 3 characters.")
    .regex(/^[a-zA-Z0-9._-]+$/, "Login id can use letters, numbers, dot, dash and underscore."),
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(["teacher", "head"]).default("teacher"),
  telegramId: z.string().trim().max(32).optional().nullable(),
});

/** Create a teacher (or another head teacher) account. */
export async function POST(req: Request) {
  const auth = await requireHead();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const loginId = parsed.data.loginId.toLowerCase();
  const taken = await prisma.staff.findUnique({ where: { loginId } });
  if (taken) {
    return NextResponse.json(
      { error: `Login id "${loginId}" is already used.` },
      { status: 409 },
    );
  }

  const staff = await prisma.staff.create({
    data: {
      loginId,
      fullName: parsed.data.fullName,
      passwordHash: await hashPassword(parsed.data.password),
      role: parsed.data.role,
      telegramId: parsed.data.telegramId || null,
    },
    select: { id: true, loginId: true, fullName: true, role: true },
  });

  return NextResponse.json({ ok: true, staff });
}

export async function GET() {
  const auth = await requireHead();
  if (!auth.ok) return auth.response;

  const staff = await prisma.staff.findMany({
    orderBy: [{ role: "asc" }, { fullName: "asc" }],
    select: {
      id: true,
      loginId: true,
      fullName: true,
      role: true,
      isActive: true,
      _count: { select: { groups: true } },
    },
  });
  return NextResponse.json({ staff });
}
