import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * Protects all /admin routes (except /admin/login) by checking for a valid
 * session JWT. Runs on the edge, so it only uses `jose` (no Node APIs).
 */

const SESSION_COOKIE_NAME = "sodiq_admin_session";

async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;
  try {
    await jwtVerify(token, new TextEncoder().encode(secret));
    return true;
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const valid = await isValidSession(token);

  const isLoginPage = pathname === "/admin/login";

  // Logged-in users visiting the login page go straight to the dashboard.
  if (isLoginPage && valid) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }

  // Unauthenticated users trying to reach any other admin page get redirected.
  if (!isLoginPage && !valid) {
    const url = new URL("/admin/login", req.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Run on all /admin pages. API routes do their own auth checks.
  matcher: ["/admin/:path*"],
};
