import {
  validatePdfTextQuality,
  type PdfPageText,
  type PdfTextQualityOptions,
} from "../pdf";
import type { CourseExtraction } from "../schema";
import { validateCourseExtraction, type ValidationIssue } from "../validate";
import {
  requestStructuredSyllabusExtraction,
  type StructuredExtractionOptions,
} from "./gemini";
import { verifyAssessmentEvidence } from "./evidence";
import { deriveExtractionWarnings } from "./warnings";
import { buildSyllabusExtractionPrompt, type SyllabusExtractionPrompt } from "./prompt";

export type SyllabusExtractionServiceErrorCode =
  | "INVALID_DOCUMENT_TEXT"
  | "INVALID_MODEL_OUTPUT";

export class SyllabusExtractionServiceError extends Error {
  constructor(
    public readonly code: SyllabusExtractionServiceErrorCode,
    message: string,
    public readonly issues: ValidationIssue[] = [],
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SyllabusExtractionServiceError";
  }
}

export interface ExtractSyllabusOptions extends StructuredExtractionOptions {
  quality?: PdfTextQualityOptions;
  extractStructured?: (
    prompt: SyllabusExtractionPrompt,
  ) => Promise<unknown>;
}

export async function extractSyllabus(
  pages: PdfPageText[],
  options: ExtractSyllabusOptions = {},
): Promise<CourseExtraction> {
  try {
    validatePdfTextQuality(pages, options.quality);
  } catch (error) {
    throw new SyllabusExtractionServiceError(
      "INVALID_DOCUMENT_TEXT",
      error instanceof Error ? error.message : "The PDF text is not usable.",
      [],
      { cause: error },
    );
  }

  const prompt = buildSyllabusExtractionPrompt(pages);
  const output = options.extractStructured
    ? await options.extractStructured(prompt)
    : await requestStructuredSyllabusExtraction(prompt, options);
  const validation = validateCourseExtraction(output);

  if (!validation.success) {
    throw new SyllabusExtractionServiceError(
      "INVALID_MODEL_OUTPUT",
      "The extracted syllabus data did not match the required format.",
      validation.issues,
    );
  }

  return deriveExtractionWarnings(
    verifyAssessmentEvidence(validation.data, pages),
  );
}
