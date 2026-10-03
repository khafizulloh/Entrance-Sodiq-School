import { NextResponse } from "next/server";
import { clearStaffCookie } from "@/lib/attendance/auth";

export async function POST() {
  await clearStaffCookie();
  return NextResponse.json({ ok: true });
}

/**
 * Visiting this clears the cookie and goes to the sign-in page.
 *
 * Pages send a session whose account no longer exists here rather than
 * straight to the login page: the cookie is still correctly signed, so the
 * middleware would send it back again and the two would bounce forever.
 */
export async function GET(req: Request) {
  await clearStaffCookie();
  return NextResponse.redirect(new URL("/attendance/login", req.url));
}
