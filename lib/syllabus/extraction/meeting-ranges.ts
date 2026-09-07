import { normalizeDate } from "../normalize";
import type { CourseExtraction, MeetingDay } from "../schema";
import type { PdfPageText } from "../pdf";

const weekday: Record<MeetingDay, number> = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

const termMonths: Record<string, Set<number>> = {
  spring: new Set([1, 2, 3, 4, 5]),
  summer: new Set([5, 6, 7, 8]),
  fall: new Set([8, 9, 10, 11, 12]),
  winter: new Set([12, 1]),
};

function semesterContext(semester: string | null): { year: number; months: Set<number> | null } | null {
  if (!semester) return null;
  const year = semester.match(/\b(20\d{2})\b/);
  if (!year) return null;
  const term = Object.keys(termMonths).find((name) => semester.toLowerCase().includes(name));
  return { year: Number(year[1]), months: term ? termMonths[term] : null };
}

function datesInDocument(pages: PdfPageText[], year: number): string[] {
  const values = new Set<string>();
  const patterns = [
    /\b(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\.?\s+\d{1,2}(?:,?\s+20\d{2})?\b/gi,
    /\b\d{1,2}\s*\/\s*\d{1,2}(?:\s*\/\s*(?:\d{2}|\d{4}))?\b/g,
  ];

  for (const page of pages) {
    for (const pattern of patterns) {
      for (const match of page.text.matchAll(pattern)) {
        let raw = match[0];
        const shortYear = raw.match(/\/(\d{2})$/);
        if (shortYear) raw = raw.replace(/\d{2}$/, `20${shortYear[1]}`);
        const normalized = normalizeDate(raw, year);
        if (normalized.value) values.add(normalized.value);
      }
    }
  }

  return [...values];
}

function utcWeekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function daysBetween(start: string, end: string): number {
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000;
}

export function applyDocumentMeetingRanges(
  extraction: CourseExtraction,
  pages: PdfPageText[],
): CourseExtraction {
  const context = semesterContext(extraction.course.semester);
  if (!context) return extraction;
  const candidates = datesInDocument(pages, context.year)
    .filter((date) => !context.months || context.months.has(Number(date.slice(5, 7))))
    .sort();

  return {
    ...extraction,
    meetings: extraction.meetings.map((meeting) => {
      if (meeting.start_date && meeting.end_date) return meeting;
      const allowed = new Set(meeting.days.map((day) => weekday[day]));
      const matching = candidates.filter((date) => allowed.has(utcWeekday(date)));
      if (matching.length < 2) return meeting;
      const startDate = meeting.start_date ?? matching[0];
      const endDate = meeting.end_date ?? matching[matching.length - 1];
      // A pair of exams or assignment deadlines on meeting weekdays is not a
      // semester boundary. Only recover a conventional full-term span here;
      // shorter terms must provide explicit meeting dates.
      if (startDate >= endDate || daysBetween(startDate, endDate) < 56) return meeting;
      return { ...meeting, start_date: startDate, end_date: endDate };
    }),
  };
}
