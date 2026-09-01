import { z } from "zod";

import {
  assessmentRuleSchema,
  assessmentSchema,
  courseSchema,
  extractionWarningSchema,
  meetingDaySchema,
  type AssessmentRule,
  type CourseExtraction,
  type Meeting,
} from "../schema";
import { validateCourseExtraction } from "../validate";

const storedCourseSchema = z.object({
  id: z.string().min(1),
  code: z.string().nullable(),
  name: z.string().nullable(),
  section: z.string().nullable(),
  semester: z.string().nullable(),
  instructor: z.string().nullable(),
  extraction_status: z.enum(["success", "partial", "failed"]),
  extraction_warnings: z.array(extractionWarningSchema),
  course_meetings: z.array(
    z.object({
      day: meetingDaySchema,
      start_time: z.string().nullable(),
      end_time: z.string().nullable(),
      location: z.string().nullable(),
      start_date: z.string().nullable(),
      end_date: z.string().nullable(),
    }),
  ),
  course_assessments: z.array(
    z.object({
      external_id: z.string(),
      type: assessmentSchema.shape.type,
      title: z.string(),
      release_date: z.string().nullable(),
      due_date: z.string().nullable(),
      event_date: z.string().nullable(),
      due_time: z.string().nullable(),
      start_time: z.string().nullable(),
      end_time: z.string().nullable(),
      location: z.string().nullable(),
      coverage: z.string().nullable(),
      date_status: assessmentSchema.shape.date_status,
      raw_date_text: z.string().nullable(),
      source_page: z.number().int().nullable(),
      source_text: z.string().nullable(),
    }),
  ),
  assessment_rules: z.array(
    z.object({
      type: assessmentRuleSchema.shape.type,
      rule: z.string(),
      source_page: z.number().int().nullable(),
      source_text: z.string().nullable(),
    }),
  ),
});

export const IMPORTED_COURSE_SELECT = `
  id,
  code,
  name,
  section,
  semester,
  instructor,
  extraction_status,
  extraction_warnings,
  course_meetings (day, start_time, end_time, location, start_date, end_date),
  course_assessments (
    external_id, type, title, release_date, due_date, event_date,
    due_time, start_time, end_time, location, coverage, date_status,
    raw_date_text, source_page, source_text
  ),
  assessment_rules (type, rule, source_page, source_text)
`;

interface CourseReadQuery {
  eq(column: string, value: string): CourseReadQuery;
  maybeSingle(): PromiseLike<{
    data: unknown;
    error: { message: string } | null;
  }>;
}

export interface CourseReadClient {
  from(table: "imported_courses"): {
    select(columns: string): CourseReadQuery;
  };
}

export type CourseReadErrorCode =
  | "COURSE_NOT_FOUND"
  | "COURSE_QUERY_FAILED"
  | "INVALID_STORED_COURSE";

export class CourseReadError extends Error {
  constructor(
    public readonly code: CourseReadErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "CourseReadError";
  }
}

export interface ImportedCourseView {
  course_id: string;
  course: CourseExtraction["course"];
  meetings: Meeting[];
  assessments: CourseExtraction["assessments"];
  assessment_rules: AssessmentRule[];
  warnings: CourseExtraction["metadata"]["warnings"];
}

function normalizeDatabaseTime(value: string | null): string | null {
  return value?.slice(0, 5) ?? null;
}

function sourceEvidence(page: number | null, text: string | null) {
  return page === null && text === null ? null : { page, text };
}

function groupMeetings(
  rows: z.infer<typeof storedCourseSchema>["course_meetings"],
): Meeting[] {
  const grouped = new Map<string, Meeting>();

  for (const row of rows) {
    const meeting = {
      days: [row.day],
      start_time: normalizeDatabaseTime(row.start_time),
      end_time: normalizeDatabaseTime(row.end_time),
      location: row.location,
      start_date: row.start_date,
      end_date: row.end_date,
    } satisfies Meeting;
    const key = JSON.stringify({ ...meeting, days: undefined });
    const existing = grouped.get(key);

    if (existing) existing.days.push(row.day);
    else grouped.set(key, meeting);
  }

  return Array.from(grouped.values());
}

export async function readImportedCourse(
  client: CourseReadClient,
  userId: string,
  courseId: string,
): Promise<ImportedCourseView> {
  const { data, error } = await client
    .from("imported_courses")
    .select(IMPORTED_COURSE_SELECT)
    .eq("id", courseId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new CourseReadError(
      "COURSE_QUERY_FAILED",
      "The imported course could not be loaded.",
      { cause: error },
    );
  }
  if (data === null) {
    throw new CourseReadError("COURSE_NOT_FOUND", "Course not found.");
  }

  const stored = storedCourseSchema.safeParse(data);
  if (!stored.success) {
    throw new CourseReadError(
      "INVALID_STORED_COURSE",
      "The stored course data is invalid.",
      { cause: stored.error },
    );
  }

  const row = stored.data;
  const extraction: CourseExtraction = {
    course: courseSchema.parse({
      code: row.code,
      name: row.name,
      section: row.section,
      semester: row.semester,
      instructor: row.instructor,
    }),
    meetings: groupMeetings(row.course_meetings),
    assessments: row.course_assessments.map((assessment) => ({
      id: assessment.external_id,
      type: assessment.type,
      title: assessment.title,
      release_date: assessment.release_date,
      due_date: assessment.due_date,
      date: assessment.event_date,
      due_time: normalizeDatabaseTime(assessment.due_time),
      start_time: normalizeDatabaseTime(assessment.start_time),
      end_time: normalizeDatabaseTime(assessment.end_time),
      location: assessment.location,
      coverage: assessment.coverage,
      date_status: assessment.date_status,
      raw_date_text: assessment.raw_date_text,
      source: sourceEvidence(assessment.source_page, assessment.source_text),
    })),
    assessment_rules: row.assessment_rules.map((rule) => ({
      type: rule.type,
      rule: rule.rule,
      source: sourceEvidence(rule.source_page, rule.source_text),
    })),
    metadata: {
      source_type: "syllabus",
      extraction_status: row.extraction_status,
      warnings: row.extraction_warnings,
    },
  };
  const validation = validateCourseExtraction(extraction);

  if (!validation.success) {
    throw new CourseReadError(
      "INVALID_STORED_COURSE",
      "The stored course data is invalid.",
      { cause: validation.issues },
    );
  }

  return {
    course_id: row.id,
    course: validation.data.course,
    meetings: validation.data.meetings,
    assessments: validation.data.assessments,
    assessment_rules: validation.data.assessment_rules,
    warnings: validation.data.metadata.warnings,
  };
}
