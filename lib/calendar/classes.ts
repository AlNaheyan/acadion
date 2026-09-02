import type { Course, Meeting } from "../syllabus";
import { serializeIcsCalendar, type IcsProperty } from "./ics";
import { createCalendarEventUid } from "./uid";

const rruleDay = {
  MONDAY: "MO",
  TUESDAY: "TU",
  WEDNESDAY: "WE",
  THURSDAY: "TH",
  FRIDAY: "FR",
  SATURDAY: "SA",
  SUNDAY: "SU",
} as const;

const weekdayIndex = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;

export interface CalendarDateRange {
  startDate: string;
  endDate: string;
  provenance: "semester" | "academic_calendar";
}

export interface ClassCalendarInput {
  courseId: string;
  course: Course;
  meetings: Meeting[];
  generatedAt: Date;
  timezone?: string;
  fallbackRange?: CalendarDateRange;
}

export interface GeneratedClassCalendar {
  ics: string;
  exportedCount: number;
  excludedCount: number;
}

function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

function compactTime(time: string): string {
  return `${time.replace(":", "")}00`;
}

function utcTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function firstMeetingDate(startDate: string, meeting: Meeting): string {
  const [year, month, day] = startDate.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, day));
  const allowedDays = new Set<number>(
    meeting.days.map((value) => weekdayIndex[value]),
  );

  for (let offset = 0; offset < 7; offset += 1) {
    const candidate = new Date(start);
    candidate.setUTCDate(start.getUTCDate() + offset);
    if (allowedDays.has(candidate.getUTCDay())) {
      return candidate.toISOString().slice(0, 10);
    }
  }

  return startDate;
}

function zonedLocalToUtc(
  date: string,
  time: string,
  timezone: string,
): Date {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute, second = 0] = time.split(":").map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = desired;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter
        .formatToParts(new Date(guess))
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, Number(part.value)]),
    );
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    guess += desired - represented;
  }

  return new Date(guess);
}

function eventForMeeting(
  input: ClassCalendarInput,
  meeting: Meeting,
  timezone: string,
): IcsProperty[] | null {
  if (!meeting.start_time || !meeting.end_time) return null;
  const range =
    meeting.start_date && meeting.end_date
      ? {
          startDate: meeting.start_date,
          endDate: meeting.end_date,
          provenance: "syllabus" as const,
        }
      : input.fallbackRange;
  if (!range || range.startDate > range.endDate) return null;

  const firstDate = firstMeetingDate(range.startDate, meeting);
  if (firstDate > range.endDate) return null;
  const courseLabel = input.course.code ?? input.course.name ?? "Course";
  const description = `Weekly class meeting. Date range source: ${range.provenance}.`;
  const logicalMeetingId = JSON.stringify({
    days: [...meeting.days].sort(),
    start_time: meeting.start_time,
    end_time: meeting.end_time,
    location: meeting.location,
    start_date: range.startDate,
    end_date: range.endDate,
  });

  return [
    {
      name: "UID",
      value: createCalendarEventUid(input.courseId, "class", logicalMeetingId),
    },
    { name: "DTSTAMP", value: utcTimestamp(input.generatedAt) },
    {
      name: "DTSTART",
      value: `${compactDate(firstDate)}T${compactTime(meeting.start_time)}`,
      parameters: { TZID: timezone },
    },
    {
      name: "DTEND",
      value: `${compactDate(firstDate)}T${compactTime(meeting.end_time)}`,
      parameters: { TZID: timezone },
    },
    {
      name: "RRULE",
      value: `FREQ=WEEKLY;BYDAY=${meeting.days.map((day) => rruleDay[day]).join(",")};UNTIL=${utcTimestamp(zonedLocalToUtc(range.endDate, "23:59:59", timezone))}`,
    },
    { name: "SUMMARY", value: `${courseLabel} - Class`, valueType: "text" },
    ...(meeting.location
      ? [{ name: "LOCATION", value: meeting.location, valueType: "text" as const }]
      : []),
    { name: "DESCRIPTION", value: description, valueType: "text" },
  ];
}

export function generateClassCalendar(
  input: ClassCalendarInput,
): GeneratedClassCalendar {
  const timezone = input.timezone ?? "America/New_York";
  const candidateEvents = input.meetings.map((meeting) =>
    eventForMeeting(input, meeting, timezone),
  );
  const events = candidateEvents.filter(
    (event): event is IcsProperty[] => event !== null,
  );
  const courseLabel = input.course.code ?? input.course.name ?? "Imported course";

  return {
    ics: serializeIcsCalendar({
      name: `${courseLabel} Class Schedule`,
      properties: [{ name: "X-WR-TIMEZONE", value: timezone }],
      events,
    }),
    exportedCount: events.length,
    excludedCount: candidateEvents.length - events.length,
  };
}
