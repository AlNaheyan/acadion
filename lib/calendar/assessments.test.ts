import { describe, expect, it } from "vitest";

import type { Assessment, ExtractionWarning } from "../syllabus";
import { generateAssessmentCalendar } from "./assessments";

function assessment(
  overrides: Partial<Assessment> = {},
): Assessment {
  return {
    id: "midterm-1",
    type: "midterm",
    title: "Midterm 1",
    release_date: null,
    due_date: null,
    date: "2026-10-01",
    due_time: null,
    start_time: "09:30",
    end_time: "10:45",
    location: "Room 101",
    coverage: "Chapters 1-4",
    date_status: "confirmed",
    raw_date_text: "October 1, 9:30-10:45 AM",
    source: { page: 4, text: "Midterm October 1" },
    ...overrides,
  };
}

function calendar(
  assessments: Assessment[],
  warnings: ExtractionWarning[] = [],
) {
  return generateAssessmentCalendar({
    courseId: "course-123",
    course: {
      code: "ECO 20250",
      name: "Microeconomics",
      section: null,
      semester: "Fall 2026",
      instructor: null,
    },
    assessments,
    warnings,
    generatedAt: new Date("2026-09-01T12:00:00Z"),
    timezone: "America/New_York",
  });
}

describe("generateAssessmentCalendar", () => {
  it("exports a timed assessment with its explicit end", () => {
    const result = calendar([assessment()]);
    expect(result).toMatchObject({ exportedCount: 1, excludedCount: 0 });
    expect(result.ics).toContain("DTSTART;TZID=America/New_York:20261001T093000");
    expect(result.ics).toContain("DTEND;TZID=America/New_York:20261001T104500");
    expect(result.ics).toContain("SUMMARY:ECO 20250 - Midterm 1");
  });

  it("exports a due-time deadline without inventing an end time", () => {
    const result = calendar([
      assessment({
        id: "homework-1",
        type: "homework",
        title: "Homework 1",
        date: null,
        start_time: null,
        end_time: null,
        due_date: "2026-09-08",
        due_time: "23:59",
      }),
    ]);
    expect(result.ics).toContain("DTSTART;TZID=America/New_York:20260908T235900");
    expect(result.ics).not.toContain("DTEND");
  });

  it("exports date-only and release-only assessments as all-day events", () => {
    const result = calendar([
      assessment({ start_time: null, end_time: null }),
      assessment({
        id: "project-release",
        type: "project",
        title: "Project Released",
        date: null,
        start_time: null,
        end_time: null,
        release_date: "2026-09-15",
      }),
    ]);
    expect(result.ics).toContain("DTSTART;VALUE=DATE:20261001");
    expect(result.ics).toContain("DTSTART;VALUE=DATE:20260915");
  });

  it.each(["TBD", "missing", "ambiguous"] as const)(
    "excludes %s assessments",
    (dateStatus) => {
      const result = calendar([
        assessment({
          date: null,
          start_time: null,
          end_time: null,
          date_status: dateStatus,
        }),
      ]);
      expect(result).toMatchObject({ exportedCount: 0, excludedCount: 1 });
      expect(result.ics).not.toContain("BEGIN:VEVENT");
    },
  );

  it("excludes confirmed records blocked by conflict or evidence warnings", () => {
    const items = [assessment(), assessment({ id: "exam-2", title: "Exam 2" })];
    const result = calendar(items, [
      {
        type: "conflict",
        message: "Conflicting date.",
        assessment_id: "midterm-1",
        source: null,
      },
      {
        type: "source_mismatch",
        message: "Evidence mismatch.",
        assessment_id: "exam-2",
        source: null,
      },
    ]);
    expect(result).toMatchObject({ exportedCount: 0, excludedCount: 2 });
  });
});
