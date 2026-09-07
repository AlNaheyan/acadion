import type { Assessment } from "../syllabus";

export interface AssessmentSchedule {
  date: string;
  startTime: string | null;
  endTime: string | null;
  kind: "event" | "deadline" | "release";
}

export function selectAssessmentSchedule(assessment: Assessment): AssessmentSchedule | null {
  if (assessment.due_date && assessment.due_time) {
    return { date: assessment.due_date, startTime: assessment.due_time, endTime: null, kind: "deadline" };
  }
  if (assessment.date) {
    return { date: assessment.date, startTime: assessment.start_time, endTime: assessment.end_time, kind: "event" };
  }
  if (assessment.due_date) {
    return { date: assessment.due_date, startTime: null, endTime: null, kind: "deadline" };
  }
  if (assessment.release_date) {
    return { date: assessment.release_date, startTime: null, endTime: null, kind: "release" };
  }
  return null;
}
