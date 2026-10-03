/**
 * The three tracks a student can be taught in.
 *
 * General English covers IELTS too — a student takes one or the other, never
 * both, so they share one column on the student list and one set of groups.
 * SAT English and SAT Math are separate and optional.
 *
 * A student always has a General English group, and may also have a SAT
 * English group, a SAT Math group, or both.
 */

export const SUBJECTS = ["GENERAL_ENGLISH", "SAT_ENGLISH", "SAT_MATH"] as const;

export type Subject = (typeof SUBJECTS)[number];

const LABELS: Record<string, string> = {
  GENERAL_ENGLISH: "General English",
  SAT_ENGLISH: "SAT English",
  SAT_MATH: "SAT Math",
  // Older records, kept so nothing shows a raw code.
  ENGLISH: "General English",
  IELTS: "General English",
  SPEAKING: "General English",
};

const SHORT_LABELS: Record<string, string> = {
  GENERAL_ENGLISH: "Gen Eng",
  SAT_ENGLISH: "SAT Eng",
  SAT_MATH: "SAT Math",
};

export function subjectLabel(subject: string): string {
  return LABELS[subject] ?? subject;
}

export function subjectShortLabel(subject: string): string {
  return SHORT_LABELS[subject] ?? subjectLabel(subject);
}

/** Accepts free text from a sheet ("SAT Eng", "IELTS", "sat math") -> code. */
export function normalizeSubject(value: unknown): Subject {
  const text = String(value ?? "").toUpperCase();
  const compact = text.replace(/[^A-Z0-9]/g, "");
  if (!compact) return "GENERAL_ENGLISH";
  if (compact.includes("MATH") || /^SATM\d*$/.test(compact)) return "SAT_MATH";
  if (compact.includes("SAT")) return "SAT_ENGLISH";
  return "GENERAL_ENGLISH";
}

/**
 * Works out a group's track and grade band from its name, the way the school
 * writes them:
 *   "5-E1"    -> General English, band 5 (grades 5 and 6 study together)
 *   "11-E3"   -> General English, band 11 (grades 10 and 11 together)
 *   "SAT - E2" -> SAT English
 *   "SAT - M1" -> SAT Math
 *
 * The band is what decides which groups a student can be moved between.
 */
export const SAT_BAND = 11;

export function parseGroupName(name: string): { subject: Subject; grade: number } {
  const compact = name.toUpperCase().replace(/[^A-Z0-9]/g, "");

  if (/^SATM\d*$/.test(compact)) return { subject: "SAT_MATH", grade: SAT_BAND };
  if (/^SATE?\d*$/.test(compact)) return { subject: "SAT_ENGLISH", grade: SAT_BAND };
  if (compact.includes("MATH")) return { subject: "SAT_MATH", grade: SAT_BAND };
  if (compact.startsWith("SAT")) return { subject: "SAT_ENGLISH", grade: SAT_BAND };

  const band = Number(name.match(/\d+/)?.[0] ?? NaN);
  return {
    subject: "GENERAL_ENGLISH",
    grade: Number.isFinite(band) ? band : 0,
  };
}

/** "Grades 5–6", "Grades 10–11", "Grade 7" — how a band reads to a person. */
export function bandLabel(subject: string, grade: number): string {
  if (subject === "SAT_ENGLISH" || subject === "SAT_MATH") return "Grades 10–11";
  if (grade === 5) return "Grades 5–6";
  if (grade === 11 || grade === 10) return "Grades 10–11";
  return `Grade ${grade}`;
}

export const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const STATUS_SHORT: Record<AttendanceStatus, string> = {
  PRESENT: "P",
  ABSENT: "A",
  LATE: "L",
};

export const STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  ABSENT: "Absent",
  LATE: "Late",
};

/** Statuses that count against a pupil in the "missing most classes" report. */
export const MISSED_STATUSES: AttendanceStatus[] = ["ABSENT"];

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.includes(value as AttendanceStatus);
}
