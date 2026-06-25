/**
 * Placement-level logic and grade helpers shared across the app.
 */

// The grades that have their own test.
export const GRADES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11] as const;
export type Grade = (typeof GRADES)[number];

// Branch / study options a student can prefer.
export const BRANCHES = [
  "Main Campus",
  "City Branch",
  "Online",
] as const;

/**
 * Map a percentage score to a suggested English placement level.
 * Adjust thresholds here if the school's placement policy changes.
 */
export function getLevelFromPercentage(percentage: number): string {
  if (percentage >= 90) return "Advanced (C1)";
  if (percentage >= 75) return "Upper-Intermediate (B2)";
  if (percentage >= 60) return "Intermediate (B1)";
  if (percentage >= 40) return "Pre-Intermediate (A2)";
  if (percentage >= 20) return "Elementary (A1)";
  return "Beginner (Starter)";
}

// All possible levels, useful for admin filters and statistics.
export const LEVELS = [
  "Beginner (Starter)",
  "Elementary (A1)",
  "Pre-Intermediate (A2)",
  "Intermediate (B1)",
  "Upper-Intermediate (B2)",
  "Advanced (C1)",
] as const;
