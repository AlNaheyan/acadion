import { describe, expect, it } from "vitest";

import type { PdfPageText } from "../pdf";
import type { CourseExtraction } from "../schema";
import {
  DEFAULT_MAX_EVIDENCE_LENGTH,
  verifyAssessmentEvidence,
} from "./evidence";

const pages: PdfPageText[] = [
  { page: 1, text: "Course information", items: [] },
  {
    page: 4,
    text: "Oct. 1   MIDTERM EXAM covering Chapters 1-4",
    items: [],
  },
];

function extraction(source: { page: number | null; text: string | null } | null): CourseExtraction {
  return {
    course: { name: null, code: "ECO 20250", section: null, semester: null, instructor: null },
    meetings: [],
    assessments: [
      {
        id: "midterm1",
        type: "midterm",
        title: "Midterm Exam 1",
        release_date: null,
        due_date: null,
        date: "2026-10-01",
        due_time: null,
        start_time: null,
        end_time: null,
        location: null,
        coverage: "Chapters 1-4",
        date_status: "confirmed",
        raw_date_text: null,
        source,
      },
    ],
    assessment_rules: [],
    metadata: { source_type: "syllabus", extraction_status: "success", warnings: [] },
  };
}

describe("verifyAssessmentEvidence", () => {
  it("preserves verified page-aware evidence despite whitespace differences", () => {
    const result = verifyAssessmentEvidence(
      extraction({ page: 4, text: "Oct. 1 MIDTERM EXAM covering Chapters 1-4" }),
      pages,
    );

    expect(result.assessments[0].source).toEqual({
      page: 4,
      text: "Oct. 1 MIDTERM EXAM covering Chapters 1-4",
    });
    expect(result.metadata.warnings).toEqual([]);
  });

  it("fills a page number only when the supplied snippet matches", () => {
    const result = verifyAssessmentEvidence(
      extraction({ page: null, text: "MIDTERM EXAM covering Chapters 1-4" }),
      pages,
    );
    expect(result.assessments[0].source?.page).toBe(4);
  });

  it("removes mismatched evidence and adds a warning", () => {
    const result = verifyAssessmentEvidence(
      extraction({ page: 1, text: "Midterm is October 1" }),
      pages,
    );

    expect(result.assessments[0].source).toBeNull();
    expect(result.metadata.warnings).toEqual([
      expect.objectContaining({ type: "source_mismatch", assessment_id: "midterm1" }),
    ]);
  });

  it("warns when assessment evidence is absent", () => {
    const result = verifyAssessmentEvidence(extraction(null), pages);
    expect(result.metadata.warnings[0].message).toContain("No source evidence");
  });

  it("bounds retained source snippets", () => {
    const longText = "A".repeat(DEFAULT_MAX_EVIDENCE_LENGTH + 20);
    const result = verifyAssessmentEvidence(
      extraction({ page: 5, text: longText }),
      [{ page: 5, text: longText, items: [] }],
    );
    expect(result.assessments[0].source?.text).toHaveLength(DEFAULT_MAX_EVIDENCE_LENGTH);
  });
});
