import { CalendarCheck2, CalendarX2, ChevronDown, Quote } from "lucide-react";

import type { ImportedSyllabusResponse } from "./upload-state";
import { buildAssessmentDateReview, type AssessmentReviewItem } from "./date-review";
import { formatCourseTime, summarizeMeeting } from "./summary";

function Evidence({ item }: { item: AssessmentReviewItem }) {
  if (!item.evidence?.page && !item.evidence?.text) {
    return <p className="mt-3 text-xs text-zinc-500">No verified source snippet is available.</p>;
  }

  return (
    <div className="mt-3 rounded-xl bg-zinc-100 p-3 text-xs leading-5 text-zinc-600">
      <p className="flex items-center gap-1.5 font-semibold text-zinc-700">
        <Quote aria-hidden="true" className="h-3.5 w-3.5" />
        Why this date?{item.evidence.page ? ` Page ${item.evidence.page}` : ""}
      </p>
      {item.evidence.text && <blockquote className="mt-1">“{item.evidence.text}”</blockquote>}
    </div>
  );
}

export function ExtractedDatesReview({ result }: { result: ImportedSyllabusResponse }) {
  const review = buildAssessmentDateReview(result.assessments);

  return (
    <details className="group mt-6 rounded-3xl border border-zinc-200 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 font-semibold text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-950 sm:px-8">
        <span>Review extracted dates</span>
        <ChevronDown aria-hidden="true" className="h-5 w-5 transition-transform group-open:rotate-180" />
      </summary>

      <div className="border-t border-zinc-200 px-6 py-7 sm:px-8">
        <section aria-labelledby="review-meetings-title">
          <h2 id="review-meetings-title" className="text-lg font-semibold text-zinc-950">
            Recurring class meetings
          </h2>
          {result.meetings.length === 0 ? (
            <p className="mt-2 text-sm text-zinc-500">No recurring meetings were identified.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {result.meetings.map((meeting, index) => {
                const summary = summarizeMeeting(meeting);
                return (
                  <li key={`${summary.schedule}-${index}`} className="rounded-2xl border border-zinc-200 p-4">
                    <p className="font-medium text-zinc-950">{summary.schedule}</p>
                    <p className="mt-1 text-sm text-zinc-600">{summary.location}</p>
                    {summary.dateRange && <p className="mt-1 text-xs text-zinc-500">{summary.dateRange}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-2">
          <section aria-labelledby="confirmed-dates-title">
            <h2 id="confirmed-dates-title" className="flex items-center gap-2 text-lg font-semibold text-zinc-950">
              <CalendarCheck2 aria-hidden="true" className="h-5 w-5 text-emerald-600" />
              Confirmed dates
            </h2>
            {review.confirmed.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No confirmed assessment dates were found.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {review.confirmed.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4">
                    <p className="font-semibold text-zinc-950">{item.title}</p>
                    <ul className="mt-2 space-y-1 text-sm text-zinc-700">
                      {item.dates.map((date) => (
                        <li key={`${date.label}-${date.date}`}>
                          <span className="font-medium">{date.label}:</span> {date.date}
                          {date.time ? ` at ${formatCourseTime(date.time) ?? date.time}` : ""}
                        </li>
                      ))}
                    </ul>
                    <Evidence item={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="excluded-dates-title">
            <h2 id="excluded-dates-title" className="flex items-center gap-2 text-lg font-semibold text-zinc-950">
              <CalendarX2 aria-hidden="true" className="h-5 w-5 text-amber-600" />
              Excluded until confirmed
            </h2>
            {review.excluded.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-500">No assessments are excluded.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {review.excluded.map((item) => (
                  <li key={item.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-zinc-950">{item.title}</p>
                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-amber-800">
                        {item.status}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-700">
                      {item.rawDateText ?? "No usable date was provided."}
                    </p>
                    <Evidence item={item} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </details>
  );
}
