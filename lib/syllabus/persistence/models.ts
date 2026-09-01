import type {
  CourseExtraction,
  Assessment,
  AssessmentRule,
  AssessmentType,
  DateStatus,
  ExtractionWarning,
  Meeting,
  MeetingDay,
} from "../schema";

export interface ImportedCourseRow {
  id: string;
  user_id: string;
  code: string | null;
  name: string | null;
  section: string | null;
  semester: string | null;
  instructor: string | null;
  extraction_status: "success" | "partial" | "failed";
  extraction_warnings: ExtractionWarning[];
  created_at: string;
  updated_at: string;
}

export type ImportedCourseInsert = Omit<
  ImportedCourseRow,
  "id" | "created_at" | "updated_at"
>;

export function courseExtractionToInsert(
  userId: string,
  extraction: CourseExtraction,
): ImportedCourseInsert {
  return {
    user_id: userId,
    ...extraction.course,
    extraction_status: extraction.metadata.extraction_status,
    extraction_warnings: extraction.metadata.warnings,
  };
}

export interface CourseMeetingRow {
  id: string;
  course_id: string;
  day: MeetingDay;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export type CourseMeetingInsert = Omit<
  CourseMeetingRow,
  "id" | "created_at" | "updated_at"
>;

export function meetingsToInserts(
  courseId: string,
  meetings: Meeting[],
): CourseMeetingInsert[] {
  return meetings.flatMap((meeting) =>
    meeting.days.map((day) => ({
      course_id: courseId,
      day,
      start_time: meeting.start_time,
      end_time: meeting.end_time,
      location: meeting.location,
      start_date: meeting.start_date,
      end_date: meeting.end_date,
    })),
  );
}

export interface CourseAssessmentRow {
  id: string;
  course_id: string;
  external_id: string;
  type: AssessmentType;
  title: string;
  release_date: string | null;
  due_date: string | null;
  event_date: string | null;
  due_time: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  coverage: string | null;
  date_status: DateStatus;
  raw_date_text: string | null;
  source_page: number | null;
  source_text: string | null;
  created_at: string;
  updated_at: string;
}

export type CourseAssessmentInsert = Omit<
  CourseAssessmentRow,
  "id" | "created_at" | "updated_at"
>;

export function assessmentsToInserts(
  courseId: string,
  assessments: Assessment[],
): CourseAssessmentInsert[] {
  return assessments.map((assessment) => ({
    course_id: courseId,
    external_id: assessment.id,
    type: assessment.type,
    title: assessment.title,
    release_date: assessment.release_date,
    due_date: assessment.due_date,
    event_date: assessment.date,
    due_time: assessment.due_time,
    start_time: assessment.start_time,
    end_time: assessment.end_time,
    location: assessment.location,
    coverage: assessment.coverage,
    date_status: assessment.date_status,
    raw_date_text: assessment.raw_date_text,
    source_page: assessment.source?.page ?? null,
    source_text: assessment.source?.text ?? null,
  }));
}

export interface AssessmentRuleRow {
  id: string;
  course_id: string;
  type: AssessmentType;
  rule: string;
  source_page: number | null;
  source_text: string | null;
  created_at: string;
}

export type AssessmentRuleInsert = Omit<AssessmentRuleRow, "id" | "created_at">;

export function assessmentRulesToInserts(
  courseId: string,
  rules: AssessmentRule[],
): AssessmentRuleInsert[] {
  return rules.map((rule) => ({
    course_id: courseId,
    type: rule.type,
    rule: rule.rule,
    source_page: rule.source?.page ?? null,
    source_text: rule.source?.text ?? null,
  }));
}
