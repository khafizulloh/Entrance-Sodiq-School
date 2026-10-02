import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  createStaffToken,
  setStaffCookie,
  verifyPassword,
} from "@/lib/attendance/auth";

const schema = z.object({
  loginId: z.string().trim().min(1, "Enter your login id."),
  password: z.string().min(1, "Enter your password."),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request." },
      { status: 400 },
    );
  }

  const loginId = parsed.data.loginId.toLowerCase();
  const staff = await prisma.staff.findUnique({ where: { loginId } });

  // Same message for a wrong id and a wrong password.
  const invalid = NextResponse.json(
    { error: "Wrong login id or password." },
    { status: 401 },
  );
  if (!staff || !staff.isActive) return invalid;

  const ok = await verifyPassword(parsed.data.password, staff.passwordHash);
  if (!ok) return invalid;

  const role = staff.role === "head" ? "head" : "teacher";
  const token = await createStaffToken({
    sub: staff.id,
    loginId: staff.loginId,
    name: staff.fullName,
    role,
  });
  await setStaffCookie(token);

  return NextResponse.json({
    ok: true,
    role,
    name: staff.fullName,
    redirectTo: role === "head" ? "/attendance/head" : "/attendance/teacher",
  });
}
