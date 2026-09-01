import { createHash } from "node:crypto";

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import {
  extractPdfText,
  extractSyllabus,
  persistSyllabusImport,
  validatePdfUpload,
  type CourseExtraction,
  type ImportSyllabusRpcClient,
  type PdfPageText,
  type PdfUpload,
} from "../../../../lib/syllabus";

export const runtime = "nodejs";

interface UploadedPdf extends PdfUpload {
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface ImportCourseDependencies {
  authenticate(): Promise<string | null>;
  validateUpload(file: PdfUpload): Promise<void>;
  extractText(data: ArrayBuffer): Promise<PdfPageText[]>;
  extractStructured(pages: PdfPageText[]): Promise<CourseExtraction>;
  persist(
    client: ImportSyllabusRpcClient,
    input: {
      userId: string;
      upload: { name: string; size: number; sha256: string };
      extraction: CourseExtraction;
    },
  ): Promise<{ courseId: string }>;
  persistenceClient(): ImportSyllabusRpcClient;
}

const defaultDependencies: ImportCourseDependencies = {
  async authenticate() {
    const { userId } = await auth();
    return userId;
  },
  validateUpload: validatePdfUpload,
  extractText: extractPdfText,
  extractStructured: extractSyllabus,
  persist: persistSyllabusImport,
  persistenceClient: createSupabaseServerClient,
};

function isUploadedPdf(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value !== "string" &&
    typeof value.name === "string" &&
    typeof value.arrayBuffer === "function"
  );
}

export async function handleCourseImport(
  request: Request,
  dependencies: ImportCourseDependencies = defaultDependencies,
): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
      { status: 401 },
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!isUploadedPdf(file)) {
      return NextResponse.json(
        { error: { code: "INVALID_UPLOAD", message: "A syllabus PDF is required." } },
        { status: 400 },
      );
    }

    const upload = file as UploadedPdf;
    await dependencies.validateUpload(upload);
    const data = await upload.arrayBuffer();
    const pages = await dependencies.extractText(data);
    const extraction = await dependencies.extractStructured(pages);
    const sha256 = createHash("sha256").update(new Uint8Array(data)).digest("hex");
    const { courseId } = await dependencies.persist(
      dependencies.persistenceClient(),
      {
        userId,
        upload: { name: upload.name, size: upload.size, sha256 },
        extraction,
      },
    );

    return NextResponse.json(
      {
        course_id: courseId,
        course: extraction.course,
        meetings: extraction.meetings,
        assessments: extraction.assessments,
        warnings: extraction.metadata.warnings,
      },
      { status: 201 },
    );
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "IMPORT_FAILED",
          message: "The syllabus could not be imported.",
        },
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  return handleCourseImport(request);
}
