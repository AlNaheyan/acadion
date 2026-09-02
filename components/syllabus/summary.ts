import type { Course, Meeting } from "../../lib/syllabus";

const shortDay = {
  MONDAY: "Mon",
  TUESDAY: "Tue",
  WEDNESDAY: "Wed",
  THURSDAY: "Thu",
  FRIDAY: "Fri",
  SATURDAY: "Sat",
  SUNDAY: "Sun",
} as const;

export interface MeetingSummary {
  schedule: string;
  location: string;
  dateRange: string | null;
}

export interface CourseSummary {
  code: string | null;
  name: string;
  section: string | null;
  semester: string | null;
  instructor: string | null;
  meetings: MeetingSummary[];
}

export function formatCourseTime(value: string | null): string | null {
  if (!value) return null;
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isInteger(hour) || !minute) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minute} ${suffix}`;
}

export function summarizeMeeting(meeting: Meeting): MeetingSummary {
  const days = meeting.days.map((day) => shortDay[day]).join(" · ");
  const start = formatCourseTime(meeting.start_time);
  const end = formatCourseTime(meeting.end_time);
  const time = start && end ? `${start}–${end}` : start ?? end ?? "Time not provided";
  const dateRange =
    meeting.start_date && meeting.end_date
      ? `${meeting.start_date} to ${meeting.end_date}`
      : meeting.start_date ?? meeting.end_date;

  return {
    schedule: `${days} · ${time}`,
    location: meeting.location ?? "Location not provided",
    dateRange,
  };
}

export function summarizeCourse(
  course: Course,
  meetings: Meeting[],
): CourseSummary {
  return {
    code: course.code,
    name: course.name ?? "Course name not identified",
    section: course.section,
    semester: course.semester,
    instructor: course.instructor,
    meetings: meetings.map(summarizeMeeting),
  };
}
