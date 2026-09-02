import { describe, expect, it, vi } from "vitest";
import type { Assessment, Course, Meeting } from "../../syllabus";
import { insertMicrosoftEvent, mapAssessmentToMicrosoftEvent, mapMeetingToMicrosoftEvent } from "./microsoft-events";
const course: Course = { code: "ECO 101", name: "Economics", section: null, semester: null, instructor: null };
const meeting: Meeting = { days: ["MONDAY", "WEDNESDAY"], start_time: "09:30", end_time: "10:45", location: "Room 1", start_date: "2026-09-01", end_date: "2026-12-01" };
describe("Microsoft Outlook event mapping", () => {
  it("maps a class to a weekly recurrence and stable transaction ID", () => {
    const first = mapMeetingToMicrosoftEvent({ courseId: "course", course, meeting, timezone: "Eastern Standard Time" })!;
    const second = mapMeetingToMicrosoftEvent({ courseId: "course", course, meeting, timezone: "Eastern Standard Time" })!;
    expect(first.payload.recurrence).toMatchObject({ pattern: { daysOfWeek: ["monday", "wednesday"] }, range: { endDate: "2026-12-01" } });
    expect(first.payload.transactionId).toBe(second.payload.transactionId);
  });
  it("excludes uncertain assessments and represents all-day dates with an exclusive end", () => {
    const assessment: Assessment = { id: "exam", type: "exam", title: "Exam", release_date: null, due_date: null, date: "2026-10-01", due_time: null, start_time: null, end_time: null, location: null, coverage: null, date_status: "confirmed", raw_date_text: null, source: null };
    expect(mapAssessmentToMicrosoftEvent({ courseId: "course", course, assessment, timezone: "UTC" })?.payload).toMatchObject({ isAllDay: true, start: { dateTime: "2026-10-01T00:00:00" }, end: { dateTime: "2026-10-02T00:00:00" } });
    expect(mapAssessmentToMicrosoftEvent({ courseId: "course", course, assessment: { ...assessment, date_status: "TBD" }, timezone: "UTC" })).toBeNull();
  });
  it("posts to the selected encoded calendar", async () => {
    const event = mapMeetingToMicrosoftEvent({ courseId: "course", course, meeting, timezone: "UTC" })!;
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: "outlook-event" }));
    await expect(insertMicrosoftEvent("my calendar", "access", event.payload, fetcher)).resolves.toEqual({ id: "outlook-event" });
    expect(fetcher.mock.calls[0][0]).toContain("my%20calendar/events");
  });
});
