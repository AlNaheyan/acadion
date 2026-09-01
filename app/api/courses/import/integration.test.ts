import { describe, expect, it, vi } from "vitest";

import {
  extractPdfText,
  extractSyllabus,
  persistSyllabusImport,
  StructuredExtractionError,
  validatePdfUpload,
  type CourseExtraction,
  type ImportSyllabusRpcClient,
  type SyllabusExtractionPrompt,
} from "../../../../lib/syllabus";
import {
  handleCourseImport,
  type ImportCourseDependencies,
} from "./handler";

function createTextPdf(text: string): Uint8Array {
  const escaped = text
    .replaceAll("\\", "\\\\")
    .replaceAll("(", "\\(")
    .replaceAll(")", "\\)");
  const stream = `BT /F1 6 Tf 72 720 Td (${escaped}) Tj ET`;
  const objects = [
    "",
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.7\n";
  const offsets = [0];

  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = pdf.length;
    pdf += `${id} 0 obj\n${objects[id]}\nendobj\n`;
  }

  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
  for (let id = 1; id < objects.length; id += 1) {
    pdf += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return new TextEncoder().encode(pdf);
}

function uploadRequest(text: string): Request {
  const formData = new FormData();
  formData.append(
    "file",
    new Blob([createTextPdf(text)], { type: "application/pdf" }),
    "syllabus.pdf",
  );
  return new Request("http://localhost/api/courses/import", {
    method: "POST",
    body: formData,
  });
}

const modelOutput: CourseExtraction = {
  course: {
    name: "Microeconomics",
    code: "ECO 20250",
    section: "01",
    semester: "Fall 2026",
    instructor: "Dr. Rivera",
  },
  meetings: [],
  assessments: [
    {
      id: "final-exam",
      type: "final_exam",
      title: "Final Exam",
      release_date: null,
      due_date: null,
      date: null,
      due_time: null,
      start_time: null,
      end_time: null,
      location: null,
      coverage: null,
      date_status: "TBD",
      raw_date_text: "TBD",
      source: { page: 1, text: "Final exam date TBD" },
    },
  ],
  assessment_rules: [],
  metadata: {
    source_type: "syllabus",
    extraction_status: "success",
    warnings: [],
  },
};

function rpcClient(result: { data: unknown; error: { message: string } | null }) {
  return {
    rpc: vi.fn().mockResolvedValue(result),
  } as unknown as ImportSyllabusRpcClient;
}

function dependencies(
  client: ImportSyllabusRpcClient,
  model: (prompt: SyllabusExtractionPrompt) => Promise<unknown> = async () =>
    modelOutput,
): ImportCourseDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue("user_123"),
    validateUpload: validatePdfUpload,
    extractText: extractPdfText,
    extractStructured: (pages) => extractSyllabus(pages, { extractStructured: model }),
    persist: persistSyllabusImport,
    persistenceClient: () => client,
  };
}

const readableSyllabus =
  "ECO 20250 Microeconomics Fall 2026 with Dr. Rivera. Final exam date TBD. This course meets throughout the semester and includes lectures assignments quizzes review sessions readings projects and office hours for all enrolled students.";

describe("syllabus import integration", () => {
  it("runs upload through normalized warning response and atomic persistence", async () => {
    const client = rpcClient({ data: "course_123", error: null });
    const response = await handleCourseImport(
      uploadRequest(readableSyllabus),
      dependencies(client),
    );
    const body = await response.json();

    expect(body).toMatchObject({
      course_id: "course_123",
      course: { code: "ECO 20250" },
      assessments: [{ id: "final-exam", date_status: "TBD" }],
      warnings: [
        {
          type: "TBD",
          assessment_id: "final-exam",
          source: { page: 1, text: "Final exam date TBD" },
        },
      ],
    });
    expect(response.status).toBe(201);
    expect(client.rpc).toHaveBeenCalledWith(
      "import_syllabus",
      expect.objectContaining({
        p_user_id: "user_123",
        p_file_name: "syllabus.pdf",
        p_extraction: expect.objectContaining({
          metadata: expect.objectContaining({ extraction_status: "partial" }),
        }),
      }),
    );
  });

  it("rejects a text-free PDF before calling the model or database", async () => {
    const client = rpcClient({ data: "unused", error: null });
    const model = vi.fn().mockResolvedValue(modelOutput);
    const response = await handleCourseImport(
      uploadRequest(""),
      dependencies(client, model),
    );

    const body = await response.json();
    expect(body).toMatchObject({
      error: { code: "UNSUPPORTED_DOCUMENT" },
    });
    expect(response.status).toBe(422);
    expect(model).not.toHaveBeenCalled();
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns the safe provider error without attempting persistence", async () => {
    const client = rpcClient({ data: "unused", error: null });
    const response = await handleCourseImport(
      uploadRequest(readableSyllabus),
      dependencies(client, async () => {
        throw new StructuredExtractionError(
          "PROVIDER_FAILURE",
          "private Gemini response",
        );
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toMatchObject({
      error: { code: "EXTRACTION_PROVIDER_FAILED" },
    });
    expect(JSON.stringify(body)).not.toContain("private Gemini response");
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("returns the safe persistence error after successful extraction", async () => {
    const client = rpcClient({
      data: null,
      error: { message: "private Supabase response" },
    });
    const response = await handleCourseImport(
      uploadRequest(readableSyllabus),
      dependencies(client),
    );
    const body = await response.json();

    expect(body).toMatchObject({ error: { code: "PERSISTENCE_FAILED" } });
    expect(response.status).toBe(503);
    expect(JSON.stringify(body)).not.toContain("private Supabase response");
  });
});
