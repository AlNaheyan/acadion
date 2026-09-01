import { describe, expect, it } from "vitest";

import type { Assessment, CourseExtraction } from "../schema";
import { deriveExtractionWarnings } from "./warnings";

function assessment(
  id: string,
  date_status: Assessment["date_status"],
): Assessment {
  return {
    id,
    type: id === "final" ? "final_exam" : "homework",
    title: id === "final" ? "Final Exam" : `Homework ${id.slice(2)}`,
    release_date: null,
    due_date: date_status === "confirmed" ? "2026-09-09" : null,
    date: null,
    due_time: null,
    start_time: null,
    end_time: null,
    location: null,
    coverage: null,
    date_status,
    raw_date_text: date_status === "ambiguous" ? "second week of October" : null,
    source: null,
  };
}

function extraction(assessments: Assessment[]): CourseExtraction {
  return {
    course: { name: null, code: "ECO 20250", section: null, semester: null, instructor: null },
    meetings: [],
    assessments,
    assessment_rules: [],
    metadata: { source_type: "syllabus", extraction_status: "success", warnings: [] },
  };
}

describe("deriveExtractionWarnings", () => {
  it("derives TBD, missing, and ambiguous warnings", () => {
    const result = deriveExtractionWarnings(
      extraction([
        assessment("final", "TBD"),
        assessment("hw1", "missing"),
        assessment("hw2", "ambiguous"),
      ]),
    );

    expect(result.metadata.warnings.map((warning) => warning.type)).toEqual([
      "TBD",
      "missing",
      "ambiguous",
    ]);
    expect(result.metadata.extraction_status).toBe("partial");
  });

  it("does not warn for confirmed assessments", () => {
    const result = deriveExtractionWarnings(extraction([assessment("hw1", "confirmed")]));
    expect(result.metadata.warnings).toEqual([]);
    expect(result.metadata.extraction_status).toBe("success");
  });

  it("preserves conflict warnings", () => {
    const input = extraction([assessment("hw1", "ambiguous")]);
    input.metadata.warnings.push({
      type: "conflict",
      message: "Homework 1 appears as September 9 and September 16.",
      assessment_id: "hw1",
      source: null,
    });

    const result = deriveExtractionWarnings(input);
    expect(result.metadata.warnings.map((warning) => warning.type)).toEqual([
      "conflict",
      "ambiguous",
    ]);
  });

  it("does not duplicate an existing warning for the same assessment and type", () => {
    const input = extraction([assessment("final", "TBD")]);
    input.metadata.warnings.push({
      type: "TBD",
      message: "Final date is not announced.",
      assessment_id: "final",
      source: null,
    });

    expect(deriveExtractionWarnings(input).metadata.warnings).toHaveLength(1);
  });

  it("does not replace a failed extraction status", () => {
    const input = extraction([assessment("final", "TBD")]);
    input.metadata.extraction_status = "failed";
    expect(deriveExtractionWarnings(input).metadata.extraction_status).toBe("failed");
  });
});
