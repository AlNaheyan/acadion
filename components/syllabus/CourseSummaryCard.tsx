import { CalendarDays, Clock3, MapPin, MoveDown, UserRound } from "lucide-react";

import type { ImportedSyllabusResponse } from "./upload-state";
import { summarizeCourse } from "./summary";

export function CourseSummaryCard({ result }: { result: ImportedSyllabusResponse }) {
  const summary = summarizeCourse(result.course, result.meetings);

  return (
    <section aria-labelledby="course-summary-title" className="flex h-full flex-col rounded-[1.75rem] bg-zinc-950 p-6 text-white shadow-xl sm:p-8">
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

      <div className="grid flex-1 gap-6 pt-6 md:grid-cols-2">
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

      <a href="#calendar-export-options" className="mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950">
        Add to calendar <MoveDown aria-hidden="true" className="h-4 w-4" />
      </a>
    </section>
  );
}
