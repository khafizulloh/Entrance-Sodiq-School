import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, requireHead } from "@/lib/attendance/auth";

const schema = z.object({
  fullName: z.string().trim().min(2).optional(),
  loginId: z
    .string()
    .trim()
    .min(3)
    .regex(/^[a-zA-Z0-9._-]+$/)
    .optional(),
  password: z.string().min(6, "Password must be at least 6 characters.").optional(),
  role: z.enum(["teacher", "head"]).optional(),
  isActive: z.boolean().optional(),
  telegramId: z.string().trim().max(32).nullable().optional(),
});

/** Change a staff member's name, login id, password or role. No 2-step checks. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireHead();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const staff = await prisma.staff.findUnique({ where: { id } });
  if (!staff) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  const data: Record<string, unknown> = {};
  if (parsed.data.fullName) data.fullName = parsed.data.fullName;
  if (parsed.data.role) data.role = parsed.data.role;
  if (parsed.data.isActive !== undefined) data.isActive = parsed.data.isActive;
  if (parsed.data.telegramId !== undefined) data.telegramId = parsed.data.telegramId || null;
  if (parsed.data.password) data.passwordHash = await hashPassword(parsed.data.password);

  if (parsed.data.loginId) {
    const loginId = parsed.data.loginId.toLowerCase();
    if (loginId !== staff.loginId) {
      const taken = await prisma.staff.findUnique({ where: { loginId } });
      if (taken) {
        return NextResponse.json(
          { error: `Login id "${loginId}" is already used.` },
          { status: 409 },
        );
      }
      data.loginId = loginId;
    }
  }

  // Never leave the school without a head teacher who can sign in.
  if (
    (parsed.data.role === "teacher" || parsed.data.isActive === false) &&
    staff.role === "head"
  ) {
    const otherHeads = await prisma.staff.count({
      where: { role: "head", isActive: true, id: { not: id } },
    });
    if (otherHeads === 0) {
      return NextResponse.json(
        { error: "This is the only active head teacher account." },
        { status: 400 },
      );
    }
  }

  const updated = await prisma.staff.update({
    where: { id },
    data,
    select: { id: true, loginId: true, fullName: true, role: true, isActive: true },
  });

  return NextResponse.json({ ok: true, staff: updated });
}
