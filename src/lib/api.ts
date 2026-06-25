import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./auth";

/**
 * Helper for API route handlers: ensures the caller has a valid admin session.
 * Returns the session, or a 401 NextResponse to return early.
 */
export async function requireAdmin(): Promise<
  { session: SessionPayload } | { response: NextResponse }
> {
  const session = await getSession();
  if (!session) {
    return {
      response: NextResponse.json(
        { error: "Unauthorized. Please log in." },
        { status: 401 },
      ),
    };
  }
  return { session };
}

/** Standard JSON error response. */
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
