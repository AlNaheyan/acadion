import type { CourseExtraction, ExtractionWarning } from "../schema";

export interface ImportedCourseRow {
  id: string;
  user_id: string;
  code: string | null;
  name: string | null;
  section: string | null;
  semester: string | null;
  instructor: string | null;
  extraction_status: "success" | "partial" | "failed";
  extraction_warnings: ExtractionWarning[];
  created_at: string;
  updated_at: string;
}

export type ImportedCourseInsert = Omit<
  ImportedCourseRow,
  "id" | "created_at" | "updated_at"
>;

export function courseExtractionToInsert(
  userId: string,
  extraction: CourseExtraction,
): ImportedCourseInsert {
  return {
    user_id: userId,
    ...extraction.course,
    extraction_status: extraction.metadata.extraction_status,
    extraction_warnings: extraction.metadata.warnings,
  };
}
