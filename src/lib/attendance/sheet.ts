import * as XLSX from "xlsx";

/**
 * Reading and writing the Excel files the head teacher uploads and downloads.
 *
 * Uploads accept .xlsx, .xls and .csv. Header names are matched loosely
 * (case, spaces and punctuation are ignored) so "First name", "FIRST NAME"
 * and "first_name" all work.
 */

export type SheetRow = Record<string, string>;

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Parse an uploaded file into rows keyed by normalized header name. */
export function parseSheet(buffer: ArrayBuffer): SheetRow[] {
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    workbook.Sheets[sheetName],
    { defval: "", raw: false },
  );

  return raw.map((row) => {
    const out: SheetRow = {};
    for (const [key, value] of Object.entries(row)) {
      out[normalizeKey(key)] = String(value ?? "").trim();
    }
    return out;
  });
}

/** First non-empty value among several possible column names. */
export function pick(row: SheetRow, ...names: string[]): string {
  for (const name of names) {
    const value = row[normalizeKey(name)];
    if (value) return value;
  }
  return "";
}

export function pickInt(row: SheetRow, ...names: string[]): number | null {
  const value = pick(row, ...names);
  if (!value) return null;
  const digits = value.match(/-?\d+/);
  if (!digits) return null;
  const parsed = Number(digits[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

const DAY_WORDS: Record<string, number> = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
};

/** "Monday", "Mon", "1" -> 1 ... 5. Returns null for anything else. */
export function parseDay(value: string): number | null {
  const text = value.trim().toLowerCase();
  if (!text) return null;
  if (DAY_WORDS[text]) return DAY_WORDS[text];
  const asNumber = Number(text);
  if (asNumber >= 1 && asNumber <= 5) return asNumber;
  return null;
}

/**
 * Splits a full name into first name + surname.
 * "Ali Karimov" -> { firstName: "Ali", lastName: "Karimov" }
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

/** Build an .xlsx file (as bytes) from a header row + data rows. */
export function buildWorkbook(
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): Uint8Array {
  const data = [headers, ...rows];
  const sheet = XLSX.utils.aoa_to_sheet(data);
  sheet["!cols"] = headers.map((header) => ({ wch: Math.max(14, header.length + 4) }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, sheetName.slice(0, 31));
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" }) as Uint8Array;
}

export const TEMPLATES = {
  students: {
    fileName: "sodiq-students-template.xlsx",
    sheetName: "Students",
    headers: ["First Name", "Surname", "Grade", "Group", "Student ID"],
    sample: [
      ["Ali", "Karimov", 5, "5 TOKYO", "S-0001"],
      ["Nodira", "Yusupova", 5, "5 LONDON", "S-0002"],
      ["Sardor", "Qosimov", 10, "10 OXFORD", "S-0003"],
    ] as Array<Array<string | number>>,
  },
  groups: {
    fileName: "sodiq-groups-template.xlsx",
    sheetName: "Groups",
    headers: ["Group Name", "Grade", "Subject", "Teacher Login ID", "Teacher Full Name", "Room"],
    sample: [
      ["5 TOKYO", 5, "English", "nigina", "Tuxtasinova Nigina", "201"],
      ["10 OXFORD", 10, "SAT Math", "umarjon", "Baxtiyorov Umarjon", "305"],
    ] as Array<Array<string | number>>,
  },
  timetable: {
    fileName: "sodiq-timetable-template.xlsx",
    sheetName: "Timetable",
    headers: ["Group Name", "Day", "Period", "Subject", "Teacher Login ID", "Room"],
    sample: [
      ["5 TOKYO", "Monday", 1, "English", "nigina", "201"],
      ["5 TOKYO", "Monday", 2, "English", "nigina", "201"],
      ["5 TOKYO", "Wednesday", 6, "English", "nigina", "201"],
    ] as Array<Array<string | number>>,
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export function isTemplateName(value: unknown): value is TemplateName {
  return typeof value === "string" && value in TEMPLATES;
}
