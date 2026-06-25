import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin, jsonError } from "@/lib/api";

/**
 * PATCH /api/admin/tests/[id]
 * Update a test's settings: title, description, timeLimitSec, isActive.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdmin();
  if ("response" in auth) return auth.response;
  const { id } = await params;

  let body: {
    title?: string;
    description?: string | null;
    timeLimitSec?: number;
    isActive?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.");
  }

  const data: Record<string, unknown> = {};
  if (typeof body.title === "string" && body.title.trim())
    data.title = body.title.trim();
  if ("description" in body)
    data.description = body.description?.toString().trim() || null;
  if (typeof body.timeLimitSec === "number") {
    if (body.timeLimitSec < 30 || body.timeLimitSec > 36000)
      return jsonError("Time limit must be between 30 and 36000 seconds.");
    data.timeLimitSec = Math.round(body.timeLimitSec);
  }
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;

  if (Object.keys(data).length === 0)
    return jsonError("No valid fields to update.");

  const updated = await prisma.test.update({ where: { id }, data });
  return NextResponse.json(updated);
}
