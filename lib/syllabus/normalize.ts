import { isoDateSchema, isoTimeSchema, type DateStatus } from "./schema";

export interface NormalizedValue {
  value: string | null;
  status: DateStatus;
  raw_text: string | null;
}

export interface NormalizedTimeRange {
  start_time: string | null;
  end_time: string | null;
  status: DateStatus;
  raw_text: string | null;
}

const months: Record<string, number> = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12,
};

const tbdPattern = /^(?:tbd|to be determined|not announced|date\s*\/\s*time tbd)$/i;

function unresolved(raw: string | null, status: DateStatus): NormalizedValue {
  return { value: null, status, raw_text: raw };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const candidate = `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
  return isoDateSchema.safeParse(candidate).success ? candidate : null;
}

export function normalizeDate(
  input: string | null | undefined,
  defaultYear?: number,
): NormalizedValue {
  if (input == null || input.trim() === "") {
    return unresolved(null, "missing");
  }

  const raw = input.trim();
  if (tbdPattern.test(raw)) {
    return unresolved(raw, "TBD");
  }

  if (isoDateSchema.safeParse(raw).success) {
    return { value: raw, status: "confirmed", raw_text: raw };
  }

  const numeric = raw.match(/^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*\/\s*(\d{4}))?$/);
  if (numeric) {
    const year = numeric[3] ? Number(numeric[3]) : defaultYear;
    if (!year) return unresolved(raw, "ambiguous");

    const value = toIsoDate(year, Number(numeric[1]), Number(numeric[2]));
    return value
      ? { value, status: "confirmed", raw_text: raw }
      : unresolved(raw, "ambiguous");
  }

  const named = raw.match(/^([A-Za-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/);
  if (named) {
    const month = months[named[1].toLowerCase()];
    const year = named[3] ? Number(named[3]) : defaultYear;
    if (!month || !year) return unresolved(raw, "ambiguous");

    const value = toIsoDate(year, month, Number(named[2]));
    return value
      ? { value, status: "confirmed", raw_text: raw }
      : unresolved(raw, "ambiguous");
  }

  return unresolved(raw, "ambiguous");
}

function twelveHourToMinutes(hour: number, minute: number, meridiem: string): number | null {
  if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;
  return (hour % 12) * 60 + minute + (meridiem.toLowerCase() === "pm" ? 720 : 0);
}

function minutesToTime(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function normalizeTime(input: string | null | undefined): NormalizedValue {
  if (input == null || input.trim() === "") {
    return unresolved(null, "missing");
  }

  const raw = input.trim();
  if (tbdPattern.test(raw)) {
    return unresolved(raw, "TBD");
  }

  const twentyFourHour = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (twentyFourHour) {
    const value = `${pad(Number(twentyFourHour[1]))}:${twentyFourHour[2]}`;
    return isoTimeSchema.safeParse(value).success
      ? { value, status: "confirmed", raw_text: raw }
      : unresolved(raw, "ambiguous");
  }

  const twelveHour = raw.match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i);
  if (twelveHour) {
    const minutes = twelveHourToMinutes(
      Number(twelveHour[1]),
      Number(twelveHour[2] ?? 0),
      twelveHour[3],
    );
    return minutes == null
      ? unresolved(raw, "ambiguous")
      : { value: minutesToTime(minutes), status: "confirmed", raw_text: raw };
  }

  return unresolved(raw, "ambiguous");
}

export function normalizeTimeRange(
  input: string | null | undefined,
): NormalizedTimeRange {
  if (input == null || input.trim() === "") {
    return { start_time: null, end_time: null, status: "missing", raw_text: null };
  }

  const raw = input.trim();
  if (tbdPattern.test(raw)) {
    return { start_time: null, end_time: null, status: "TBD", raw_text: raw };
  }

  const parts = raw.split(/\s*[–—-]\s*/);
  if (parts.length !== 2) {
    return { start_time: null, end_time: null, status: "ambiguous", raw_text: raw };
  }

  const end = normalizeTime(parts[1]);
  let start = normalizeTime(parts[0]);

  if (start.status === "ambiguous" && end.value) {
    const bareStart = parts[0].match(/^(\d{1,2})(?::(\d{2}))?$/);
    const endMeridiem = parts[1].match(/([ap]m)$/i);
    if (bareStart && endMeridiem) {
      const hour = Number(bareStart[1]);
      const minute = Number(bareStart[2] ?? 0);
      const endMinutes = Number(end.value.slice(0, 2)) * 60 + Number(end.value.slice(3));
      const candidates = ["am", "pm"]
        .map((meridiem) => twelveHourToMinutes(hour, minute, meridiem))
        .filter((value): value is number => value != null && value < endMinutes)
        .sort((a, b) => b - a);

      if (candidates[0] != null) {
        start = {
          value: minutesToTime(candidates[0]),
          status: "confirmed",
          raw_text: parts[0],
        };
      }
    }
  }

  if (!start.value || !end.value || start.value >= end.value) {
    return { start_time: null, end_time: null, status: "ambiguous", raw_text: raw };
  }

  return {
    start_time: start.value,
    end_time: end.value,
    status: "confirmed",
    raw_text: raw,
  };
}
