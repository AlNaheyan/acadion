"use client";

import { useReducer } from "react";
import { CalendarRange, LoaderCircle } from "lucide-react";

import { Button } from "../ui/button";
import {
  CalendarDownloadError,
  calendarExportReducer,
  countAssessmentExports,
  downloadCalendar,
} from "./calendar-export";
import type { ImportedSyllabusResponse } from "./upload-state";

export function AssessmentCalendarAction({ result }: { result: ImportedSyllabusResponse }) {
  const [state, dispatch] = useReducer(calendarExportReducer, { phase: "idle" });
  const counts = countAssessmentExports(result.assessments, result.warnings);
  const isDownloading = state.phase === "downloading";

  async function startDownload() {
    if (counts.included === 0 || isDownloading) return;
    dispatch({ type: "START" });
    try {
      const fileName = await downloadCalendar(
        `/api/courses/${encodeURIComponent(result.course_id)}/calendar/assessments.ics`,
        "assignments-and-exams.ics",
      );
      dispatch({ type: "SUCCESS", fileName });
    } catch (error) {
      const safeError =
        error instanceof CalendarDownloadError
          ? error
          : new CalendarDownloadError(
              "CALENDAR_DOWNLOAD_FAILED",
              "The assessment calendar could not be downloaded.",
            );
      dispatch({ type: "ERROR", code: safeError.code, message: safeError.message });
    }
  }

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        onClick={startDownload}
        disabled={counts.included === 0 || isDownloading}
        aria-describedby="assessment-calendar-description"
        className="h-11 w-full rounded-xl sm:w-auto"
      >
        {isDownloading ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <CalendarRange aria-hidden="true" />
        )}
        {isDownloading ? "Preparing events…" : "Add Assignments & Exams"}
      </Button>
      <p id="assessment-calendar-description" className="mt-2 text-sm text-zinc-600">
        {counts.included === 0
          ? "No confirmed assessment dates are available."
          : `${counts.included} confirmed ${counts.included === 1 ? "event" : "events"} will be included.`}
        {counts.excluded > 0
          ? ` ${counts.excluded} unconfirmed or unsafe ${counts.excluded === 1 ? "item is" : "items are"} excluded.`
          : ""}
      </p>
      <div aria-live="polite" className="mt-2 text-sm">
        {state.phase === "success" && (
          <p className="text-emerald-700">Downloaded {state.fileName}.</p>
        )}
        {state.phase === "error" && (
          <p role="alert" className="text-red-700">{state.message}</p>
        )}
      </div>
    </div>
  );
}
