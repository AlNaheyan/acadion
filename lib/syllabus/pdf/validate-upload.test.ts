import { describe, expect, it } from "vitest";

import {
  DEFAULT_MAX_PDF_BYTES,
  PdfUploadError,
  validatePdfUpload,
  type PdfUpload,
} from "./validate-upload";

function upload(
  content: string,
  overrides: Partial<PdfUpload> = {},
): PdfUpload {
  const blob = new Blob([content], { type: "application/pdf" });

  return {
    name: "syllabus.pdf",
    type: "application/pdf",
    size: blob.size,
    slice: (start, end) => blob.slice(start, end),
    ...overrides,
  };
}

async function expectCode(file: PdfUpload, code: string): Promise<void> {
  try {
    await validatePdfUpload(file);
    throw new Error("Expected validation to fail");
  } catch (error) {
    expect(error).toBeInstanceOf(PdfUploadError);
    expect((error as PdfUploadError).code).toBe(code);
  }
}

describe("validatePdfUpload", () => {
  it("accepts a PDF with matching metadata and signature", async () => {
    await expect(validatePdfUpload(upload("%PDF-1.7\ncontent"))).resolves.toBeUndefined();
  });

  it("accepts an uppercase PDF extension", async () => {
    await expect(
      validatePdfUpload(upload("%PDF-1.7", { name: "SYLLABUS.PDF" })),
    ).resolves.toBeUndefined();
  });

  it("rejects an empty upload", async () => {
    await expectCode(upload(""), "EMPTY_FILE");
  });

  it("rejects an oversized upload before reading it", async () => {
    await expectCode(
      upload("%PDF-", { size: DEFAULT_MAX_PDF_BYTES + 1 }),
      "FILE_TOO_LARGE",
    );
  });

  it.each([
    { overrides: { type: "text/plain" }, label: "wrong MIME type" },
    { overrides: { name: "syllabus.txt" }, label: "wrong extension" },
  ])("rejects a PDF with $label", async ({ overrides }) => {
    await expectCode(upload("%PDF-1.7", overrides), "INVALID_FILE_TYPE");
  });

  it("rejects spoofed PDF metadata", async () => {
    await expectCode(upload("plain text syllabus"), "INVALID_PDF_SIGNATURE");
  });

  it("supports a caller-defined size limit", async () => {
    await expect(
      validatePdfUpload(upload("%PDF-1.7"), { maxBytes: 5 }),
    ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });
});
