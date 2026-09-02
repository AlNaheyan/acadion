import type {
  Assessment,
  Course,
  ExtractionWarning,
  Meeting,
} from "../../lib/syllabus";

export const MAX_SYLLABUS_BYTES = 10 * 1024 * 1024;

export interface ImportedSyllabusResponse {
  course_id: string;
  course: Course;
  meetings: Meeting[];
  assessments: Assessment[];
  warnings: ExtractionWarning[];
}

export type UploadState =
  | { phase: "idle" }
  | { phase: "uploading"; fileName: string }
  | { phase: "extracting"; fileName: string }
  | { phase: "success"; result: ImportedSyllabusResponse }
  | { phase: "error"; code: string; message: string };

export type UploadAction =
  | { type: "START"; fileName: string }
  | { type: "EXTRACTING" }
  | { type: "SUCCESS"; result: ImportedSyllabusResponse }
  | { type: "ERROR"; code: string; message: string }
  | { type: "RESET" };

export function syllabusUploadReducer(
  state: UploadState,
  action: UploadAction,
): UploadState {
  switch (action.type) {
    case "START":
      return { phase: "uploading", fileName: action.fileName };
    case "EXTRACTING":
      return state.phase === "uploading"
        ? { phase: "extracting", fileName: state.fileName }
        : state;
    case "SUCCESS":
      return { phase: "success", result: action.result };
    case "ERROR":
      return { phase: "error", code: action.code, message: action.message };
    case "RESET":
      return { phase: "idle" };
  }
}

export class SyllabusUploadClientError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "SyllabusUploadClientError";
  }
}

export function validateSelectedSyllabus(file: File): void {
  if (file.size === 0) {
    throw new SyllabusUploadClientError("EMPTY_FILE", "Choose a PDF that is not empty.");
  }
  if (file.size > MAX_SYLLABUS_BYTES) {
    throw new SyllabusUploadClientError(
      "FILE_TOO_LARGE",
      "Choose a syllabus PDF smaller than 10 MB.",
    );
  }
  if (file.type !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new SyllabusUploadClientError(
      "INVALID_FILE_TYPE",
      "Choose a syllabus in PDF format.",
    );
  }
}

export async function importSyllabus(
  file: File,
  fetcher: typeof fetch = fetch,
): Promise<ImportedSyllabusResponse> {
  validateSelectedSyllabus(file);
  const body = new FormData();
  body.append("file", file);

  const response = await fetcher("/api/courses/import", {
    method: "POST",
    body,
  });
  const payload = (await response.json()) as {
    error?: { code?: string; message?: string };
  } & Partial<ImportedSyllabusResponse>;

  if (!response.ok) {
    throw new SyllabusUploadClientError(
      payload.error?.code ?? "IMPORT_FAILED",
      payload.error?.message ?? "The syllabus could not be imported.",
    );
  }

  if (!payload.course_id || !payload.course) {
    throw new SyllabusUploadClientError(
      "INVALID_RESPONSE",
      "The imported course response was incomplete.",
    );
  }

  return payload as ImportedSyllabusResponse;
}
