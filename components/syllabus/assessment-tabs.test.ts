import { describe, expect, it } from "vitest";
import type { Assessment } from "../../lib/syllabus";
import { assessmentTabFor, assessmentsForTab } from "./assessment-tabs";

const item = (type: Assessment["type"]): Assessment => ({
  id: type, type, title: type, release_date: null, due_date: "2026-10-01", date: null,
  due_time: "23:59", start_time: null, end_time: null, location: null, coverage: null,
  date_status: "confirmed", raw_date_text: null, source: null,
});

describe("assessment tabs", () => {
  it.each([
    ["midterm", "exams"], ["exam", "exams"], ["final_exam", "exams"],
    ["homework", "homework"], ["quiz", "quizzes"], ["project", "others"],
  ] as const)("groups %s under %s", (type, tab) => {
    expect(assessmentTabFor(type)).toBe(tab);
  });

  it("filters without dropping other assessment types", () => {
    const values = [item("homework"), item("quiz"), item("paper")];
    expect(assessmentsForTab(values, "others").map(({ type }) => type)).toEqual(["paper"]);
  });
});
