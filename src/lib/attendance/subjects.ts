/** Subjects taught in the groups tracked by the attendance app. */

export const SUBJECTS = [
  "ENGLISH",
  "IELTS",
  "SPEAKING",
  "SAT_ENGLISH",
  "SAT_MATH",
] as const;

export type Subject = (typeof SUBJECTS)[number];

const LABELS: Record<string, string> = {
  ENGLISH: "English",
  IELTS: "IELTS",
  SPEAKING: "Speaking",
  SAT_ENGLISH: "SAT English",
  SAT_MATH: "SAT Math",
};

export function subjectLabel(subject: string): string {
  return LABELS[subject] ?? subject;
}

/** Accepts free text from an uploaded sheet ("sat math", "IELTS") -> code. */
export function normalizeSubject(value: unknown): Subject {
  const text = String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!text) return "ENGLISH";
  if (text.includes("MATH")) return "SAT_MATH";
  if (text.includes("SAT")) return "SAT_ENGLISH";
  if (text.includes("IELTS")) return "IELTS";
  if (text.includes("SPEAK")) return "SPEAKING";
  return "ENGLISH";
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
