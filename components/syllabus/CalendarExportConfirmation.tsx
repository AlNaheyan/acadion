import { Check, Info, ShieldAlert } from "lucide-react";

import { buildCalendarExportConfirmation } from "./export-confirmation";
import type { ImportedSyllabusResponse } from "./upload-state";

export function CalendarExportConfirmation({ result }: { result: ImportedSyllabusResponse }) {
  const confirmation = buildCalendarExportConfirmation(result);

  return (
    <section aria-labelledby="export-confirmation-title" className="mt-5 rounded-2xl bg-zinc-50 p-5">
      <div className="flex items-start gap-3">
        <Info aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
        <div>
          <h3 id="export-confirmation-title" className="font-semibold text-zinc-950">
            Before you download
          </h3>
          <p className="mt-1 text-sm text-zinc-600">
            Each button creates a separate standard calendar file. Nothing is added automatically.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-sm font-semibold text-zinc-900">Class schedule includes</p>
          <p className="mt-2 flex items-center gap-2 text-sm text-zinc-700">
            <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
            {confirmation.meetingCount} recurring meeting {confirmation.meetingCount === 1 ? "pattern" : "patterns"}
          </p>
        </div>

        <div className="rounded-xl border border-zinc-200 bg-white p-4">
          <p className="text-sm font-semibold text-zinc-900">Assignments & exams include</p>
          {confirmation.assessmentGroups.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No confirmed dated events.</p>
          ) : (
            <ul className="mt-2 space-y-1.5 text-sm text-zinc-700">
              {confirmation.assessmentGroups.map((group) => (
                <li key={group.label} aria-label={group.ariaLabel} className="flex items-center gap-2">
                  <Check aria-hidden="true" className="h-4 w-4 text-emerald-600" />
                  {group.count} {group.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {confirmation.excluded.length > 0 && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-950">
            <ShieldAlert aria-hidden="true" className="h-4 w-4" />
            Excluded from assessment export
          </p>
          <ul className="mt-2 space-y-1 text-sm text-amber-900">
            {confirmation.excluded.map((item) => (
              <li key={item.id}>{item.title}: {item.reason}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
