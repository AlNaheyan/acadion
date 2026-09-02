import { describe, expect, it } from "vitest";

import type { Assessment } from "../../lib/syllabus";
import { countAssessments } from "./assessment-counts";

function assessment(
  id: string,
  type: Assessment["type"],
  date: string | null = "2026-10-01",
): Assessment {
  return {
    id,
    type,
    title: id,
    release_date: null,
    due_date: null,
    date,
    due_time: null,
    start_time: null,
    end_time: null,
    location: null,
    coverage: null,
    date_status: date ? "confirmed" : "missing",
    raw_date_text: null,
    source: null,
  };
}

describe("countAssessments", () => {
  it("returns zeroes for an empty assessment list", () => {
    expect(countAssessments([])).toEqual({
      homework: 0,
      quizzes: 0,
      midterms: 0,
      examsAndFinals: 0,
      otherDated: 0,
    });
  });

  it("groups mixed assessments without double counting", () => {
    expect(
      countAssessments([
        assessment("hw-1", "homework"),
        assessment("hw-2", "homework"),
        assessment("quiz-1", "quiz"),
        assessment("midterm-1", "midterm"),
        assessment("exam-1", "exam"),
        assessment("final", "final_exam", null),
        assessment("project", "project"),
        assessment("paper-missing", "paper", null),
      ]),
    ).toEqual({
      homework: 2,
      quizzes: 1,
      midterms: 1,
      examsAndFinals: 2,
      otherDated: 1,
    });
  });
});
