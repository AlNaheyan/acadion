import { describe, expect, it } from "vitest";

import { courseExtractionSchema } from "./schema";

describe("courseExtractionSchema", () => {
  it("parses a complete syllabus extraction", () => {
    const result = courseExtractionSchema.parse({
      course: {
        name: "Intermediate Microeconomics",
        code: "ECO 20250",
        section: "E",
        semester: "Fall 2026",
        instructor: "Matthew Nagler",
      },
      meetings: [
        {
          days: ["THURSDAY"],
          start_time: "11:00",
          end_time: "12:15",
          location: "NAC 1/203",
          start_date: "2026-09-03",
          end_date: "2026-12-17",
        },
      ],
      assessments: [
        {
          id: "midterm1",
          type: "midterm",
          title: "Midterm Exam 1",
          date: "2026-10-01",
          start_time: "11:00",
          end_time: "12:15",
          location: "NAC 1/203",
          coverage: "Chapters 1-4",
          date_status: "confirmed",
          source: {
            page: 4,
            text: "Oct. 1 MIDTERM EXAM covering Chapters 1-4",
          },
        },
      ],
      assessment_rules: [
        {
          type: "homework",
          rule: "Homework is due one week after assignment.",
        },
      ],
      metadata: {
        source_type: "syllabus",
        extraction_status: "success",
        warnings: [],
      },
    });

    expect(result.assessments[0]).toMatchObject({
      id: "midterm1",
      due_date: null,
      raw_date_text: null,
    });
    expect(result.assessment_rules[0].source).toBeNull();
  });

  it("supports a conservative minimal extraction with defaults", () => {
    const result = courseExtractionSchema.parse({
      course: {},
      metadata: { extraction_status: "partial" },
    });

    expect(result).toEqual({
      course: {
        name: null,
        code: null,
        section: null,
        semester: null,
        instructor: null,
      },
      meetings: [],
      assessments: [],
      assessment_rules: [],
      metadata: {
        source_type: "syllabus",
        extraction_status: "partial",
        warnings: [],
      },
    });
  });

  it.each([
    ["unknown top-level fields", { extra: true }],
    ["invalid assessment types", { assessments: [{ id: "x", type: "essay", title: "Essay" }] }],
    ["invalid meeting days", { meetings: [{ days: ["THURS"] }] }],
  ])("rejects %s", (_name, override) => {
    const result = courseExtractionSchema.safeParse({
      course: {},
      metadata: { extraction_status: "success" },
      ...override,
    });

    expect(result.success).toBe(false);
  });
});
