"use client";

import { useReducer } from "react";
import { CalendarPlus, LoaderCircle } from "lucide-react";

import { Button } from "../ui/button";
import {
  CalendarDownloadError,
  calendarExportReducer,
  countExportableMeetings,
  downloadCalendar,
} from "./calendar-export";
import type { ImportedSyllabusResponse } from "./upload-state";

export function ClassCalendarAction({ result }: { result: ImportedSyllabusResponse }) {
  const [state, dispatch] = useReducer(calendarExportReducer, { phase: "idle" });
  const count = countExportableMeetings(result.meetings);
  const isDownloading = state.phase === "downloading";

  async function startDownload() {
    if (count === 0 || isDownloading) return;
    dispatch({ type: "START" });
    try {
      const fileName = await downloadCalendar(
        `/api/courses/${encodeURIComponent(result.course_id)}/calendar/classes.ics`,
        "class-schedule.ics",
      );
      dispatch({ type: "SUCCESS", fileName });
    } catch (error) {
      const safeError =
        error instanceof CalendarDownloadError
          ? error
          : new CalendarDownloadError(
              "CALENDAR_DOWNLOAD_FAILED",
              "The class calendar could not be downloaded.",
            );
      dispatch({ type: "ERROR", code: safeError.code, message: safeError.message });
    }
  }

  return (
    <div>
      <Button
        type="button"
        onClick={startDownload}
        disabled={count === 0 || isDownloading}
        aria-describedby="class-calendar-description"
        className="h-11 w-full rounded-xl sm:w-auto"
      >
        {isDownloading ? (
          <LoaderCircle aria-hidden="true" className="animate-spin" />
        ) : (
          <CalendarPlus aria-hidden="true" />
        )}
        {isDownloading ? "Preparing schedule…" : "Add Class Schedule"}
      </Button>
      <p id="class-calendar-description" className="mt-2 text-sm text-zinc-600">
        {count === 0
          ? "No complete recurring class meetings are available."
          : `${count} recurring meeting ${count === 1 ? "pattern" : "patterns"} will be included.`}
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
