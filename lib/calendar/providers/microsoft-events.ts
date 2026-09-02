import { createHash } from "node:crypto";
import type { Assessment, Course, Meeting } from "../../syllabus";
import { firstMeetingDate, type CalendarDateRange } from "../classes";

const outlookDay = { MONDAY: "monday", TUESDAY: "tuesday", WEDNESDAY: "wednesday", THURSDAY: "thursday", FRIDAY: "friday", SATURDAY: "saturday", SUNDAY: "sunday" } as const;
export interface MicrosoftEventPayload {
  subject: string; transactionId: string; body: { contentType: "text"; content: string };
  start: { dateTime: string; timeZone: string }; end: { dateTime: string; timeZone: string };
  location?: { displayName: string }; isAllDay?: boolean;
  recurrence?: { pattern: { type: "weekly"; interval: 1; daysOfWeek: string[] }; range: { type: "endDate"; startDate: string; endDate: string; recurrenceTimeZone: string } };
}
export interface MicrosoftCalendarEvent { logicalKey: string; payload: MicrosoftEventPayload }
function transactionId(key: string) { const hash = createHash("sha256").update(key).digest("hex"); return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-${hash.slice(12, 16)}-${hash.slice(16, 20)}-${hash.slice(20, 32)}`; }
function nextDate(date: string) { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + 1); return value.toISOString().slice(0, 10); }
function minuteAfter(date: string, time: string) { const value = new Date(`${date}T${time}:00Z`); value.setUTCMinutes(value.getUTCMinutes() + 1); return { date: value.toISOString().slice(0, 10), time: value.toISOString().slice(11, 16) }; }

export function mapMeetingToMicrosoftEvent(input: { courseId: string; course: Course; meeting: Meeting; timezone: string; fallbackRange?: CalendarDateRange }): MicrosoftCalendarEvent | null {
  const { meeting } = input; if (!meeting.start_time || !meeting.end_time) return null;
  const range = meeting.start_date && meeting.end_date ? { startDate: meeting.start_date, endDate: meeting.end_date } : input.fallbackRange;
  if (!range || range.startDate > range.endDate) return null;
  const firstDate = firstMeetingDate(range.startDate, meeting); if (firstDate > range.endDate) return null;
  const identity = JSON.stringify({ courseId: input.courseId, days: [...meeting.days].sort(), start: meeting.start_time, end: meeting.end_time, location: meeting.location, range });
  const logicalKey = `class:${createHash("sha256").update(identity).digest("hex")}`;
  const label = input.course.code ?? input.course.name ?? "Course";
  return { logicalKey, payload: {
    subject: `${label} - Class`, transactionId: transactionId(logicalKey),
    body: { contentType: "text", content: "Weekly class meeting imported from the confirmed syllabus schedule." },
    start: { dateTime: `${firstDate}T${meeting.start_time}:00`, timeZone: input.timezone },
    end: { dateTime: `${firstDate}T${meeting.end_time}:00`, timeZone: input.timezone },
    ...(meeting.location ? { location: { displayName: meeting.location } } : {}),
    recurrence: { pattern: { type: "weekly", interval: 1, daysOfWeek: meeting.days.map((day) => outlookDay[day]) }, range: { type: "endDate", startDate: firstDate, endDate: range.endDate, recurrenceTimeZone: input.timezone } },
  } };
}

export function mapAssessmentToMicrosoftEvent(input: { courseId: string; course: Course; assessment: Assessment; timezone: string; blocked?: boolean }): MicrosoftCalendarEvent | null {
  const { assessment } = input; if (assessment.date_status !== "confirmed" || input.blocked) return null;
  const date = assessment.date ?? assessment.due_date ?? assessment.release_date; if (!date) return null;
  const time = assessment.date ? assessment.start_time : assessment.due_date ? assessment.due_time : null;
  const logicalKey = `assessment:${input.courseId}:${assessment.id}`; const label = input.course.code ?? input.course.name ?? "Course";
  const startTime = time ?? "00:00"; const fallbackEnd = time ? minuteAfter(date, time) : null;
  const endDate = time ? (assessment.date && assessment.end_time ? date : fallbackEnd!.date) : nextDate(date);
  const endTime = assessment.date && assessment.end_time ? assessment.end_time : fallbackEnd?.time ?? "00:00";
  return { logicalKey, payload: {
    subject: `${label} - ${assessment.title}`, transactionId: transactionId(logicalKey),
    body: { contentType: "text", content: `Assessment type: ${assessment.type}.${assessment.coverage ? ` Coverage: ${assessment.coverage}` : ""}` },
    start: { dateTime: `${date}T${startTime}:00`, timeZone: input.timezone },
    end: { dateTime: `${endDate}T${endTime}:00`, timeZone: input.timezone },
    ...(!time ? { isAllDay: true } : {}), ...(assessment.location ? { location: { displayName: assessment.location } } : {}),
  } };
}

export async function insertMicrosoftEvent(calendarId: string, accessToken: string, event: MicrosoftEventPayload, fetcher: typeof fetch = fetch): Promise<{ id: string }> {
  const response = await fetcher(`https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(event),
  });
  if (!response.ok) throw new Error("Microsoft Outlook event could not be created.");
  const body = await response.json() as { id?: unknown }; if (typeof body.id !== "string" || !body.id) throw new Error("Microsoft returned an invalid event.");
  return { id: body.id };
}
