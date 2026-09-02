import type { Assessment, ExtractionWarning } from "../../lib/syllabus";

export interface ReviewDate {
  label: "Released" | "Due" | "Event";
  date: string;
  time: string | null;
}

export interface AssessmentReviewItem {
  id: string;
  title: string;
  type: Assessment["type"];
  status: Assessment["date_status"] | "unverified";
  dates: ReviewDate[];
  rawDateText: string | null;
  evidence: Assessment["source"];
}

export interface AssessmentDateReview {
  confirmed: AssessmentReviewItem[];
  excluded: AssessmentReviewItem[];
}

function reviewDates(assessment: Assessment): ReviewDate[] {
  const dates: ReviewDate[] = [];
  if (assessment.release_date) {
    dates.push({ label: "Released", date: assessment.release_date, time: null });
  }
  if (assessment.due_date) {
    dates.push({
      label: "Due",
      date: assessment.due_date,
      time: assessment.due_time,
    });
  }
  if (assessment.date) {
    dates.push({
      label: "Event",
      date: assessment.date,
      time: assessment.start_time,
    });
  }
  return dates;
}

export function buildAssessmentDateReview(
  assessments: Assessment[],
  warnings: ExtractionWarning[] = [],
): AssessmentDateReview {
  const review: AssessmentDateReview = { confirmed: [], excluded: [] };
  const blockedIds = new Set(
    warnings
      .filter((warning) => warning.type === "source_mismatch" || warning.type === "conflict")
      .map((warning) => warning.assessment_id)
      .filter((id): id is string => id !== null),
  );

  for (const assessment of assessments) {
    const item: AssessmentReviewItem = {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      status: blockedIds.has(assessment.id) ? "unverified" : assessment.date_status,
      dates: reviewDates(assessment),
      rawDateText: assessment.raw_date_text,
      evidence: assessment.source,
    };

    if (item.status === "confirmed" && item.dates.length > 0) {
      review.confirmed.push(item);
    } else {
      review.excluded.push(item);
    }
  }

  return review;
}
