import { describe, expect, it, vi } from "vitest";

import type { CourseExtraction } from "../schema";
import {
  persistSyllabusImport,
  SyllabusPersistenceError,
  type ImportSyllabusRpcClient,
} from "./import";

const extraction: CourseExtraction = {
  course: { code: "ECO 20250", name: null, section: null, semester: null, instructor: null },
  meetings: [],
  assessments: [],
  assessment_rules: [],
  metadata: { source_type: "syllabus", extraction_status: "success", warnings: [] },
};

describe("persistSyllabusImport", () => {
  it("sends the entire canonical import through one RPC call", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "1aa20b60-3f63-4d56-b685-568b7028fcf4",
      error: null,
    });
    const client = { rpc } as ImportSyllabusRpcClient;

    await expect(
      persistSyllabusImport(client, {
        userId: "user_123",
        upload: {
          name: "syllabus.pdf",
          size: 2048,
          storageKey: "user_123/file.pdf",
          sha256: "a".repeat(64),
        },
        extraction,
      }),
    ).resolves.toEqual({ courseId: "1aa20b60-3f63-4d56-b685-568b7028fcf4" });

    expect(rpc).toHaveBeenCalledWith("import_syllabus", {
      p_user_id: "user_123",
      p_file_name: "syllabus.pdf",
      p_file_size: 2048,
      p_storage_key: "user_123/file.pdf",
      p_file_sha256: "a".repeat(64),
      p_extraction: extraction,
    });
  });

  it("maps database failures to a stable safe error", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({
        data: null,
        error: { code: "23514", message: "sensitive database details" },
      }),
    } as ImportSyllabusRpcClient;

    try {
      await persistSyllabusImport(client, {
        userId: "user_123",
        upload: { name: "syllabus.pdf", size: 2048 },
        extraction,
      });
      throw new Error("Expected persistence failure");
    } catch (error) {
      expect(error).toBeInstanceOf(SyllabusPersistenceError);
      expect(error).toMatchObject({
        code: "IMPORT_TRANSACTION_FAILED",
        message: "The syllabus could not be saved.",
      });
      expect((error as Error).message).not.toContain("sensitive database details");
    }
  });

  it("rejects a missing course ID even when RPC reports no error", async () => {
    const client = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    } as ImportSyllabusRpcClient;

    await expect(
      persistSyllabusImport(client, {
        userId: "user_123",
        upload: { name: "syllabus.pdf", size: 2048 },
        extraction,
      }),
    ).rejects.toMatchObject({ code: "IMPORT_TRANSACTION_FAILED" });
  });
});
