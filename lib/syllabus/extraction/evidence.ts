import type { PdfPageText } from "../pdf";
import type { CourseExtraction, SourceEvidence } from "../schema";

export const DEFAULT_MAX_EVIDENCE_LENGTH = 300;

function comparable(value: string): string {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase();
}

function verifyEvidence(
  source: SourceEvidence | null,
  pages: PdfPageText[],
  maxLength: number,
): SourceEvidence | null {
  if (!source || (!source.page && !source.text)) return null;

  const text = source.text?.trim().slice(0, maxLength) ?? null;
  if (!text) {
    return source.page && pages.some((page) => page.page === source.page)
      ? { page: source.page, text: null }
      : null;
  }

  const needle = comparable(text);
  const matchingPages = pages.filter((page) => comparable(page.text).includes(needle));

  if (source.page) {
    const claimedPage = pages.find((page) => page.page === source.page);
    if (!claimedPage || !comparable(claimedPage.text).includes(needle)) return null;
    return { page: source.page, text };
  }

  return matchingPages.length > 0
    ? { page: matchingPages[0].page, text }
    : null;
}

export function verifyAssessmentEvidence(
  extraction: CourseExtraction,
  pages: PdfPageText[],
  maxLength = DEFAULT_MAX_EVIDENCE_LENGTH,
): CourseExtraction {
  const evidenceWarnings = [...extraction.metadata.warnings];
  const assessments = extraction.assessments.map((assessment) => {
    const source = verifyEvidence(assessment.source, pages, maxLength);

    if (!source) {
      evidenceWarnings.push({
        type: "source_mismatch",
        message: assessment.source
          ? `Source evidence for ${assessment.title} could not be verified.`
          : `No source evidence was provided for ${assessment.title}.`,
        assessment_id: assessment.id,
        source: null,
      });
    }

    return { ...assessment, source };
  });

  return {
    ...extraction,
    assessments,
    metadata: {
      ...extraction.metadata,
      warnings: evidenceWarnings,
    },
  };
}
