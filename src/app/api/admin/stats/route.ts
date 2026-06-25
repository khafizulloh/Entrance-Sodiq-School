import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api";
import { getDashboardStats } from "@/lib/stats";

/** GET /api/admin/stats — dashboard statistics. */
export async function GET() {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;

  const stats = await getDashboardStats();
  return NextResponse.json(stats);
}
