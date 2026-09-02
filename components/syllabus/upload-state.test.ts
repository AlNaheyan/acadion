import { describe, expect, it, vi } from "vitest";

import {
  importSyllabus,
  MAX_SYLLABUS_BYTES,
  syllabusUploadReducer,
  SyllabusUploadClientError,
  validateSelectedSyllabus,
  type ImportedSyllabusResponse,
  type UploadState,
} from "./upload-state";

const result: ImportedSyllabusResponse = {
  course_id: "course_123",
  course: {
    name: "Microeconomics",
    code: "ECO 20250",
    section: null,
    semester: "Fall 2026",
    instructor: null,
  },
  meetings: [],
  assessments: [],
  warnings: [],
};

describe("syllabusUploadReducer", () => {
  it("moves through upload, extraction, success, and reset states", () => {
    let state: UploadState = { phase: "idle" };
    state = syllabusUploadReducer(state, { type: "START", fileName: "syllabus.pdf" });
    expect(state).toEqual({ phase: "uploading", fileName: "syllabus.pdf" });
    state = syllabusUploadReducer(state, { type: "EXTRACTING" });
    expect(state).toEqual({ phase: "extracting", fileName: "syllabus.pdf" });
    state = syllabusUploadReducer(state, { type: "SUCCESS", result });
    expect(state).toEqual({ phase: "success", result });
    expect(syllabusUploadReducer(state, { type: "RESET" })).toEqual({ phase: "idle" });
  });

  it("keeps a stable public error state", () => {
    expect(
      syllabusUploadReducer(
        { phase: "extracting", fileName: "syllabus.pdf" },
        { type: "ERROR", code: "UNSUPPORTED_DOCUMENT", message: "Use a text-based PDF." },
      ),
    ).toEqual({
      phase: "error",
      code: "UNSUPPORTED_DOCUMENT",
      message: "Use a text-based PDF.",
    });
  });
});

describe("validateSelectedSyllabus", () => {
  it("accepts a non-empty PDF", () => {
    expect(() =>
      validateSelectedSyllabus(
        new File(["%PDF-1.7"], "syllabus.pdf", { type: "application/pdf" }),
      ),
    ).not.toThrow();
  });

  it.each([
    [new File([], "empty.pdf", { type: "application/pdf" }), "EMPTY_FILE"],
    [
      new File([new Uint8Array(MAX_SYLLABUS_BYTES + 1)], "large.pdf", {
        type: "application/pdf",
      }),
      "FILE_TOO_LARGE",
    ],
    [new File(["text"], "syllabus.txt", { type: "text/plain" }), "INVALID_FILE_TYPE"],
  ])("rejects invalid client selection %#", (file, code) => {
    expect(() => validateSelectedSyllabus(file)).toThrowError(
      expect.objectContaining({ code }),
    );
  });
});

describe("importSyllabus", () => {
  const file = new File(["%PDF-1.7"], "syllabus.pdf", {
    type: "application/pdf",
  });

  it("posts multipart data and returns the import contract", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(result), {
        status: 201,
        headers: { "content-type": "application/json" },
      }),
    );

    await expect(importSyllabus(file, fetcher)).resolves.toEqual(result);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/courses/import",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );
  });

  it("preserves stable API error details", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "UNSUPPORTED_DOCUMENT", message: "Use a text-based PDF." },
        }),
        { status: 422 },
      ),
    );

    await expect(importSyllabus(file, fetcher)).rejects.toEqual(
      new SyllabusUploadClientError(
        "UNSUPPORTED_DOCUMENT",
        "Use a text-based PDF.",
      ),
    );
  });
});
