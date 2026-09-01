import type { CourseExtraction } from "../schema";
import type { SyllabusUploadMetadata } from "./models";

export type ImportSyllabusRpcArgs = {
  p_user_id: string;
  p_file_name: string;
  p_file_size: number;
  p_storage_key: string | null;
  p_file_sha256: string | null;
  p_extraction: CourseExtraction;
};

export interface ImportSyllabusRpcClient {
  rpc(
    functionName: "import_syllabus",
    args: ImportSyllabusRpcArgs,
  ): PromiseLike<{
    data: unknown;
    error: { code?: string; message: string } | null;
  }>;
}

export class SyllabusPersistenceError extends Error {
  readonly code = "IMPORT_TRANSACTION_FAILED";

  constructor(options?: ErrorOptions) {
    super("The syllabus could not be saved.", options);
    this.name = "SyllabusPersistenceError";
  }
}

export interface PersistSyllabusImportInput {
  userId: string;
  upload: SyllabusUploadMetadata;
  extraction: CourseExtraction;
}

export async function persistSyllabusImport(
  client: ImportSyllabusRpcClient,
  input: PersistSyllabusImportInput,
): Promise<{ courseId: string }> {
  const { data, error } = await client.rpc("import_syllabus", {
    p_user_id: input.userId,
    p_file_name: input.upload.name,
    p_file_size: input.upload.size,
    p_storage_key: input.upload.storageKey ?? null,
    p_file_sha256: input.upload.sha256 ?? null,
    p_extraction: input.extraction,
  });

  if (error || typeof data !== "string" || data.length === 0) {
    throw new SyllabusPersistenceError({ cause: error ?? data });
  }

  return { courseId: data };
}
