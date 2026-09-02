import type { ImportedSyllabusResponse } from "./upload-state";
import {
  classifyAssessmentExports,
  countExportableMeetings,
} from "./calendar-export";

export interface ConfirmationGroup {
  label: string;
  count: number;
  ariaLabel: string;
}

export interface CalendarExportConfirmationData {
  meetingCount: number;
  assessmentGroups: ConfirmationGroup[];
  excluded: Array<{ id: string; title: string; reason: string }>;
}

export function buildCalendarExportConfirmation(
  result: ImportedSyllabusResponse,
): CalendarExportConfirmationData {
  const classified = classifyAssessmentExports(
    result.assessments,
    result.warnings,
  );
  const counts = new Map<string, number>();

  for (const assessment of classified.included) {
    const label =
      assessment.type === "homework"
        ? "Homework"
        : assessment.type === "quiz"
          ? "Quizzes"
          : assessment.type === "midterm"
            ? "Midterms"
            : assessment.type === "exam" || assessment.type === "final_exam"
              ? "Exams & finals"
              : "Other dated items";
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const assessmentGroups = [
    "Homework",
    "Quizzes",
    "Midterms",
    "Exams & finals",
    "Other dated items",
  ]
    .filter((label) => counts.has(label))
    .map((label) => {
      const count = counts.get(label) ?? 0;
      return {
        label,
        count,
        ariaLabel: `${count} ${label.toLowerCase()} included`,
      };
    });

  return {
    meetingCount: countExportableMeetings(result.meetings),
    assessmentGroups,
    excluded: classified.excluded.map(({ assessment, reason }) => ({
      id: assessment.id,
      title: assessment.title,
      reason,
    })),
  };
}
