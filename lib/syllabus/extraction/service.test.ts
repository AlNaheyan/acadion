import { describe, expect, it, vi } from "vitest";

import type { PdfPageText } from "../pdf";
import { extractSyllabus, SyllabusExtractionServiceError } from "./service";

const validText =
  "ECO 20250 Intermediate Microeconomics. Fall 2026. Instructor Matthew Nagler. The class meets Thursday from 11:00 AM to 12:15 PM. Midterm Exam 1 is October 1 and covers chapters one through four.";

const pages: PdfPageText[] = [{ page: 1, text: validText, items: [] }];

const validOutput = {
  course: {
    code: "ECO 20250",
    name: "Intermediate Microeconomics",
    semester: "Fall 2026",
    instructor: "Matthew Nagler",
  },
  meetings: [
    {
      days: ["THURSDAY"],
      start_time: "11:00",
      end_time: "12:15",
    },
  ],
  assessments: [
    {
      id: "midterm1",
      type: "midterm",
      title: "Midterm Exam 1",
      date: "2026-10-01",
      date_status: "confirmed",
      source: { page: 1, text: "Midterm Exam 1 is October 1" },
    },
  ],
  metadata: { extraction_status: "success" },
};

describe("extractSyllabus", () => {
  it("returns locally validated canonical data", async () => {
    const extractStructured = vi.fn().mockResolvedValue(validOutput);
    const result = await extractSyllabus(pages, { extractStructured });

    expect(extractStructured).toHaveBeenCalledOnce();
    expect(extractStructured.mock.calls[0][0].input).toContain("--- PAGE 1 ---");
    expect(result.course.code).toBe("ECO 20250");
    expect(result.course.section).toBeNull();
    expect(result.metadata.warnings).toEqual([]);
  });

  it("rejects unusable text before calling the model", async () => {
    const extractStructured = vi.fn();

    await expect(
      extractSyllabus([{ page: 1, text: "", items: [] }], { extractStructured }),
    ).rejects.toMatchObject({ code: "INVALID_DOCUMENT_TEXT" });
    expect(extractStructured).not.toHaveBeenCalled();
  });

  it("rejects malformed model output after the provider boundary", async () => {
    const extractStructured = vi.fn().mockResolvedValue({
      ...validOutput,
      assessments: [
        {
          id: "exam",
          type: "unsupported_type",
          title: "Exam",
          date: "2026-10-01",
        },
      ],
    });

    try {
      await extractSyllabus(pages, { extractStructured });
      throw new Error("Expected invalid model output");
    } catch (error) {
      expect(error).toBeInstanceOf(SyllabusExtractionServiceError);
      expect(error).toMatchObject({ code: "INVALID_MODEL_OUTPUT" });
      expect((error as SyllabusExtractionServiceError).issues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ path: "assessments.0.type" }),
        ]),
      );
    }
  });

  it("does not hide structured provider failures", async () => {
    const providerError = new Error("provider unavailable");
    const extractStructured = vi.fn().mockRejectedValue(providerError);

    await expect(extractSyllabus(pages, { extractStructured })).rejects.toBe(
      providerError,
    );
  });
});
