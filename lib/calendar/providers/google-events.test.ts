import { describe, expect, it, vi } from "vitest";

import type { Course, Meeting } from "../../syllabus";
import { insertGoogleEvent, mapAssessmentToGoogleEvent, mapMeetingToGoogleEvent } from "./google-events";

const input: { courseId: string; course: Course; meeting: Meeting; timezone: string } = {
  courseId: "course-123",
  course: { code: "ECO 20250", name: "Microeconomics", section: null, semester: "Fall 2026", instructor: null },
  meeting: {
    days: ["MONDAY", "WEDNESDAY"],
    start_time: "09:30",
    end_time: "10:45",
    location: "Room 101",
    start_date: "2026-08-25",
    end_date: "2026-12-14",
  },
  timezone: "America/New_York",
};

describe("Google recurring class events", () => {
  it("maps a confirmed meeting to a timezone-aware weekly recurrence", () => {
    const event = mapMeetingToGoogleEvent(input);
    expect(event?.logicalKey).toMatch(/^class:[a-f0-9]{64}$/);
    expect(event?.payload).toMatchObject({
      summary: "ECO 20250 - Class",
      location: "Room 101",
      start: { dateTime: "2026-08-26T09:30:00", timeZone: "America/New_York" },
      end: { dateTime: "2026-08-26T10:45:00", timeZone: "America/New_York" },
      recurrence: ["RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261215T045959Z"],
    });
  });

  it("excludes incomplete meetings", () => {
    expect(mapMeetingToGoogleEvent({ ...input, meeting: { ...input.meeting, start_time: null } })).toBeNull();
  });

  it("inserts the event into the encoded selected calendar", async () => {
    const event = mapMeetingToGoogleEvent(input)!;
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "google-event-1" }));
    await expect(insertGoogleEvent("class calendar", "access", event.payload, fetcher)).resolves.toEqual({ id: "google-event-1" });
    expect(fetcher.mock.calls[0][0]).toContain("class%20calendar/events");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ method: "POST", headers: { Authorization: "Bearer access" } });
  });

  it("treats a deterministic provider ID conflict as an idempotent success", async () => {
    const event = mapMeetingToGoogleEvent(input)!;
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 409 }));
    await expect(insertGoogleEvent("calendar", "access", event.payload, fetcher)).resolves.toEqual({ id: event.payload.id });
  });
});

describe("Google assessment events", () => {
  const assessment = {
    id: "midterm-1", type: "midterm" as const, title: "Midterm 1", release_date: null,
    due_date: null, date: "2026-10-01", due_time: null, start_time: "09:30", end_time: "10:45",
    location: "Room 101", coverage: null, date_status: "confirmed" as const, raw_date_text: null, source: null,
  };
  it("maps only confirmed, unblocked assessments", () => {
    const event = mapAssessmentToGoogleEvent({ courseId: input.courseId, course: input.course, assessment, timezone: input.timezone });
    expect(event?.payload).toMatchObject({
      start: { dateTime: "2026-10-01T09:30:00" }, end: { dateTime: "2026-10-01T10:45:00" },
      extendedProperties: { private: { acadionType: "assessment" } },
    });
    expect(mapAssessmentToGoogleEvent({ courseId: input.courseId, course: input.course, assessment, timezone: input.timezone, blocked: true })).toBeNull();
    expect(mapAssessmentToGoogleEvent({ courseId: input.courseId, course: input.course, assessment: { ...assessment, date_status: "TBD" }, timezone: input.timezone })).toBeNull();
  });
});
