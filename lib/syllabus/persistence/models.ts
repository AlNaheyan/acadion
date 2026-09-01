import type {
  CourseExtraction,
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
