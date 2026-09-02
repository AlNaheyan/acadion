import type { Assessment } from "../../lib/syllabus";

export interface ReviewDate {
  label: "Released" | "Due" | "Event";
  date: string;
  time: string | null;
}

export interface AssessmentReviewItem {
  id: string;
  title: string;
  type: Assessment["type"];
  status: Assessment["date_status"];
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
): AssessmentDateReview {
  const review: AssessmentDateReview = { confirmed: [], excluded: [] };

  for (const assessment of assessments) {
    const item: AssessmentReviewItem = {
      id: assessment.id,
      title: assessment.title,
      type: assessment.type,
      status: assessment.date_status,
      dates: reviewDates(assessment),
      rawDateText: assessment.raw_date_text,
      evidence: assessment.source,
    };

    if (assessment.date_status === "confirmed" && item.dates.length > 0) {
      review.confirmed.push(item);
    } else {
      review.excluded.push(item);
    }
  }

  return review;
}
