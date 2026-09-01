import { z } from "zod";

const isCalendarDate = (value: string) => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO date in YYYY-MM-DD format")
  .refine(isCalendarDate, "Expected a real calendar date");

export const isoTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected a 24-hour time in HH:mm format");

export const assessmentTypeSchema = z.enum([
  "homework",
  "quiz",
  "midterm",
  "exam",
  "final_exam",
  "project",
  "lab",
  "paper",
  "presentation",
  "other",
]);

export const dateStatusSchema = z.enum([
  "confirmed",
  "TBD",
  "ambiguous",
  "missing",
]);

export const meetingDaySchema = z.enum([
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
]);

export const sourceEvidenceSchema = z
  .object({
    page: z.number().int().positive().nullable().default(null),
    text: z.string().trim().min(1).nullable().default(null),
  })
  .strict();

export const courseSchema = z
  .object({
    name: z.string().trim().min(1).nullable().default(null),
    code: z.string().trim().min(1).nullable().default(null),
    section: z.string().trim().min(1).nullable().default(null),
    semester: z.string().trim().min(1).nullable().default(null),
    instructor: z.string().trim().min(1).nullable().default(null),
  })
  .strict();

export const meetingSchema = z
  .object({
    days: z.array(meetingDaySchema).min(1),
    start_time: isoTimeSchema.nullable().default(null),
    end_time: isoTimeSchema.nullable().default(null),
    location: z.string().trim().min(1).nullable().default(null),
    start_date: isoDateSchema.nullable().default(null),
    end_date: isoDateSchema.nullable().default(null),
  })
  .strict()
  .superRefine((meeting, context) => {
    if (meeting.start_time && meeting.end_time && meeting.start_time >= meeting.end_time) {
      context.addIssue({
        code: "custom",
        path: ["end_time"],
        message: "Meeting end_time must be after start_time",
      });
    }

    if (meeting.start_date && meeting.end_date && meeting.start_date > meeting.end_date) {
      context.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Meeting end_date must not be before start_date",
      });
    }
  });

export const assessmentSchema = z
  .object({
    id: z.string().trim().min(1),
    type: assessmentTypeSchema,
    title: z.string().trim().min(1),
    release_date: isoDateSchema.nullable().default(null),
    due_date: isoDateSchema.nullable().default(null),
    date: isoDateSchema.nullable().default(null),
    due_time: isoTimeSchema.nullable().default(null),
    start_time: isoTimeSchema.nullable().default(null),
    end_time: isoTimeSchema.nullable().default(null),
    location: z.string().trim().min(1).nullable().default(null),
    coverage: z.string().trim().min(1).nullable().default(null),
    date_status: dateStatusSchema.default("confirmed"),
    raw_date_text: z.string().trim().min(1).nullable().default(null),
    source: sourceEvidenceSchema.nullable().default(null),
  })
  .strict()
  .superRefine((assessment, context) => {
    if (assessment.due_time && !assessment.due_date) {
      context.addIssue({
        code: "custom",
        path: ["due_time"],
        message: "Assessment due_time requires due_date",
      });
    }

    if ((assessment.start_time || assessment.end_time) && !assessment.date) {
      context.addIssue({
        code: "custom",
        path: [assessment.start_time ? "start_time" : "end_time"],
        message: "Assessment event times require date",
      });
    }

    if (assessment.end_time && !assessment.start_time) {
      context.addIssue({
        code: "custom",
        path: ["end_time"],
        message: "Assessment end_time requires start_time",
      });
    }

    if (
      assessment.start_time &&
      assessment.end_time &&
      assessment.start_time >= assessment.end_time
    ) {
      context.addIssue({
        code: "custom",
        path: ["end_time"],
        message: "Assessment end_time must be after start_time",
      });
    }

    const hasCalendarDate = Boolean(
      assessment.release_date || assessment.due_date || assessment.date,
    );

    if (assessment.date_status === "confirmed" && !hasCalendarDate) {
      context.addIssue({
        code: "custom",
        path: ["date_status"],
        message: "Confirmed assessments require at least one calendar date",
      });
    }

    if (assessment.date_status !== "confirmed" && hasCalendarDate) {
      context.addIssue({
        code: "custom",
        path: ["date_status"],
        message: "Unconfirmed assessments cannot contain normalized calendar dates",
      });
    }
  });

export const assessmentRuleSchema = z
  .object({
    type: assessmentTypeSchema,
    rule: z.string().trim().min(1),
    source: sourceEvidenceSchema.nullable().default(null),
  })
  .strict();

export const extractionWarningTypeSchema = z.enum([
  "TBD",
  "missing",
  "ambiguous",
  "conflict",
  "unsupported",
]);

export const extractionWarningSchema = z
  .object({
    type: extractionWarningTypeSchema,
    message: z.string().trim().min(1),
    assessment_id: z.string().trim().min(1).nullable().default(null),
    source: sourceEvidenceSchema.nullable().default(null),
  })
  .strict();

export const extractionMetadataSchema = z
  .object({
    source_type: z.literal("syllabus").default("syllabus"),
    extraction_status: z.enum(["success", "partial", "failed"]),
    warnings: z.array(extractionWarningSchema).default([]),
  })
  .strict();

export const courseExtractionSchema = z
  .object({
    course: courseSchema,
    meetings: z.array(meetingSchema).default([]),
    assessments: z.array(assessmentSchema).default([]),
    assessment_rules: z.array(assessmentRuleSchema).default([]),
    metadata: extractionMetadataSchema,
  })
  .strict()
  .superRefine((extraction, context) => {
    const assessmentIds = new Set<string>();

    extraction.assessments.forEach((assessment, index) => {
      if (assessmentIds.has(assessment.id)) {
        context.addIssue({
          code: "custom",
          path: ["assessments", index, "id"],
          message: `Duplicate assessment id: ${assessment.id}`,
        });
      }
      assessmentIds.add(assessment.id);
    });

    extraction.metadata.warnings.forEach((warning, index) => {
      if (warning.assessment_id && !assessmentIds.has(warning.assessment_id)) {
        context.addIssue({
          code: "custom",
          path: ["metadata", "warnings", index, "assessment_id"],
          message: `Warning references unknown assessment: ${warning.assessment_id}`,
        });
      }
    });
  });

export type AssessmentType = z.infer<typeof assessmentTypeSchema>;
export type DateStatus = z.infer<typeof dateStatusSchema>;
export type MeetingDay = z.infer<typeof meetingDaySchema>;
export type SourceEvidence = z.infer<typeof sourceEvidenceSchema>;
export type Course = z.infer<typeof courseSchema>;
export type Meeting = z.infer<typeof meetingSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type AssessmentRule = z.infer<typeof assessmentRuleSchema>;
export type ExtractionWarning = z.infer<typeof extractionWarningSchema>;
export type ExtractionMetadata = z.infer<typeof extractionMetadataSchema>;
export type CourseExtraction = z.infer<typeof courseExtractionSchema>;
