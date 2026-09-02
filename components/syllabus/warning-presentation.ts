import type { ExtractionWarning } from "../../lib/syllabus";

export type WarningSeverity = "attention" | "review" | "critical";

export interface WarningPresentation {
  severity: WarningSeverity;
  severityLabel: string;
  typeLabel: string;
}

const warningPresentations: Record<
  ExtractionWarning["type"],
  WarningPresentation
> = {
  TBD: {
    severity: "attention",
    severityLabel: "Not confirmed",
    typeLabel: "Date TBD",
  },
  missing: {
    severity: "attention",
    severityLabel: "Not confirmed",
    typeLabel: "Missing date",
  },
  ambiguous: {
    severity: "review",
    severityLabel: "Needs review",
    typeLabel: "Ambiguous date",
  },
  conflict: {
    severity: "critical",
    severityLabel: "Conflict",
    typeLabel: "Conflicting information",
  },
  source_mismatch: {
    severity: "critical",
    severityLabel: "Evidence issue",
    typeLabel: "Source could not be verified",
  },
  unsupported: {
    severity: "review",
    severityLabel: "Unsupported",
    typeLabel: "Unsupported information",
  },
};

export function presentWarning(
  warning: ExtractionWarning,
): WarningPresentation {
  return warningPresentations[warning.type];
}
