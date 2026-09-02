import { describe, expect, it } from "vitest";

import type { Assessment, Meeting } from "../syllabus";
import { generateAssessmentCalendar } from "./assessments";
import { generateClassCalendar } from "./classes";
import { validateIcsCalendar } from "./validate";

const course = {
  code: "ECO 20250",
  name: "Microeconomics",
  section: null,
  semester: "Fall 2026",
  instructor: null,
};
const meeting: Meeting = {
  days: ["MONDAY", "WEDNESDAY"],
  start_time: "09:30",
  end_time: "10:45",
  location: `Long room name ${"é".repeat(60)}`,
  start_date: "2026-08-24",
  end_date: "2026-12-14",
};
const assessment: Assessment = {
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
  coverage: null,
  date_status: "confirmed",
  raw_date_text: "October 1",
  source: { page: 4, text: "Midterm October 1" },
};

describe("complete ICS document validation", () => {
  it("validates the recurring class export as a complete calendar", () => {
    const generated = generateClassCalendar({
      courseId: "course-123",
      course,
      meetings: [meeting, { ...meeting, days: ["FRIDAY"] }],
      generatedAt: new Date("2026-09-01T12:00:00Z"),
    });
    expect(validateIcsCalendar(generated.ics)).toEqual({
      valid: true,
      issues: [],
      eventCount: 2,
    });
  });

  it("validates assessment export semantics after unsafe exclusions", () => {
    const generated = generateAssessmentCalendar({
      courseId: "course-123",
      course,
      assessments: [
        assessment,
        {
          ...assessment,
          id: "final-exam",
          title: "Final Exam",
          date: null,
          start_time: null,
          end_time: null,
          date_status: "TBD",
        },
      ],
      generatedAt: new Date("2026-09-01T12:00:00Z"),
    });
    expect(generated).toMatchObject({ exportedCount: 1, excludedCount: 1 });
    expect(validateIcsCalendar(generated.ics)).toEqual({
      valid: true,
      issues: [],
      eventCount: 1,
    });
  });

  it("reports malformed framing, missing fields, duplicate UIDs, and bad dates", () => {
    const malformed = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Test//EN",
      "BEGIN:VEVENT",
      "UID:duplicate@test",
      "DTSTART;VALUE=DATE:not-a-date",
      "SUMMARY:First",
      "END:VEVENT",
      "BEGIN:VEVENT",
      "UID:duplicate@test",
      "DTSTART:20261001T093000",
      "SUMMARY:Second",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\n");
    const result = validateIcsCalendar(malformed);

    expect(result.valid).toBe(false);
    expect(result.issues).toEqual(
      expect.arrayContaining([
        "Calendar must end with CRLF.",
        "Calendar contains a bare LF line ending.",
        "Event 1 is missing DTSTAMP.",
        "DTSTART has an invalid DATE value.",
        "Event 2 is missing DTSTAMP.",
        "Event 2 has a duplicate UID.",
      ]),
    );
  });
});
