import { AlertTriangle, CheckCircle2 } from "lucide-react";

import type { ImportedSyllabusResponse } from "./upload-state";
import { presentWarning, type WarningSeverity } from "./warning-presentation";

const severityClasses: Record<WarningSeverity, string> = {
  attention: "border-amber-200 bg-amber-50 text-amber-950",
  review: "border-orange-200 bg-orange-50 text-orange-950",
  critical: "border-red-200 bg-red-50 text-red-950",
};

export function ExtractionWarnings({
  warnings,
  assessments,
}: Pick<ImportedSyllabusResponse, "warnings" | "assessments">) {
  if (warnings.length === 0) {
    return (
      <section aria-label="Extraction status" className="mt-6 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        <CheckCircle2 aria-hidden="true" className="h-5 w-5 shrink-0" />
        No extraction warnings were found. Review the dates before exporting.
      </section>
    );
  }

  const assessmentTitles = new Map(
    assessments.map((assessment) => [assessment.id, assessment.title]),
  );

  return (
    <section aria-labelledby="extraction-warnings-title" className="mt-6 rounded-3xl border border-amber-200 bg-white p-6 sm:p-8">
      <div className="flex items-start gap-3">
        <AlertTriangle aria-hidden="true" className="mt-1 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <h2 id="extraction-warnings-title" className="text-xl font-semibold text-zinc-950">
            Review uncertain information
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600">
            These items are not confirmed and will remain separate from trusted calendar dates.
          </p>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {warnings.map((warning, index) => {
          const presentation = presentWarning(warning);
          const affectedTitle = warning.assessment_id
            ? assessmentTitles.get(warning.assessment_id)
            : null;

          return (
            <li
              key={`${warning.type}-${warning.assessment_id ?? "general"}-${index}`}
              className={`rounded-2xl border p-4 ${severityClasses[presentation.severity]}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-semibold">
                  {presentation.severityLabel}
                </span>
                <span className="text-sm font-semibold">{presentation.typeLabel}</span>
              </div>
              {affectedTitle && (
                <p className="mt-3 text-sm font-semibold">Affected item: {affectedTitle}</p>
              )}
              <p className="mt-1 text-sm leading-6">{warning.message}</p>
              {warning.source?.page && (
                <p className="mt-2 text-xs opacity-75">Source page {warning.source.page}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
