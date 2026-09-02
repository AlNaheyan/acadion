import { describe, expect, it } from "vitest";

import type { ImportedSyllabusResponse } from "./upload-state";
import { buildCalendarExportConfirmation } from "./export-confirmation";

const result: ImportedSyllabusResponse = {
  course_id: "course-123",
  course: {
    code: "ECO 20250",
    name: "Microeconomics",
    section: null,
    semester: "Fall 2026",
    instructor: null,
  },
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
      id: "homework-1",
      type: "homework",
      title: "Homework 1",
      release_date: null,
      due_date: "2026-09-08",
      date: null,
      due_time: "23:59",
      start_time: null,
      end_time: null,
      location: null,
      coverage: null,
      date_status: "confirmed",
      raw_date_text: null,
      source: null,
    },
    {
      id: "midterm-1",
      type: "midterm",
      title: "Midterm 1",
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
  warnings: [],
};

describe("calendar export confirmation", () => {
  it("groups included records and explains every exclusion", () => {
    expect(buildCalendarExportConfirmation(result)).toEqual({
      meetingCount: 1,
      assessmentGroups: [
        { label: "Homework", count: 1, ariaLabel: "1 homework included" },
        { label: "Midterms", count: 1, ariaLabel: "1 midterms included" },
      ],
      excluded: [
        { id: "final", title: "Final Exam", reason: "Date is TBD" },
      ],
    });
  });

  it("returns explicit empty groupings", () => {
    expect(
      buildCalendarExportConfirmation({
        ...result,
        meetings: [],
        assessments: [],
      }),
    ).toEqual({ meetingCount: 0, assessmentGroups: [], excluded: [] });
  });
});
