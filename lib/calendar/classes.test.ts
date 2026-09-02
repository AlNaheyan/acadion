import { describe, expect, it } from "vitest";

import type { Meeting } from "../syllabus";
import { generateClassCalendar } from "./classes";

const meeting: Meeting = {
  days: ["MONDAY", "WEDNESDAY"],
  start_time: "09:30",
  end_time: "10:45",
  location: "Room 101, West",
  start_date: "2026-08-25",
  end_date: "2026-12-14",
};

function calendar(meetings: Meeting[], fallbackRange?: Parameters<typeof generateClassCalendar>[0]["fallbackRange"]) {
  return generateClassCalendar({
    courseId: "course-123",
    course: {
      code: "ECO 20250",
      name: "Microeconomics",
      section: null,
      semester: "Fall 2026",
      instructor: null,
    },
    meetings,
    generatedAt: new Date("2026-09-01T12:00:00Z"),
    timezone: "America/New_York",
    fallbackRange,
  });
}

describe("generateClassCalendar", () => {
  it("creates one weekly recurrence for a multi-day meeting", () => {
    const result = calendar([meeting]);

    expect(result).toMatchObject({ exportedCount: 1, excludedCount: 0 });
    expect(result.ics).toContain("DTSTART;TZID=America/New_York:20260826T093000");
    expect(result.ics).toContain("DTEND;TZID=America/New_York:20260826T104500");
    expect(result.ics).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261215T045959Z");
    expect(result.ics).toContain("LOCATION:Room 101\\, West");
    expect(result.ics.match(/BEGIN:VEVENT/g)).toHaveLength(1);
  });

  it("creates distinct recurrences for distinct meeting patterns", () => {
    const result = calendar([
      meeting,
      { ...meeting, days: ["FRIDAY"], start_time: "13:00", end_time: "14:00" },
    ]);
    expect(result.exportedCount).toBe(2);
    expect(result.ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(result.ics).toContain("BYDAY=FR");
  });

  it("uses an explicit trusted fallback range and records provenance", () => {
    const result = calendar(
      [{ ...meeting, start_date: null, end_date: null }],
      {
        startDate: "2026-08-24",
        endDate: "2026-12-18",
        provenance: "semester",
      },
    );
    expect(result.exportedCount).toBe(1);
    expect(result.ics).toContain("Date range source: semester.");
  });

  it("uses timezone-aware DST offsets for the recurrence boundary", () => {
    const result = calendar([
      { ...meeting, start_date: "2026-01-12", end_date: "2026-03-12" },
    ]);
    expect(result.ics).toContain("UNTIL=20260313T035959Z");
    expect(result.ics).toContain("X-WR-TIMEZONE:America/New_York");
  });

  it("excludes meetings with missing time or date range", () => {
    const result = calendar([
      { ...meeting, start_time: null },
      { ...meeting, start_date: null, end_date: null },
    ]);
    expect(result).toMatchObject({ exportedCount: 0, excludedCount: 2 });
    expect(result.ics).not.toContain("BEGIN:VEVENT");
  });
});
