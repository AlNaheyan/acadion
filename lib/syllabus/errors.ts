import {
  StructuredExtractionError,
  SyllabusExtractionServiceError,
} from "./extraction";
import { PdfExtractionError, PdfUploadError } from "./pdf";
import { SyllabusPersistenceError } from "./persistence";

export interface SyllabusImportErrorBody {
  error: {
    code: string;
    message: string;
  };
}

export interface SyllabusImportErrorResponse {
  status: number;
  body: SyllabusImportErrorBody;
}

const uploadMessages: Record<PdfUploadError["code"], string> = {
  EMPTY_FILE: "The uploaded PDF is empty.",
  FILE_TOO_LARGE: "The uploaded PDF is too large.",
  INVALID_FILE_TYPE: "Please upload a PDF file.",
  INVALID_PDF_SIGNATURE: "The uploaded file is not a valid PDF.",
};

function response(
  status: number,
  code: string,
  message: string,
): SyllabusImportErrorResponse {
  return { status, body: { error: { code, message } } };
}

export function mapSyllabusImportError(
  error: unknown,
): SyllabusImportErrorResponse {
  if (error instanceof PdfUploadError) {
    return response(
      error.code === "FILE_TOO_LARGE" ? 413 : 400,
      error.code,
      uploadMessages[error.code],
    );
  }

  if (error instanceof PdfExtractionError) {
    return response(
      422,
      "PDF_EXTRACTION_FAILED",
      "The PDF text could not be extracted.",
    );
  }

  if (error instanceof SyllabusExtractionServiceError) {
    if (error.code === "INVALID_DOCUMENT_TEXT") {
      return response(
        422,
        "UNSUPPORTED_DOCUMENT",
        "Please upload a readable text-based syllabus PDF.",
      );
    }

    return response(
      502,
      "MODEL_OUTPUT_INVALID",
      "The syllabus could not be converted into valid course data.",
    );
  }

  if (error instanceof StructuredExtractionError) {
    if (error.code === "MISSING_API_KEY") {
      return response(
        503,
        "EXTRACTION_NOT_CONFIGURED",
        "Syllabus extraction is temporarily unavailable.",
      );
    }

    return response(
      502,
      error.code === "NO_STRUCTURED_OUTPUT"
        ? "MODEL_OUTPUT_MISSING"
        : "EXTRACTION_PROVIDER_FAILED",
      "Syllabus extraction is temporarily unavailable.",
    );
  }

  if (error instanceof SyllabusPersistenceError) {
    return response(
      503,
      "PERSISTENCE_FAILED",
      "The extracted syllabus could not be saved.",
    );
  }

  return response(
    500,
    "IMPORT_FAILED",
    "The syllabus could not be imported.",
  );
}
