import { describe, expect, it } from "vitest";

import type { ExtractionWarning } from "../../lib/syllabus";
import { presentWarning } from "./warning-presentation";

function warning(type: ExtractionWarning["type"]): ExtractionWarning {
  return {
    type,
    message: "Review this item.",
    assessment_id: null,
    source: null,
  };
}

describe("warning presentation", () => {
  it.each([
    ["TBD", "Date TBD", "Not confirmed"],
    ["missing", "Missing date", "Not confirmed"],
    ["ambiguous", "Ambiguous date", "Needs review"],
    ["conflict", "Conflicting information", "Conflict"],
    ["source_mismatch", "Source could not be verified", "Evidence issue"],
    ["unsupported", "Unsupported information", "Unsupported"],
  ] as const)("labels %s distinctly", (type, typeLabel, severityLabel) => {
    expect(presentWarning(warning(type))).toMatchObject({
      typeLabel,
      severityLabel,
    });
  });
});
