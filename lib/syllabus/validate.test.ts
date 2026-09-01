import { describe, expect, it } from "vitest";

import { validateCourseExtraction } from "./validate";

const baseExtraction = {
  course: { code: "ECO 20250" },
  metadata: { extraction_status: "success" },
};

describe("validateCourseExtraction", () => {
  it("returns canonical data with defaults for valid input", () => {
    const result = validateCourseExtraction(baseExtraction);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.meetings).toEqual([]);
      expect(result.data.course.name).toBeNull();
    }
  });

  it.each([
    [
      "impossible dates",
      { meetings: [{ days: ["MONDAY"], start_date: "2026-02-30" }] },
      "meetings.0.start_date",
    ],
    [
      "backward meeting ranges",
      { meetings: [{ days: ["MONDAY"], start_time: "14:00", end_time: "13:00" }] },
      "meetings.0.end_time",
    ],
    [
      "due times without due dates",
      {
        assessments: [
          { id: "hw1", type: "homework", title: "Homework 1", due_time: "20:00" },
        ],
      },
      "assessments.0.due_time",
    ],
    [
      "confirmed assessments without a date",
      { assessments: [{ id: "exam", type: "exam", title: "Exam" }] },
      "assessments.0.date_status",
    ],
    [
      "duplicate assessment IDs",
      {
        assessments: [
          { id: "quiz", type: "quiz", title: "Quiz 1", date: "2026-09-01" },
          { id: "quiz", type: "quiz", title: "Quiz 2", date: "2026-09-08" },
        ],
      },
      "assessments.1.id",
    ],
    [
      "warnings for unknown assessments",
      {
        metadata: {
          extraction_status: "partial",
          warnings: [
            { type: "missing", message: "Date missing", assessment_id: "unknown" },
          ],
        },
      },
      "metadata.warnings.0.assessment_id",
    ],
  ])("rejects %s", (_name, override, expectedPath) => {
    const result = validateCourseExtraction({ ...baseExtraction, ...override });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.issues.map((issue) => issue.path)).toContain(expectedPath);
    }
  });

  it("accepts TBD assessments without normalized dates", () => {
    const result = validateCourseExtraction({
      ...baseExtraction,
      assessments: [
        {
          id: "final",
          type: "final_exam",
          title: "Final Exam",
          date_status: "TBD",
          raw_date_text: "Date/Time TBD",
        },
      ],
    });

    expect(result.success).toBe(true);
  });
});
