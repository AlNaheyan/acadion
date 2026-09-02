import type {
  Assessment,
  ExtractionWarning,
  Meeting,
} from "../../lib/syllabus";

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

export interface AssessmentExportCounts {
  included: number;
  excluded: number;
}

export interface ExcludedAssessmentExport {
  assessment: Assessment;
  reason: string;
}

export interface ClassifiedAssessmentExports {
  included: Assessment[];
  excluded: ExcludedAssessmentExport[];
}

export function classifyAssessmentExports(
  assessments: Assessment[],
  warnings: ExtractionWarning[],
): ClassifiedAssessmentExports {
  const unsafeTypeReason: Partial<
    Record<ExtractionWarning["type"], string>
  > = {
    conflict: "Conflicting information",
    source_mismatch: "Source evidence could not be verified",
    unsupported: "Unsupported information",
  };
  const globalBlock = warnings.find(
    (warning) => unsafeTypeReason[warning.type] && !warning.assessment_id,
  );
  const warningByAssessment = new Map<string, ExtractionWarning>();
  for (const warning of warnings) {
    if (
      warning.assessment_id &&
      unsafeTypeReason[warning.type] &&
      !warningByAssessment.has(warning.assessment_id)
    ) {
      warningByAssessment.set(warning.assessment_id, warning);
    }
  }

  const included: Assessment[] = [];
  const excluded: ExcludedAssessmentExport[] = [];
  for (const assessment of assessments) {
    const unsafeWarning = warningByAssessment.get(assessment.id) ?? globalBlock;
    let reason: string | null = null;

    if (unsafeWarning) {
      reason = unsafeTypeReason[unsafeWarning.type] ?? "Unsafe extraction";
    } else if (assessment.date_status === "TBD") {
      reason = "Date is TBD";
    } else if (assessment.date_status === "missing") {
      reason = "Date is missing";
    } else if (assessment.date_status === "ambiguous") {
      reason = "Date is ambiguous";
    } else if (
      !assessment.date &&
      !assessment.due_date &&
      !assessment.release_date
    ) {
      reason = "No confirmed date";
    }

    if (reason) excluded.push({ assessment, reason });
    else included.push(assessment);
  }

  return { included, excluded };
}

export function countAssessmentExports(
  assessments: Assessment[],
  warnings: ExtractionWarning[],
): AssessmentExportCounts {
  const classified = classifyAssessmentExports(assessments, warnings);
  return {
    included: classified.included.length,
    excluded: classified.excluded.length,
  };
}
