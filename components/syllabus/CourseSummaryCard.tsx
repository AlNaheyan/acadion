import { CalendarDays, Clock3, MapPin, UserRound } from "lucide-react";

import type { ImportedSyllabusResponse } from "./upload-state";
import { countAssessments } from "./assessment-counts";
import { summarizeCourse } from "./summary";

export function CourseSummaryCard({ result }: { result: ImportedSyllabusResponse }) {
  const summary = summarizeCourse(result.course, result.meetings);
  const counts = countAssessments(result.assessments);
  const assessmentCounts = [
    ["Homework", counts.homework],
    ["Quizzes", counts.quizzes],
    ["Midterms", counts.midterms],
    ["Exams & finals", counts.examsAndFinals],
    ["Other dated", counts.otherDated],
  ] as const;

  return (
    <section aria-labelledby="course-summary-title" className="mt-8 rounded-3xl bg-zinc-950 p-6 text-white shadow-xl sm:p-8">
      <div className="flex flex-col justify-between gap-5 border-b border-white/15 pb-6 sm:flex-row sm:items-start">
        <div>
          {summary.code && (
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-400">
              {summary.code}{summary.section ? ` · Section ${summary.section}` : ""}
            </p>
          )}
          <h2 id="course-summary-title" className="text-3xl font-semibold tracking-tight">
            {summary.name}
          </h2>
          {summary.semester && <p className="mt-2 text-zinc-300">{summary.semester}</p>}
        </div>
        <span className="w-fit rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
          Imported
        </span>
      </div>

      <div className="grid gap-6 pt-6 md:grid-cols-2">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <CalendarDays aria-hidden="true" className="h-4 w-4" />
            Class meetings
          </h3>
          {summary.meetings.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-400">No class meetings were identified.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {summary.meetings.map((meeting, index) => (
                <li key={`${meeting.schedule}-${index}`} className="rounded-2xl bg-white/5 p-4">
                  <p className="flex items-start gap-2 font-medium">
                    <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                    {meeting.schedule}
                  </p>
                  <p className="mt-2 flex items-start gap-2 text-sm text-zinc-300">
                    <MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-zinc-500" />
                    {meeting.location}
                  </p>
                  {meeting.dateRange && <p className="mt-2 text-xs text-zinc-500">{meeting.dateRange}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-300">
            <UserRound aria-hidden="true" className="h-4 w-4" />
            Instructor
          </h3>
          <p className="mt-3 text-base text-zinc-100">
            {summary.instructor ?? "Instructor not identified"}
          </p>
        </div>
      </div>

      <div className="mt-6 border-t border-white/15 pt-6">
        <h3 className="text-sm font-semibold text-zinc-300">Assessment overview</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {assessmentCounts.map(([label, count]) => (
            <div key={label} className="rounded-2xl bg-white/5 p-4">
              <dt className="text-xs leading-5 text-zinc-400">{label}</dt>
              <dd className="mt-1 text-2xl font-semibold text-white">{count}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
