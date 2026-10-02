import { NextResponse } from "next/server";
import { getStaffSession } from "@/lib/attendance/auth";

export async function GET() {
  const session = await getStaffSession();
  if (!session) return NextResponse.json({ session: null }, { status: 401 });
  return NextResponse.json({ session });
}
