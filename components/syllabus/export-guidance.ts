import type { ImportedSyllabusResponse } from "./upload-state";
import {
  countAssessmentExports,
  countExportableMeetings,
} from "./calendar-export";

export type ExportGuidanceCode =
  | "NO_MEETINGS"
  | "INCOMPLETE_MEETINGS"
  | "NO_ASSESSMENTS"
  | "NO_CONFIRMED_ASSESSMENTS";

export interface ExportGuidance {
  code: ExportGuidanceCode;
  title: string;
  message: string;
}

export function getCalendarExportGuidance(
  result: ImportedSyllabusResponse,
): ExportGuidance[] {
  const guidance: ExportGuidance[] = [];
  const meetingCount = countExportableMeetings(result.meetings);
  const assessmentCounts = countAssessmentExports(
    result.assessments,
    result.warnings,
  );

  if (result.meetings.length === 0) {
    guidance.push({
      code: "NO_MEETINGS",
      title: "No class meetings were found",
      message:
        "Review the syllabus for a meeting schedule or import an updated text-based PDF.",
    });
  } else if (meetingCount === 0) {
    guidance.push({
      code: "INCOMPLETE_MEETINGS",
      title: "Class meetings need more information",
      message:
        "A start time, end time, start date, and end date are required before exporting the class schedule.",
    });
  }

  if (result.assessments.length === 0) {
    guidance.push({
      code: "NO_ASSESSMENTS",
      title: "No assignments or exams were found",
      message:
        "Review the extracted dates or import a syllabus that includes the assessment schedule.",
    });
  } else if (assessmentCounts.included === 0) {
    guidance.push({
      code: "NO_CONFIRMED_ASSESSMENTS",
      title: "No confirmed assessment dates are ready",
      message:
        "Review the excluded items above. TBD, missing, ambiguous, conflicting, or unverified dates cannot be exported.",
    });
  }

  return guidance;
}
