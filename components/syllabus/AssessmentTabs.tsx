"use client";

import { useMemo, useState } from "react";
import { CalendarDays, FileWarning } from "lucide-react";

import type { ImportedSyllabusResponse } from "./upload-state";
import { assessmentTabs, assessmentsForTab, type AssessmentTab } from "./assessment-tabs";
import { formatCourseTime } from "./summary";

function dateSummary(assessment: ImportedSyllabusResponse["assessments"][number]): string {
  if (assessment.due_date) return `${assessment.due_date}${assessment.due_time ? ` · ${formatCourseTime(assessment.due_time)}` : ""}`;
  if (assessment.date) return `${assessment.date}${assessment.start_time ? ` · ${formatCourseTime(assessment.start_time)}` : ""}`;
  if (assessment.release_date) return assessment.release_date;
  return assessment.raw_date_text ?? "No date provided";
}

export function AssessmentTabs({ result }: { result: ImportedSyllabusResponse }) {
  const firstPopulated = assessmentTabs.find((tab) => assessmentsForTab(result.assessments, tab.id).length > 0)?.id ?? "exams";
  const [activeTab, setActiveTab] = useState<AssessmentTab>(firstPopulated);
  const items = useMemo(() => assessmentsForTab(result.assessments, activeTab), [activeTab, result.assessments]);
  const blockedIds = new Set(result.warnings.filter((warning) => warning.type === "source_mismatch" || warning.type === "conflict").map((warning) => warning.assessment_id));

  return (
    <section aria-labelledby="assessment-table-title" className="mt-8 overflow-hidden rounded-[1.75rem] border border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="mb-5 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-zinc-100"><CalendarDays aria-hidden="true" className="h-5 w-5" /></span>
          <div>
            <h2 id="assessment-table-title" className="text-lg font-semibold text-zinc-950">Extracted dates</h2>
            <p className="text-sm text-zinc-500">Review every item before adding it to a calendar.</p>
          </div>
        </div>
        <div role="tablist" aria-label="Assessment categories" className="flex gap-1 overflow-x-auto">
          {assessmentTabs.map((tab) => {
            const count = assessmentsForTab(result.assessments, tab.id).length;
            return <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-semibold transition ${activeTab === tab.id ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-800"}`}>
              {tab.label} <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs">{count}</span>
            </button>;
          })}
        </div>
      </div>

      <div role="tabpanel" className="min-h-64 overflow-x-auto p-5 sm:p-7">
        {items.length === 0 ? <div className="grid min-h-44 place-items-center text-center"><div><FileWarning aria-hidden="true" className="mx-auto h-6 w-6 text-zinc-400" /><p className="mt-2 text-sm font-medium text-zinc-700">No {activeTab} found in this syllabus.</p></div></div> : (
          <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left text-sm">
            <thead><tr className="text-xs uppercase tracking-wide text-zinc-500">
              <th className="border-b border-zinc-200 px-3 pb-3 font-semibold">Item</th><th className="border-b border-zinc-200 px-3 pb-3 font-semibold">Date & time</th><th className="border-b border-zinc-200 px-3 pb-3 font-semibold">Status</th><th className="border-b border-zinc-200 px-3 pb-3 font-semibold">Source</th>
            </tr></thead>
            <tbody>{items.map((assessment) => {
              const blocked = blockedIds.has(assessment.id); const trusted = assessment.date_status === "confirmed" && !blocked;
              return <tr key={assessment.id} className="align-top">
                <td className="border-b border-zinc-100 px-3 py-4"><p className="font-semibold text-zinc-950">{assessment.title}</p><p className="mt-1 capitalize text-zinc-500">{assessment.type.replaceAll("_", " ")}</p></td>
                <td className="border-b border-zinc-100 px-3 py-4 font-medium text-zinc-800">{dateSummary(assessment)}</td>
                <td className="border-b border-zinc-100 px-3 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${trusted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>{trusted ? "Confirmed" : blocked ? "Needs review" : assessment.date_status}</span></td>
                <td className="max-w-xs border-b border-zinc-100 px-3 py-4 text-zinc-500">{assessment.source?.text ? <><span className="line-clamp-2">“{assessment.source.text}”</span>{assessment.source.page && <span className="mt-1 block text-xs">Page {assessment.source.page}</span>}</> : "No verified source"}</td>
              </tr>;
            })}</tbody>
          </table>
        )}
      </div>
    </section>
  );
}
