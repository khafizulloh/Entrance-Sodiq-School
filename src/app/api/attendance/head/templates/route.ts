import { NextResponse } from "next/server";
import { requireHead } from "@/lib/attendance/auth";
import { TEMPLATES, buildWorkbook, isTemplateName } from "@/lib/attendance/sheet";

/** Download the Excel template for an upload: ?type=students|groups|timetable */
export async function GET(req: Request) {
  const auth = await requireHead();
  if (!auth.ok) return auth.response;

  const type = new URL(req.url).searchParams.get("type");
  if (!isTemplateName(type)) {
    return NextResponse.json({ error: "Unknown template." }, { status: 400 });
  }

  const template = TEMPLATES[type];
  const bytes = buildWorkbook(template.sheetName, [...template.headers], [
    ...template.sample,
  ]);

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${template.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
