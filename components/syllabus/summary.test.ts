import { describe, expect, it } from "vitest";

import type { Course, Meeting } from "../../lib/syllabus";
import { formatCourseTime, summarizeCourse } from "./summary";

const course: Course = {
  code: "ECO 20250",
  name: "Microeconomics",
  section: "01",
  semester: "Fall 2026",
  instructor: "Dr. Rivera",
};

const meeting: Meeting = {
  days: ["MONDAY", "WEDNESDAY"],
  start_time: "09:30",
  end_time: "10:45",
  location: "Room 101",
  start_date: "2026-08-24",
  end_date: "2026-12-14",
};

describe("course summary formatting", () => {
  it("formats complete course and meeting data", () => {
    expect(summarizeCourse(course, [meeting])).toEqual({
      ...course,
      meetings: [
        {
          schedule: "Mon · Wed · 9:30 AM–10:45 AM",
          location: "Room 101",
          dateRange: "2026-08-24 to 2026-12-14",
        },
      ],
    });
  });

  it("keeps multiple meetings distinct", () => {
    const second: Meeting = {
      ...meeting,
      days: ["FRIDAY"],
      start_time: "13:00",
      end_time: "14:00",
      location: "Lab 4",
    };
    expect(summarizeCourse(course, [meeting, second]).meetings).toHaveLength(2);
    expect(summarizeCourse(course, [meeting, second]).meetings[1]).toMatchObject({
      schedule: "Fri · 1:00 PM–2:00 PM",
      location: "Lab 4",
    });
  });

  it("labels sparse data without inventing details", () => {
    expect(
      summarizeCourse(
        {
          code: null,
          name: null,
          section: null,
          semester: null,
          instructor: null,
        },
        [{ ...meeting, start_time: null, end_time: null, location: null }],
      ),
    ).toMatchObject({
      code: null,
      name: "Course name not identified",
      section: null,
      semester: null,
      instructor: null,
      meetings: [
        {
          schedule: "Mon · Wed · Time not provided",
          location: "Location not provided",
        },
      ],
    });
  });

  it("formats midnight, noon, and missing times", () => {
    expect(formatCourseTime("00:05")).toBe("12:05 AM");
    expect(formatCourseTime("12:00")).toBe("12:00 PM");
    expect(formatCourseTime(null)).toBeNull();
  });
});
