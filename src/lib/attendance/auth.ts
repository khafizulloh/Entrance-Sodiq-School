import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

/**
 * Staff authentication for the attendance tracker.
 *
 * Teachers and the head teacher log in with a short login id + password
 * (no email, no two-step verification — the head teacher resets credentials
 * directly). The session is a signed JWT in an httpOnly cookie.
 */

export const STAFF_COOKIE_NAME = "sodiq_staff_session";
const SESSION_DURATION_SEC = 60 * 60 * 12; // one school day

export type StaffRole = "teacher" | "head";

export type StaffSession = {
  sub: string; // staff id
  loginId: string;
  name: string;
  role: StaffRole;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET environment variable is not set.");
  return new TextEncoder().encode(secret);
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createStaffToken(payload: StaffSession): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SEC}s`)
    .sign(getSecret());
}

export async function verifyStaffToken(token: string): Promise<StaffSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    const role = payload.role === "head" ? "head" : "teacher";
    return {
      sub: String(payload.sub),
      loginId: String(payload.loginId),
      name: String(payload.name),
      role,
    };
  } catch {
    return null;
  }
}

export async function setStaffCookie(token: string) {
  const store = await cookies();
  store.set(STAFF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SEC,
  });
}

export async function clearStaffCookie() {
  const store = await cookies();
  store.delete(STAFF_COOKIE_NAME);
}

/** The signed-in staff member, or null. */
export async function getStaffSession(): Promise<StaffSession | null> {
  const store = await cookies();
  const token = store.get(STAFF_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyStaffToken(token);
}

/** Session or a 401 — for use inside route handlers. */
export async function requireStaff(): Promise<
  { ok: true; session: StaffSession } | { ok: false; response: Response }
> {
  const session = await getStaffSession();
  if (!session) {
    return {
      ok: false,
      response: Response.json({ error: "Not signed in." }, { status: 401 }),
    };
  }
  return { ok: true, session };
}

/** Head-teacher-only session or a 401/403. */
export async function requireHead(): Promise<
  { ok: true; session: StaffSession } | { ok: false; response: Response }
> {
  const result = await requireStaff();
  if (!result.ok) return result;
  if (result.session.role !== "head") {
    return {
      ok: false,
      response: Response.json(
        { error: "Head teacher access only." },
        { status: 403 },
      ),
    };
  }
  return result;
}
