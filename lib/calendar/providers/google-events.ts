import { createHash } from "node:crypto";

import type { Course, Meeting } from "../../syllabus";
import { firstMeetingDate, zonedLocalToUtc, type CalendarDateRange } from "../classes";

const recurrenceDay = {
  MONDAY: "MO", TUESDAY: "TU", WEDNESDAY: "WE", THURSDAY: "TH",
  FRIDAY: "FR", SATURDAY: "SA", SUNDAY: "SU",
} as const;

export interface GoogleEventPayload {
  summary: string;
  description: string;
  location?: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  recurrence: string[];
  extendedProperties: { private: { acadionKey: string; acadionCourseId: string; acadionType: "class" } };
}

export interface GoogleClassEvent {
  logicalKey: string;
  payload: GoogleEventPayload;
}

export function mapMeetingToGoogleEvent(input: {
  courseId: string;
  course: Course;
  meeting: Meeting;
  timezone: string;
  fallbackRange?: CalendarDateRange;
}): GoogleClassEvent | null {
  const { meeting } = input;
  if (!meeting.start_time || !meeting.end_time) return null;
  const range = meeting.start_date && meeting.end_date
    ? { startDate: meeting.start_date, endDate: meeting.end_date, provenance: "syllabus" }
    : input.fallbackRange;
  if (!range || range.startDate > range.endDate) return null;
  const firstDate = firstMeetingDate(range.startDate, meeting);
  if (firstDate > range.endDate) return null;
  const identity = JSON.stringify({
    courseId: input.courseId,
    days: [...meeting.days].sort(),
    start: meeting.start_time,
    end: meeting.end_time,
    location: meeting.location,
    range,
  });
  const logicalKey = `class:${createHash("sha256").update(identity).digest("hex")}`;
  const label = input.course.code ?? input.course.name ?? "Course";
  const until = zonedLocalToUtc(range.endDate, "23:59:59", input.timezone)
    .toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return {
    logicalKey,
    payload: {
      summary: `${label} - Class`,
      description: `Weekly class meeting. Date range source: ${range.provenance}.`,
      ...(meeting.location ? { location: meeting.location } : {}),
      start: { dateTime: `${firstDate}T${meeting.start_time}:00`, timeZone: input.timezone },
      end: { dateTime: `${firstDate}T${meeting.end_time}:00`, timeZone: input.timezone },
      recurrence: [`RRULE:FREQ=WEEKLY;BYDAY=${meeting.days.map((day) => recurrenceDay[day]).join(",")};UNTIL=${until}`],
      extendedProperties: { private: { acadionKey: logicalKey, acadionCourseId: input.courseId, acadionType: "class" } },
    },
  };
}

export async function insertGoogleEvent(
  calendarId: string,
  accessToken: string,
  event: GoogleEventPayload,
  fetcher: typeof fetch = fetch,
): Promise<{ id: string }> {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`;
  const response = await fetcher(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error("Google calendar event could not be created.");
  const body = (await response.json()) as { id?: unknown };
  if (typeof body.id !== "string" || !body.id) throw new Error("Google returned an invalid event.");
  return { id: body.id };
}
