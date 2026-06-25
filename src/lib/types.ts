/** Client-facing shapes (no correct answers included). */

export type ClientOption = {
  id: string;
  label: string;
  text: string;
};

export type ClientQuestion = {
  id: string;
  text: string;
  options: ClientOption[];
};

export type ClientTest = {
  id: string;
  grade: number;
  title: string;
  description: string | null;
  timeLimitSec: number;
  questions: ClientQuestion[];
};

export type TestResult = {
  submissionId: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  level: string;
};
