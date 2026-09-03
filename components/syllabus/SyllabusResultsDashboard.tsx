import { CalendarConnectionsPanel } from "../calendar/CalendarConnectionsPanel";
import { AssessmentTabs } from "./AssessmentTabs";
import { CalendarExportPanel } from "./CalendarExportPanel";
import { CourseSummaryCard } from "./CourseSummaryCard";
import type { ImportedSyllabusResponse } from "./upload-state";

export function SyllabusResultsDashboard({ result }: { result: ImportedSyllabusResponse }) {
  return (
    <section aria-label="Imported syllabus results" className="mt-8 rounded-[2.25rem] border border-zinc-200 bg-zinc-100/70 p-4 shadow-sm sm:p-6 lg:p-8">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,0.8fr)]">
        <CourseSummaryCard result={result} />
        <CalendarConnectionsPanel />
      </div>
      <AssessmentTabs result={result} />
      <CalendarExportPanel result={result} />
    </section>
  );
}
