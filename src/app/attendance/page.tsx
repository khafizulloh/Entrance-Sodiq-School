import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/attendance/auth";

/** Sends each signed-in user to their own dashboard. */
export default async function AttendanceHome() {
  const session = await getStaffSession();
  if (!session) redirect("/attendance/login");
  redirect(session.role === "head" ? "/attendance/head" : "/attendance/teacher");
}
