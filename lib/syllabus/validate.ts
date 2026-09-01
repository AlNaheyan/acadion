import { courseExtractionSchema, type CourseExtraction } from "./schema";

export interface ValidationIssue {
  path: string;
  message: string;
}

export type CourseExtractionValidationResult =
  | { success: true; data: CourseExtraction }
  | { success: false; issues: ValidationIssue[] };

export function validateCourseExtraction(
  input: unknown,
): CourseExtractionValidationResult {
  const result = courseExtractionSchema.safeParse(input);

  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
