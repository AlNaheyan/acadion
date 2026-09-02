import type { PdfPageText } from "./extract";

export type PdfTextQualityErrorCode =
  | "UNSUPPORTED_SCANNED_DOCUMENT"
  | "INSUFFICIENT_TEXT"
  | "BROKEN_TEXT_EXTRACTION";

export class PdfTextQualityError extends Error {
  constructor(
    public readonly code: PdfTextQualityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfTextQualityError";
  }
}

export interface PdfTextQualityOptions {
  minimumCharacters?: number;
  minimumWords?: number;
  minimumReadableRatio?: number;
  maximumPages?: number;
  maximumCharacters?: number;
}

export interface PdfTextQuality {
  page_count: number;
  pages_with_text: number;
  character_count: number;
  word_count: number;
  readable_character_ratio: number;
}

const defaultOptions: Required<PdfTextQualityOptions> = {
  minimumCharacters: 100,
  minimumWords: 15,
  minimumReadableRatio: 0.7,
  maximumPages: 100,
  maximumCharacters: 500_000,
};

export function validatePdfTextQuality(
  pages: PdfPageText[],
  options: PdfTextQualityOptions = {},
): PdfTextQuality {
  const thresholds = { ...defaultOptions, ...options };
  const pageTexts = pages.map((page) => page.text.trim());
  if (pages.length > thresholds.maximumPages) {
    throw new PdfTextQualityError("BROKEN_TEXT_EXTRACTION", "The PDF has too many pages to process safely.");
  }
  const combined = pageTexts.filter(Boolean).join("\n");

  if (!combined) {
    throw new PdfTextQualityError(
      "UNSUPPORTED_SCANNED_DOCUMENT",
      "This PDF does not contain extractable text. Please upload a text-based syllabus PDF.",
    );
  }

  const characters = Array.from(combined);
  const readableCharacters = characters.filter(
    (character) => /[\p{L}\p{N}\p{P}\p{Z}\n\t]/u.test(character) && character !== "�",
  ).length;
  const words = combined.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? [];
  const quality: PdfTextQuality = {
    page_count: pages.length,
    pages_with_text: pageTexts.filter(Boolean).length,
    character_count: characters.length,
    word_count: words.length,
    readable_character_ratio: readableCharacters / characters.length,
  };
  if (quality.character_count > thresholds.maximumCharacters) {
    throw new PdfTextQualityError("BROKEN_TEXT_EXTRACTION", "The PDF contains too much text to process safely.");
  }

  if (quality.readable_character_ratio < thresholds.minimumReadableRatio) {
    throw new PdfTextQualityError(
      "BROKEN_TEXT_EXTRACTION",
      "The PDF text could not be read reliably. Please use a text-based syllabus PDF.",
    );
  }

  if (
    quality.character_count < thresholds.minimumCharacters ||
    quality.word_count < thresholds.minimumWords
  ) {
    throw new PdfTextQualityError(
      "INSUFFICIENT_TEXT",
      "The PDF does not contain enough readable syllabus text.",
    );
  }

  return quality;
}
