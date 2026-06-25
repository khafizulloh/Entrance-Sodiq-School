import { z } from "zod";
import { GRADES } from "./levels";

/**
 * Shared Zod schemas used for both client-side and server-side validation.
 */

const gradeSchema = z
  .number({ invalid_type_error: "Please select a grade." })
  .refine((g) => (GRADES as readonly number[]).includes(g), {
    message: "Invalid grade.",
  });

// Personal info form submitted before the test starts.
export const studentInfoSchema = z.object({
  fullName: z.string().trim().min(2, "Full name is required."),
  phone: z
    .string()
    .trim()
    .min(7, "A valid phone number is required.")
    .max(20, "Phone number is too long."),
  parentPhone: z
    .string()
    .trim()
    .min(7, "A valid parent phone number is required.")
    .max(20, "Phone number is too long."),
  grade: gradeSchema,
  previousSchool: z.string().trim().max(200).optional().or(z.literal("")),
  branch: z.string().trim().max(100).optional().or(z.literal("")),
  telegram: z.string().trim().max(100).optional().or(z.literal("")),
  dateOfBirth: z.string().trim().optional().or(z.literal("")),
});

export type StudentInfo = z.infer<typeof studentInfoSchema>;

// A single answer: question id -> selected option id (option may be null if skipped).
export const answerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionId: z.string().min(1).nullable(),
});

// Full test submission payload.
export const submissionSchema = z.object({
  student: studentInfoSchema,
  testId: z.string().min(1, "Missing test."),
  answers: z.array(answerSchema).min(1, "No answers provided."),
  durationSec: z.number().int().min(0).default(0),
});

export type SubmissionPayload = z.infer<typeof submissionSchema>;

// Admin login.
export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email."),
  password: z.string().min(1, "Password is required."),
});

// Admin question create/update payload.
export const optionInputSchema = z.object({
  label: z.enum(["A", "B", "C", "D"]),
  text: z.string().trim().min(1, "Option text is required."),
  isCorrect: z.boolean(),
});

export const questionInputSchema = z
  .object({
    testId: z.string().min(1, "Test is required."),
    text: z.string().trim().min(1, "Question text is required."),
    order: z.number().int().min(0).default(0),
    options: z
      .array(optionInputSchema)
      .length(4, "Each question must have exactly 4 options (A, B, C, D)."),
  })
  .refine((q) => q.options.filter((o) => o.isCorrect).length === 1, {
    message: "Exactly one option must be marked correct.",
    path: ["options"],
  });

// Admin test (settings) update payload.
export const testInputSchema = z.object({
  grade: gradeSchema,
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  timeLimitSec: z.number().int().min(30, "Minimum 30 seconds.").max(36000),
  isActive: z.boolean(),
});
