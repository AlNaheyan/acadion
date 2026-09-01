export const DEFAULT_MAX_PDF_BYTES = 10 * 1024 * 1024;

export type PdfUploadErrorCode =
  | "EMPTY_FILE"
  | "FILE_TOO_LARGE"
  | "INVALID_FILE_TYPE"
  | "INVALID_PDF_SIGNATURE";

export class PdfUploadError extends Error {
  constructor(
    public readonly code: PdfUploadErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfUploadError";
  }
}

export interface PdfUpload {
  name: string;
  type: string;
  size: number;
  slice(start?: number, end?: number): Blob;
}

export interface ValidatePdfUploadOptions {
  maxBytes?: number;
}

const pdfSignature = "%PDF-";

export async function validatePdfUpload(
  file: PdfUpload,
  options: ValidatePdfUploadOptions = {},
): Promise<void> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_PDF_BYTES;

  if (file.size === 0) {
    throw new PdfUploadError("EMPTY_FILE", "The uploaded PDF is empty.");
  }

  if (file.size > maxBytes) {
    throw new PdfUploadError(
      "FILE_TOO_LARGE",
      `The uploaded PDF exceeds the ${Math.floor(maxBytes / 1024 / 1024)} MB limit.`,
    );
  }

  if (file.type.toLowerCase() !== "application/pdf" || !file.name.toLowerCase().endsWith(".pdf")) {
    throw new PdfUploadError(
      "INVALID_FILE_TYPE",
      "Please upload a PDF file.",
    );
  }

  const header = await file.slice(0, pdfSignature.length).arrayBuffer();
  const signature = new TextDecoder("ascii").decode(header);

  if (signature !== pdfSignature) {
    throw new PdfUploadError(
      "INVALID_PDF_SIGNATURE",
      "The uploaded file does not contain a valid PDF signature.",
    );
  }
}
