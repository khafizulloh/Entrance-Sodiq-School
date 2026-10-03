import { NextResponse } from "next/server";
import { requireHead } from "@/lib/attendance/auth";
import { absenceReport } from "@/lib/attendance/reports";
import { buildWorkbook } from "@/lib/attendance/sheet";
import { isValidIsoDate, schoolToday } from "@/lib/attendance/dates";

/** The absence report as an Excel file: ?from=&to=&grade= */
export async function GET(req: Request) {
  const auth = await requireHead();
  if (!auth.ok) return auth.response;

  const params = new URL(req.url).searchParams;
  const from = params.get("from");
  const to = params.get("to");
  const grade = Number(params.get("grade"));

  const rows = await absenceReport({
    from: isValidIsoDate(from) ? from : undefined,
    to: isValidIsoDate(to) ? to : undefined,
    grade: Number.isFinite(grade) && grade > 0 ? grade : undefined,
  });

  const bytes = buildWorkbook(
    "Absences",
    ["#", "First Name", "Surname", "Grade", "Groups", "Absent", "Late", "Lessons", "Missed %"],
    rows.map((row, index) => [
      index + 1,
      row.firstName,
      row.lastName,
      row.grade,
      row.groups.join(", "),
      row.absent,
      row.late,
      row.lessonsRecorded,
      row.missedPercent,
    ]),
  );

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="sodiq-absences-${schoolToday()}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
