import { describe, expect, it } from "vitest";

import type { PdfPageText } from "../pdf";
import type { CourseExtraction } from "../schema";
import { applyDocumentMeetingRanges } from "./meeting-ranges";

const extraction: CourseExtraction = {
  course: { name: "Intermediate Microeconomics", code: "ECO 20250", section: "E", semester: "Fall 2026", instructor: null },
  meetings: [{ days: ["THURSDAY"], start_time: "11:00", end_time: "12:15", location: "NAC 1/203", start_date: null, end_date: null }],
  assessments: [], assessment_rules: [],
  metadata: { source_type: "syllabus", extraction_status: "success", warnings: [] },
};

function pages(text: string): PdfPageText[] {
  return [{ page: 1, text, items: [] }];
}

describe("applyDocumentMeetingRanges", () => {
  it("derives recurrence boundaries from explicit matching course-outline dates", () => {
    const result = applyDocumentMeetingRanges(extraction, pages(
      "Syllabus updated 7/8/26. COURSE OUTLINE Sept. 3 First Class Oct. 1 MIDTERM Nov. 26 NO CLASS Dec. 10 Oligopoly. HW12 due 12/16.",
    ));
    expect(result.meetings[0]).toMatchObject({ start_date: "2026-09-03", end_date: "2026-12-10" });
  });

  it("preserves explicit meeting boundaries", () => {
    const value = { ...extraction, meetings: [{ ...extraction.meetings[0], start_date: "2026-09-10", end_date: "2026-12-03" }] };
    expect(applyDocumentMeetingRanges(value, pages("Sept. 3 Dec. 10")).meetings[0]).toMatchObject({ start_date: "2026-09-10", end_date: "2026-12-03" });
  });

  it("does not infer a range without at least two matching dates", () => {
    expect(applyDocumentMeetingRanges(extraction, pages("First class Sept. 3")).meetings[0].start_date).toBeNull();
  });

  it("does not mistake a short pair of assessment dates for semester boundaries", () => {
    const result = applyDocumentMeetingRanges(extraction, pages("Oct. 1 MIDTERM EXAM. Nov. 5 MIDTERM EXAM."));
    expect(result.meetings[0]).toMatchObject({ start_date: null, end_date: null });
  });
});
