import * as XLSX from "xlsx";

/**
 * Reading and writing the Excel files the head teacher uploads and downloads.
 *
 * Uploads accept .xlsx, .xls and .csv. Header names are matched loosely
 * (case, spaces and punctuation are ignored) so "First name", "FIRST NAME"
 * and "first_name" all work.
 */

export type SheetRow = Record<string, string>;

export type ParsedSheet = {
  rows: SheetRow[];
  /** The spreadsheet row the headings were found on (1-based). */
  headerRow: number;
  /** The spreadsheet row the first student sits on. */
  firstDataRow: number;
  sheetName: string;
  /** The headings as written in the file, for the upload report. */
  columns: string[];
};

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * Words that mark a row as the heading row. Real sheets often start with a
 * title, a blank line or a school logo, so the headings are rarely on row 1.
 */
const HEADER_WORDS = [
  "firstname",
  "lastname",
  "surname",
  "fullname",
  "name",
  "uid",
  "studentid",
  "grade",
  "class",
  "classname",
  "group",
  "groupq1",
  "sateng",
  "satenglish",
  "satmath",
  "teacher",
  "day",
  "period",
  "slot",
  "room",
  "subject",
];

function headerScore(cells: string[]): number {
  let score = 0;
  for (const cell of cells) {
    const key = normalizeKey(cell);
    if (!key) continue;
    if (HEADER_WORDS.includes(key)) score += 2;
    else if (HEADER_WORDS.some((word) => key.includes(word))) score += 1;
  }
  return score;
}

/** Repeated headings become Group, Group_1, Group_2 — as Excel itself does. */
function uniqueKeys(cells: string[]): string[] {
  const seen = new Map<string, number>();
  return cells.map((cell) => {
    const base = cell.trim();
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return count === 0 ? base : `${base}_${count}`;
  });
}

function rowIsEmpty(cells: string[]): boolean {
  return cells.every((cell) => String(cell ?? "").trim() === "");
}

/**
 * Reads an uploaded file into rows keyed by heading name.
 *
 * Every sheet in the workbook is considered, and in each one the first 20
 * rows are checked for the one that actually holds the column headings, so a
 * title row, a blank row or a second sheet does not break the upload.
 */
export function parseSheet(buffer: ArrayBuffer): ParsedSheet {
  const workbook = XLSX.read(buffer, { type: "array" });

  let best: ParsedSheet | null = null;
  let bestScore = -1;

  for (const sheetName of workbook.SheetNames) {
    const grid = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[sheetName], {
      header: 1,
      defval: "",
      raw: false,
      blankrows: true,
    });
    if (grid.length === 0) continue;

    let headerIndex = -1;
    let headerPoints = 0;
    const limit = Math.min(grid.length, 20);
    for (let i = 0; i < limit; i++) {
      const points = headerScore((grid[i] ?? []).map(String));
      if (points > headerPoints) {
        headerPoints = points;
        headerIndex = i;
      }
    }
    // Nothing recognisable: fall back to the first row with content.
    if (headerIndex === -1) {
      headerIndex = grid.findIndex((row) => !rowIsEmpty((row ?? []).map(String)));
      if (headerIndex === -1) continue;
    }

    const headerCells = (grid[headerIndex] ?? []).map((cell) => String(cell ?? "").trim());
    const keys = uniqueKeys(headerCells);

    const rows: SheetRow[] = [];
    const rowNumbers: number[] = [];
    for (let i = headerIndex + 1; i < grid.length; i++) {
      const cells = (grid[i] ?? []).map((cell) => String(cell ?? "").trim());
      if (rowIsEmpty(cells)) continue;
      // A repeated heading row (page breaks in a long list) is not data.
      if (headerScore(cells) >= headerPoints && headerPoints > 0) continue;

      const row: SheetRow = {};
      keys.forEach((key, column) => {
        if (!key) return;
        row[normalizeKey(key)] = cells[column] ?? "";
      });
      row.__row = String(i + 1); // the spreadsheet's own row number
      rows.push(row);
      rowNumbers.push(i + 1);
    }

    const score = headerPoints * 100 + rows.length;
    if (score > bestScore) {
      bestScore = score;
      best = {
        rows,
        headerRow: headerIndex + 1,
        firstDataRow: rowNumbers[0] ?? headerIndex + 2,
        sheetName,
        columns: headerCells.filter(Boolean),
      };
    }
  }

  return (
    best ?? { rows: [], headerRow: 0, firstDataRow: 0, sheetName: "", columns: [] }
  );
}

/** The spreadsheet row a parsed row came from, for error messages. */
export function rowNumberOf(row: SheetRow, fallback: number): number {
  const value = Number(row.__row);
  return Number.isFinite(value) && value > 0 ? value : fallback;
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
    headers: [
      "№",
      "First Name",
      "Last Name",
      "UID",
      "Grade",
      "Class Name",
      "Group | Q1",
      "SAT Eng",
      "SAT Math",
    ],
    sample: [
      [1, "Abdulhamid", "Axramov", "", 10, "10 - Stanford", "11-E1", "SAT - E2", "SAT - M2"],
      [2, "Mushtariybonu", "Karimova", "", 11, "11 - Yale", "11-E1", "", ""],
      [3, "Munisa", "Karimova", "", 5, "5 - Tokyo", "5-E1", "", ""],
      [4, "Durbek", "Karimov", "", 7, "7 - Sydney", "7-E1", "", ""],
    ] as Array<Array<string | number>>,
  },
  groups: {
    fileName: "sodiq-groups-template.xlsx",
    sheetName: "Groups",
    headers: ["Group", "Teacher", "Room"],
    sample: [
      ["5-E1", "Nika", "201"],
      ["5-E2", "Izzat", "202"],
      ["SAT - E1", "Khafizulloh", "305"],
      ["SAT - M1", "Muhammaddiyor", "306"],
    ] as Array<Array<string | number>>,
  },
  timetable: {
    fileName: "sodiq-timetable-template.xlsx",
    sheetName: "Timetable",
    headers: ["Group", "Day", "Period", "Teacher", "Room"],
    sample: [
      ["5-E1", "Monday", 1, "Nika", "201"],
      ["5-E1", "Monday", 2, "Nika", "201"],
      ["5-E1", "Wednesday", 6, "Nika", "201"],
    ] as Array<Array<string | number>>,
  },
} as const;

export type TemplateName = keyof typeof TEMPLATES;

export function isTemplateName(value: unknown): value is TemplateName {
  return typeof value === "string" && value in TEMPLATES;
}
