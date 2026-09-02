import { describe, expect, it } from "vitest";

import type { ImportedSyllabusResponse } from "./upload-state";
import { getCalendarExportGuidance } from "./export-guidance";

const base: ImportedSyllabusResponse = {
  course_id: "course-123",
  course: {
    code: null,
    name: "Course",
    section: null,
    semester: null,
    instructor: null,
  },
  meetings: [],
  assessments: [],
  warnings: [],
};

describe("calendar export empty-state guidance", () => {
  it("explains entirely empty exports", () => {
    expect(getCalendarExportGuidance(base).map(({ code }) => code)).toEqual([
      "NO_MEETINGS",
      "NO_ASSESSMENTS",
    ]);
  });

  it("distinguishes incomplete meetings from missing meetings", () => {
    expect(
      getCalendarExportGuidance({
        ...base,
        meetings: [
          {
            days: ["MONDAY"],
            start_time: "09:30",
            end_time: null,
            location: null,
            start_date: null,
            end_date: null,
          },
        ],
      }).map(({ code }) => code),
    ).toContain("INCOMPLETE_MEETINGS");
  });

  it("explains when all assessment records are excluded", () => {
    const guidance = getCalendarExportGuidance({
      ...base,
      assessments: [
        {
          id: "final",
          type: "final_exam",
          title: "Final Exam",
          release_date: null,
          due_date: null,
          date: null,
          due_time: null,
          start_time: null,
          end_time: null,
          location: null,
          coverage: null,
          date_status: "TBD",
          raw_date_text: "TBD",
          source: null,
        },
      ],
    });
    expect(guidance.map(({ code }) => code)).toContain(
      "NO_CONFIRMED_ASSESSMENTS",
    );
  });

  it("returns no guidance when both exports are ready", () => {
    expect(
      getCalendarExportGuidance({
        ...base,
        meetings: [
          {
            days: ["MONDAY"],
            start_time: "09:30",
            end_time: "10:45",
            location: null,
            start_date: "2026-08-24",
            end_date: "2026-12-14",
          },
        ],
        assessments: [
          {
            id: "midterm",
            type: "midterm",
            title: "Midterm",
            release_date: null,
            due_date: null,
            date: "2026-10-01",
            due_time: null,
            start_time: null,
            end_time: null,
            location: null,
            coverage: null,
            date_status: "confirmed",
            raw_date_text: null,
            source: null,
          },
        ],
      }),
    ).toEqual([]);
  });
});
