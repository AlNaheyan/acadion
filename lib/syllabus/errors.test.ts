import { describe, expect, it } from "vitest";

import {
  StructuredExtractionError,
  SyllabusExtractionServiceError,
} from "./extraction";
import { mapSyllabusImportError } from "./errors";
import { PdfExtractionError, PdfUploadError } from "./pdf";
import { SyllabusPersistenceError } from "./persistence";

describe("mapSyllabusImportError", () => {
  it.each([
    [new PdfUploadError("EMPTY_FILE", "private syllabus text"), 400, "EMPTY_FILE"],
    [new PdfUploadError("FILE_TOO_LARGE", "private syllabus text"), 413, "FILE_TOO_LARGE"],
    [new PdfUploadError("INVALID_FILE_TYPE", "private syllabus text"), 400, "INVALID_FILE_TYPE"],
    [new PdfUploadError("INVALID_PDF_SIGNATURE", "private syllabus text"), 400, "INVALID_PDF_SIGNATURE"],
    [new PdfExtractionError("private syllabus text"), 422, "PDF_EXTRACTION_FAILED"],
    [
      new SyllabusExtractionServiceError(
        "INVALID_DOCUMENT_TEXT",
        "private syllabus text",
      ),
      422,
      "UNSUPPORTED_DOCUMENT",
    ],
    [
      new SyllabusExtractionServiceError(
        "INVALID_MODEL_OUTPUT",
        "private provider output",
        [{ path: "course.name", message: "private provider output" }],
      ),
      502,
      "MODEL_OUTPUT_INVALID",
    ],
    [
      new StructuredExtractionError("MISSING_API_KEY", "private config"),
      503,
      "EXTRACTION_NOT_CONFIGURED",
    ],
    [
      new StructuredExtractionError("NO_STRUCTURED_OUTPUT", "private provider output"),
      502,
      "MODEL_OUTPUT_MISSING",
    ],
    [
      new StructuredExtractionError("PROVIDER_FAILURE", "private provider output"),
      502,
      "EXTRACTION_PROVIDER_FAILED",
    ],
    [new SyllabusPersistenceError({ cause: "private database error" }), 503, "PERSISTENCE_FAILED"],
    [new Error("private internal error"), 500, "IMPORT_FAILED"],
  ])("maps %# to a safe response", (error, status, code) => {
    const mapped = mapSyllabusImportError(error);
    const serialized = JSON.stringify(mapped);

    expect(mapped).toMatchObject({
      status,
      body: { error: { code } },
    });
    expect(serialized).not.toContain("private");
    expect(serialized).not.toContain("course.name");
  });
});
