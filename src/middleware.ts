import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Route protection for both areas of the app:
 *   /admin      — entrance-test dashboard (AdminUser session)
 *   /attendance — attendance tracker (Staff session: teacher or head teacher)
 *
 * Runs on the edge, so it only uses `jose` (no Node APIs).
 */

const ADMIN_COOKIE = "sodiq_admin_session";
const STAFF_COOKIE = "sodiq_staff_session";

async function readToken(token: string | undefined): Promise<Record<string, unknown> | null> {
  if (!token) return null;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function handleAdmin(req: NextRequest, pathname: string) {
  const payload = await readToken(req.cookies.get(ADMIN_COOKIE)?.value);
  const isLoginPage = pathname === "/admin/login";

  if (isLoginPage && payload) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  if (!isLoginPage && !payload) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

async function handleAttendance(req: NextRequest, pathname: string) {
  const payload = await readToken(req.cookies.get(STAFF_COOKIE)?.value);
  const role = payload?.role === "head" ? "head" : payload ? "teacher" : null;
  const isLoginPage = pathname === "/attendance/login";

  if (isLoginPage) {
    if (!role) return NextResponse.next();
    const home = role === "head" ? "/attendance/head" : "/attendance/teacher";
    return NextResponse.redirect(new URL(home, req.url));
  }

  if (!role) {
    const url = new URL("/attendance/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Head-teacher pages are off limits to teachers.
  if (pathname.startsWith("/attendance/head") && role !== "head") {
    return NextResponse.redirect(new URL("/attendance/teacher", req.url));
  }

  return NextResponse.next();
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/attendance")) return handleAttendance(req, pathname);
  return handleAdmin(req, pathname);
}

export const config = {
  // API routes do their own auth checks.
  matcher: ["/admin/:path*", "/attendance/:path*"],
};
