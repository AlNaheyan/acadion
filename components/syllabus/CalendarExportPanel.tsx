import { CalendarPlus, Download } from "lucide-react";

import { GoogleEventActions } from "../calendar/GoogleEventActions";
import { AssessmentCalendarAction } from "./AssessmentCalendarAction";
import { CalendarExportConfirmation } from "./CalendarExportConfirmation";
import { CalendarExportGuidance } from "./CalendarExportGuidance";
import { ClassCalendarAction } from "./ClassCalendarAction";
import type { ImportedSyllabusResponse } from "./upload-state";

export function CalendarExportPanel({ result }: { result: ImportedSyllabusResponse }) {
  return (
    <section id="calendar-export-options" aria-labelledby="calendar-export-title" className="mt-8 rounded-[1.75rem] border border-zinc-200 bg-white p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-zinc-950 text-white"><CalendarPlus aria-hidden="true" className="h-5 w-5" /></span>
        <div>
          <h2 id="calendar-export-title" className="text-lg font-semibold text-zinc-950">Add your course to a calendar</h2>
          <p className="mt-1 text-sm text-zinc-500">Use a connected account, or download standard calendar files.</p>
        </div>
      </div>

      <div className="mt-6">
        <GoogleEventActions result={result} />
      </div>

      <div className="mt-5 rounded-2xl bg-zinc-50 p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-semibold text-zinc-950"><Download aria-hidden="true" className="h-4 w-4" /> Download calendar files</h3>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <ClassCalendarAction result={result} />
          <AssessmentCalendarAction result={result} />
        </div>
      </div>

      <details className="mt-5 border-t border-zinc-200 pt-5">
        <summary className="cursor-pointer text-sm font-semibold text-zinc-700">Review exactly what will be exported</summary>
        <CalendarExportConfirmation result={result} />
        <CalendarExportGuidance result={result} />
      </details>
    </section>
  );
}
