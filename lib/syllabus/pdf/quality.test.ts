import { describe, expect, it } from "vitest";

import type { PdfPageText } from "./extract";
import { PdfTextQualityError, validatePdfTextQuality } from "./quality";

function pages(...texts: string[]): PdfPageText[] {
  return texts.map((text, index) => ({ page: index + 1, text, items: [] }));
}

function expectQualityCode(input: PdfPageText[], code: string): void {
  try {
    validatePdfTextQuality(input);
    throw new Error("Expected quality validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PdfTextQualityError);
    expect((error as PdfTextQualityError).code).toBe(code);
  }
}

describe("validatePdfTextQuality", () => {
  it("accepts ordinary multi-page syllabus text and returns metrics", () => {
    const quality = validatePdfTextQuality(
      pages(
        "ECO 20250 Intermediate Microeconomics. Instructor Matthew Nagler. Classes meet every Thursday from 11:00 AM until 12:15 PM in NAC 1/203.",
        "Homework assignments are due weekly. Midterm Exam 1 is October 1 and covers chapters one through four.",
      ),
    );

    expect(quality).toMatchObject({
      page_count: 2,
      pages_with_text: 2,
    });
    expect(quality.character_count).toBeGreaterThan(100);
    expect(quality.word_count).toBeGreaterThan(15);
    expect(quality.readable_character_ratio).toBe(1);
  });

  it.each([
    [[], "UNSUPPORTED_SCANNED_DOCUMENT"],
    [pages("", "   \n\t"), "UNSUPPORTED_SCANNED_DOCUMENT"],
  ])("rejects documents without extractable text", (input, code) => {
    expectQualityCode(input as PdfPageText[], code as string);
  });

  it("rejects extremely short extraction", () => {
    expectQualityCode(pages("Course syllabus"), "INSUFFICIENT_TEXT");
  });

  it("rejects extraction dominated by corrupted characters", () => {
    expectQualityCode(
      pages(`Course syllabus ${"\u0000�".repeat(100)}`),
      "BROKEN_TEXT_EXTRACTION",
    );
  });

  it("supports explicit thresholds for controlled fixtures", () => {
    expect(
      validatePdfTextQuality(pages("Short valid fixture"), {
        minimumCharacters: 10,
        minimumWords: 3,
      }),
    ).toMatchObject({ character_count: 19, word_count: 3 });
  });

  it("bounds pages and extracted characters before model submission", () => {
    expect(() => validatePdfTextQuality(pages("valid text ".repeat(20), "more text ".repeat(20)), { maximumPages: 1 })).toThrow("too many pages");
    expect(() => validatePdfTextQuality(pages("valid text ".repeat(20)), { maximumCharacters: 50 })).toThrow("too much text");
  });
});
