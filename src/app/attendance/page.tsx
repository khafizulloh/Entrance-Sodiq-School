import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/attendance/auth";

// A cookie whose account is gone: clear it, then sign in again.
const SIGNED_OUT = "/api/attendance/auth/logout";

/** Sends each signed-in user to their own dashboard. */
export default async function AttendanceHome() {
  const session = await getStaffSession();
  if (!session) redirect(SIGNED_OUT);
  redirect(session.role === "head" ? "/attendance/head" : "/attendance/teacher");
}
