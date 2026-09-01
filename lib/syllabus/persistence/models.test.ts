import { describe, expect, it } from "vitest";

import type { CourseExtraction } from "../schema";
import { courseExtractionToInsert, meetingsToInserts } from "./models";

describe("courseExtractionToInsert", () => {
  it("maps canonical course metadata, ownership, status, and warnings", () => {
    const extraction: CourseExtraction = {
      course: {
        code: "ECO 20250",
        name: "Intermediate Microeconomics",
        section: "E",
        semester: "Fall 2026",
        instructor: "Matthew Nagler",
      },
      meetings: [],
      assessments: [],
      assessment_rules: [],
      metadata: {
        source_type: "syllabus",
        extraction_status: "partial",
        warnings: [
          {
            type: "TBD",
            message: "Final date is TBD.",
            assessment_id: null,
            source: null,
          },
        ],
      },
    };

    expect(courseExtractionToInsert("user_123", extraction)).toEqual({
      user_id: "user_123",
      code: "ECO 20250",
      name: "Intermediate Microeconomics",
      section: "E",
      semester: "Fall 2026",
      instructor: "Matthew Nagler",
      extraction_status: "partial",
      extraction_warnings: extraction.metadata.warnings,
    });
  });

  it("preserves null course fields rather than inventing values", () => {
    const extraction: CourseExtraction = {
      course: { code: null, name: null, section: null, semester: null, instructor: null },
      meetings: [],
      assessments: [],
      assessment_rules: [],
      metadata: { source_type: "syllabus", extraction_status: "failed", warnings: [] },
    };

    expect(courseExtractionToInsert("user_456", extraction)).toMatchObject({
      user_id: "user_456",
      code: null,
      name: null,
      extraction_status: "failed",
    });
  });
});

describe("meetingsToInserts", () => {
  it("expands a multi-day canonical meeting into one row per weekday", () => {
    expect(
      meetingsToInserts("course_123", [
        {
          days: ["MONDAY", "WEDNESDAY"],
          start_time: "14:00",
          end_time: "15:15",
          location: "NAC 4/220",
          start_date: "2026-08-31",
          end_date: "2026-12-16",
        },
      ]),
    ).toEqual([
      {
        course_id: "course_123",
        day: "MONDAY",
        start_time: "14:00",
        end_time: "15:15",
        location: "NAC 4/220",
        start_date: "2026-08-31",
        end_date: "2026-12-16",
      },
      {
        course_id: "course_123",
        day: "WEDNESDAY",
        start_time: "14:00",
        end_time: "15:15",
        location: "NAC 4/220",
        start_date: "2026-08-31",
        end_date: "2026-12-16",
      },
    ]);
  });

  it("returns no rows when no meetings were extracted", () => {
    expect(meetingsToInserts("course_123", [])).toEqual([]);
  });
});
