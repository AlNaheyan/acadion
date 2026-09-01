import { describe, expect, it, vi } from "vitest";

import type {
  CourseExtraction,
  ImportSyllabusRpcClient,
} from "../../../../lib/syllabus";
import { PdfUploadError } from "../../../../lib/syllabus";
import {
  handleCourseImport,
  type ImportCourseDependencies,
} from "./handler";

const extraction: CourseExtraction = {
  course: {
    name: "Microeconomics",
    code: "ECO 20250",
    section: "01",
    semester: "Fall 2026",
    instructor: "Dr. Rivera",
  },
  meetings: [],
  assessments: [],
  assessment_rules: [],
  metadata: {
    source_type: "syllabus",
    extraction_status: "success",
    warnings: [],
  },
};

function uploadRequest(): Request {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob(["%PDF-1.7 syllabus"], { type: "application/pdf" }),
    "syllabus.pdf",
  );
  return new Request("http://localhost/api/courses/import", {
    method: "POST",
    body: formData,
  });
}

function dependencies(
  overrides: Partial<ImportCourseDependencies> = {},
): ImportCourseDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue("user_123"),
    validateUpload: vi.fn().mockResolvedValue(undefined),
    extractText: vi.fn().mockResolvedValue([
      { page: 1, text: "Course syllabus", items: [] },
    ]),
    extractStructured: vi.fn().mockResolvedValue(extraction),
    persist: vi.fn().mockResolvedValue({ courseId: "course_123" }),
    persistenceClient: vi
      .fn()
      .mockReturnValue({} as ImportSyllabusRpcClient),
    ...overrides,
  };
}

describe("POST /api/courses/import", () => {
  it("requires authentication before parsing the upload", async () => {
    const deps = dependencies({
      authenticate: vi.fn().mockResolvedValue(null),
    });

    const response = await handleCourseImport(uploadRequest(), deps);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication is required.",
      },
    });
    expect(deps.validateUpload).not.toHaveBeenCalled();
  });

  it("validates, extracts, and atomically persists a syllabus", async () => {
    const deps = dependencies();

    const response = await handleCourseImport(uploadRequest(), deps);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      course_id: "course_123",
      course: extraction.course,
      meetings: [],
      assessments: [],
      warnings: [],
    });
    expect(deps.validateUpload).toHaveBeenCalledOnce();
    expect(deps.extractText).toHaveBeenCalledOnce();
    expect(deps.extractStructured).toHaveBeenCalledOnce();
    expect(deps.persist).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user_123",
        upload: expect.objectContaining({
          name: "syllabus.pdf",
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        }),
        extraction,
      }),
    );
  });

  it("rejects a request without a file", async () => {
    const deps = dependencies();
    const response = await handleCourseImport(
      new Request("http://localhost/api/courses/import", {
        method: "POST",
        body: new FormData(),
      }),
      deps,
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_UPLOAD" },
    });
    expect(deps.extractText).not.toHaveBeenCalled();
  });

  it("returns a stable safe error when upload validation fails", async () => {
    const deps = dependencies({
      validateUpload: vi.fn().mockRejectedValue(
        new PdfUploadError(
          "INVALID_PDF_SIGNATURE",
          "private contents from the uploaded syllabus",
        ),
      ),
    });

    const response = await handleCourseImport(uploadRequest(), deps);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      error: {
        code: "INVALID_PDF_SIGNATURE",
        message: "The uploaded file is not a valid PDF.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("private contents");
  });
});
