import { describe, expect, it } from "vitest";

import type { Assessment } from "../../lib/syllabus";
import { buildAssessmentDateReview } from "./date-review";

const confirmed: Assessment = {
  id: "homework-1",
  type: "homework",
  title: "Homework 1",
  release_date: "2026-09-01",
  due_date: "2026-09-08",
  date: null,
  due_time: "23:59",
  start_time: null,
  end_time: null,
  location: null,
  coverage: null,
  date_status: "confirmed",
  raw_date_text: "Released Sep 1, due Sep 8 at 11:59 PM",
  source: { page: 4, text: "Homework 1 due Sep 8 at 11:59 PM" },
};

const excluded: Assessment = {
  ...confirmed,
  id: "final-exam",
  type: "final_exam",
  title: "Final Exam",
  release_date: null,
  due_date: null,
  due_time: null,
  date_status: "TBD",
  raw_date_text: "Final exam TBD",
  source: { page: 7, text: "Final exam date TBD" },
};

describe("buildAssessmentDateReview", () => {
  it("keeps confirmed dates and excluded assessments separate", () => {
    const review = buildAssessmentDateReview([confirmed, excluded]);

    expect(review.confirmed).toEqual([
      expect.objectContaining({
        id: "homework-1",
        dates: [
          { label: "Released", date: "2026-09-01", time: null },
          { label: "Due", date: "2026-09-08", time: "23:59" },
        ],
        evidence: { page: 4, text: "Homework 1 due Sep 8 at 11:59 PM" },
      }),
    ]);
    expect(review.excluded).toEqual([
      expect.objectContaining({
        id: "final-exam",
        status: "TBD",
        dates: [],
        evidence: { page: 7, text: "Final exam date TBD" },
      }),
    ]);
  });

  it("returns empty groups when no assessments exist", () => {
    expect(buildAssessmentDateReview([])).toEqual({
      confirmed: [],
      excluded: [],
    });
  });

  it("moves a confirmed date with unverified evidence out of the trusted list", () => {
    const review = buildAssessmentDateReview([confirmed], [{
      type: "source_mismatch", message: "Evidence missing", assessment_id: confirmed.id, source: null,
    }]);
    expect(review.confirmed).toEqual([]);
    expect(review.excluded[0]).toMatchObject({ id: confirmed.id, status: "unverified" });
  });
});
