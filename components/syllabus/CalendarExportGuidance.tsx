import { CircleHelp } from "lucide-react";

import { getCalendarExportGuidance } from "./export-guidance";
import type { ImportedSyllabusResponse } from "./upload-state";

export function CalendarExportGuidance({ result }: { result: ImportedSyllabusResponse }) {
  const guidance = getCalendarExportGuidance(result);
  if (guidance.length === 0) return null;

  return (
    <section aria-label="Calendar export help" className="mt-4 space-y-3">
      {guidance.map((item) => (
        <div key={item.code} role="status" className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sky-950">
          <CircleHelp aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
          <div>
            <p className="text-sm font-semibold">{item.title}</p>
            <p className="mt-1 text-sm leading-6">{item.message}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
