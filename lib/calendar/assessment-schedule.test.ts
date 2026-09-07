import { describe, expect, it } from "vitest";
import type { Assessment } from "../syllabus";
import { selectAssessmentSchedule } from "./assessment-schedule";

const assessment: Assessment = {
  id: "hw1", type: "homework", title: "HW1", release_date: "2026-09-03",
  due_date: "2026-09-09", date: "2026-09-09", due_time: "20:00",
  start_time: null, end_time: null, location: null, coverage: null,
  date_status: "confirmed", raw_date_text: null, source: null,
};

describe("selectAssessmentSchedule", () => {
  it("prefers a timed deadline over a duplicate generic event date", () => {
    expect(selectAssessmentSchedule(assessment)).toEqual({ date: "2026-09-09", startTime: "20:00", endTime: null, kind: "deadline" });
  });

  it("preserves a timed exam event when no timed deadline exists", () => {
    expect(selectAssessmentSchedule({ ...assessment, type: "exam", due_date: null, due_time: null, date: "2026-10-01", start_time: "11:00", end_time: "12:15" }))
      .toEqual({ date: "2026-10-01", startTime: "11:00", endTime: "12:15", kind: "event" });
  });
});
