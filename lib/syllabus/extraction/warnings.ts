import type { CourseExtraction, ExtractionWarning } from "../schema";

const warningTypeByStatus = {
  TBD: "TBD",
  missing: "missing",
  ambiguous: "ambiguous",
} as const;

function messageFor(
  title: string,
  status: keyof typeof warningTypeByStatus,
): string {
  if (status === "TBD") return `${title} has a date marked TBD.`;
  if (status === "missing") return `${title} does not have a date.`;
  return `${title} has an ambiguous date that requires review.`;
}

function hasMatchingWarning(
  warnings: ExtractionWarning[],
  candidate: ExtractionWarning,
): boolean {
  return warnings.some(
    (warning) =>
      warning.type === candidate.type &&
      warning.assessment_id === candidate.assessment_id,
  );
}

export function deriveExtractionWarnings(
  extraction: CourseExtraction,
): CourseExtraction {
  const warnings = [...extraction.metadata.warnings];

  for (const assessment of extraction.assessments) {
    if (assessment.date_status === "confirmed") continue;

    const candidate: ExtractionWarning = {
      type: warningTypeByStatus[assessment.date_status],
      message: messageFor(assessment.title, assessment.date_status),
      assessment_id: assessment.id,
      source: assessment.source,
    };

    if (!hasMatchingWarning(warnings, candidate)) warnings.push(candidate);
  }

  return {
    ...extraction,
    metadata: {
      ...extraction.metadata,
      extraction_status:
        extraction.metadata.extraction_status === "success" && warnings.length > 0
          ? "partial"
          : extraction.metadata.extraction_status,
      warnings,
    },
  };
}
