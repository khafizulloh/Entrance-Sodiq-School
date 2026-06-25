import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jsonError } from "@/lib/api";
import { loginSchema } from "@/lib/validation";
import { verifyPassword, createSessionToken, setSessionCookie } from "@/lib/auth";

/** POST /api/admin/login — authenticate an admin and set the session cookie. */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.");
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message ?? "Invalid input.");
  }
  const { email, password } = parsed.data;

  const user = await prisma.adminUser.findUnique({ where: { email } });
  // Always run a comparison-like delay to avoid leaking whether email exists.
  const ok = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !ok) {
    return jsonError("Invalid email or password.", 401);
  }

  const token = await createSessionToken({
    sub: user.id,
    email: user.email,
    name: user.name,
  });
  await setSessionCookie(token);

  return NextResponse.json({ name: user.name, email: user.email });
}
