import { describe, expect, it, vi } from "vitest";

import type { Meeting } from "../../lib/syllabus";
import {
  CalendarDownloadError,
  calendarExportReducer,
  countAssessmentExports,
  countExportableMeetings,
  downloadCalendar,
} from "./calendar-export";

const meeting: Meeting = {
  days: ["MONDAY"],
  start_time: "09:30",
  end_time: "10:45",
  location: null,
  start_date: "2026-08-24",
  end_date: "2026-12-14",
};

describe("class calendar export client", () => {
  it("counts only complete meeting recurrences", () => {
    expect(
      countExportableMeetings([
        meeting,
        { ...meeting, start_time: null },
        { ...meeting, start_date: null },
      ]),
    ).toBe(1);
    expect(countExportableMeetings([])).toBe(0);
  });

  it("tracks downloading, success, and error states", () => {
    expect(calendarExportReducer({ phase: "idle" }, { type: "START" })).toEqual({
      phase: "downloading",
    });
    expect(
      calendarExportReducer(
        { phase: "downloading" },
        { type: "SUCCESS", fileName: "classes.ics" },
      ),
    ).toEqual({ phase: "success", fileName: "classes.ics" });
    expect(
      calendarExportReducer(
        { phase: "downloading" },
        { type: "ERROR", code: "FAILED", message: "Try again." },
      ),
    ).toEqual({ phase: "error", code: "FAILED", message: "Try again." });
  });

  it("downloads calendar content using the server attachment name", async () => {
    const save = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(
      new Response("BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n", {
        status: 200,
        headers: {
          "Content-Type": "text/calendar; charset=utf-8",
          "Content-Disposition": 'attachment; filename="eco-classes.ics"',
        },
      }),
    );

    await expect(
      downloadCalendar("/calendar/classes.ics", "classes.ics", {
        fetcher,
        save,
      }),
    ).resolves.toBe("eco-classes.ics");
    expect(fetcher).toHaveBeenCalledWith("/calendar/classes.ics", {
      method: "GET",
      headers: { Accept: "text/calendar" },
    });
    expect(save).toHaveBeenCalledWith(expect.any(Blob), "eco-classes.ics");
  });

  it("preserves stable server failures without saving a file", async () => {
    const save = vi.fn();
    const fetcher = vi.fn().mockResolvedValue(
      Response.json(
        {
          error: {
            code: "NO_EXPORTABLE_MEETINGS",
            message: "No meetings are available.",
          },
        },
        { status: 422 },
      ),
    );

    await expect(
      downloadCalendar("/calendar/classes.ics", "classes.ics", {
        fetcher,
        save,
      }),
    ).rejects.toEqual(
      new CalendarDownloadError(
        "NO_EXPORTABLE_MEETINGS",
        "No meetings are available.",
      ),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it("counts only safe confirmed assessment events", () => {
    const base = {
      id: "midterm-1",
      type: "midterm" as const,
      title: "Midterm 1",
      release_date: null,
      due_date: null,
      date: "2026-10-01",
      due_time: null,
      start_time: null,
      end_time: null,
      location: null,
      coverage: null,
      date_status: "confirmed" as const,
      raw_date_text: null,
      source: null,
    };
    expect(
      countAssessmentExports(
        [
          base,
          { ...base, id: "exam-2" },
          {
            ...base,
            id: "final",
            date: null,
            date_status: "TBD",
          },
        ],
        [
          {
            type: "conflict",
            message: "Conflicting exam date.",
            assessment_id: "exam-2",
            source: null,
          },
        ],
      ),
    ).toEqual({ included: 1, excluded: 2 });
  });
});
