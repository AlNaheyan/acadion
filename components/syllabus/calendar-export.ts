import type { Meeting } from "../../lib/syllabus";

export type CalendarExportState =
  | { phase: "idle" }
  | { phase: "downloading" }
  | { phase: "success"; fileName: string }
  | { phase: "error"; code: string; message: string };

export type CalendarExportAction =
  | { type: "START" }
  | { type: "SUCCESS"; fileName: string }
  | { type: "ERROR"; code: string; message: string }
  | { type: "RESET" };

export function calendarExportReducer(
  _state: CalendarExportState,
  action: CalendarExportAction,
): CalendarExportState {
  switch (action.type) {
    case "START":
      return { phase: "downloading" };
    case "SUCCESS":
      return { phase: "success", fileName: action.fileName };
    case "ERROR":
      return { phase: "error", code: action.code, message: action.message };
    case "RESET":
      return { phase: "idle" };
  }
}

export class CalendarDownloadError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "CalendarDownloadError";
  }
}

export interface CalendarDownloadDependencies {
  fetcher: typeof fetch;
  save(blob: Blob, fileName: string): void;
}

function contentDispositionFilename(value: string | null): string | null {
  const match = value?.match(/filename="([^"\r\n]+)"/i);
  return match?.[1] ?? null;
}

function browserSave(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export async function downloadCalendar(
  endpoint: string,
  fallbackFileName: string,
  dependencies: CalendarDownloadDependencies = {
    fetcher: fetch,
    save: browserSave,
  },
): Promise<string> {
  const response = await dependencies.fetcher(endpoint, {
    method: "GET",
    headers: { Accept: "text/calendar" },
  });

  if (!response.ok) {
    let payload: { error?: { code?: string; message?: string } } = {};
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      // Fall through to the stable client-side error.
    }
    throw new CalendarDownloadError(
      payload.error?.code ?? "CALENDAR_DOWNLOAD_FAILED",
      payload.error?.message ?? "The calendar could not be downloaded.",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("text/calendar")) {
    throw new CalendarDownloadError(
      "INVALID_CALENDAR_RESPONSE",
      "The server returned an invalid calendar download.",
    );
  }

  const fileName =
    contentDispositionFilename(response.headers.get("content-disposition")) ??
    fallbackFileName;
  dependencies.save(await response.blob(), fileName);
  return fileName;
}

export function countExportableMeetings(meetings: Meeting[]): number {
  return meetings.filter(
    (meeting) =>
      meeting.start_time !== null &&
      meeting.end_time !== null &&
      meeting.start_date !== null &&
      meeting.end_date !== null &&
      meeting.start_date <= meeting.end_date,
  ).length;
}
