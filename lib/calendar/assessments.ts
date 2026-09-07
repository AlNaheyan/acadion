import type {
  Assessment,
  Course,
  ExtractionWarning,
} from "../syllabus";
import { serializeIcsCalendar, type IcsProperty } from "./ics";
import { createCalendarEventUid } from "./uid";
import { selectAssessmentSchedule } from "./assessment-schedule";

export interface AssessmentCalendarInput {
  courseId: string;
  course: Course;
  assessments: Assessment[];
  warnings?: ExtractionWarning[];
  generatedAt: Date;
  timezone?: string;
}

export interface GeneratedAssessmentCalendar {
  ics: string;
  exportedCount: number;
  excludedCount: number;
}

function compactDate(date: string): string {
  return date.replaceAll("-", "");
}

function compactTime(time: string): string {
  return `${time.replace(":", "")}00`;
}

function utcTimestamp(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function unsafeAssessmentIds(
  warnings: ExtractionWarning[],
): { ids: Set<string>; global: boolean } {
  const unsafeTypes = new Set<ExtractionWarning["type"]>([
    "conflict",
    "source_mismatch",
    "unsupported",
  ]);
  const ids = new Set<string>();
  let global = false;

  for (const warning of warnings) {
    if (!unsafeTypes.has(warning.type)) continue;
    if (warning.assessment_id) ids.add(warning.assessment_id);
    else global = true;
  }

  return { ids, global };
}

function eventForAssessment(
  input: AssessmentCalendarInput,
  assessment: Assessment,
  timezone: string,
  unsafe: { ids: Set<string>; global: boolean },
): IcsProperty[] | null {
  if (
    assessment.date_status !== "confirmed" ||
    unsafe.global ||
    unsafe.ids.has(assessment.id)
  ) {
    return null;
  }

  const courseLabel = input.course.code ?? input.course.name ?? "Course";
  const common: IcsProperty[] = [
    {
      name: "UID",
      value: createCalendarEventUid(
        input.courseId,
        "assessment",
        assessment.id,
      ),
    },
    { name: "DTSTAMP", value: utcTimestamp(input.generatedAt) },
  ];
  let dateProperties: IcsProperty[];
  const schedule = selectAssessmentSchedule(assessment);

  if (schedule) {
    dateProperties = [
      {
        name: "DTSTART",
        value: schedule.startTime
          ? `${compactDate(schedule.date)}T${compactTime(schedule.startTime)}`
          : compactDate(schedule.date),
        parameters: schedule.startTime
          ? { TZID: timezone }
          : { VALUE: "DATE" },
      },
      ...(schedule.endTime
        ? [
            {
              name: "DTEND",
              value: `${compactDate(schedule.date)}T${compactTime(schedule.endTime)}`,
              parameters: { TZID: timezone },
            },
          ]
        : []),
    ];
  } else {
    return null;
  }

  const descriptionParts = [
    `Assessment type: ${assessment.type}.`,
    assessment.coverage ? `Coverage: ${assessment.coverage}` : null,
    assessment.source?.page ? `Syllabus source page: ${assessment.source.page}.` : null,
  ].filter((part): part is string => part !== null);

  return [
    ...common,
    ...dateProperties,
    {
      name: "SUMMARY",
      value: `${courseLabel} - ${assessment.title}`,
      valueType: "text",
    },
    ...(assessment.location
      ? [{ name: "LOCATION", value: assessment.location, valueType: "text" as const }]
      : []),
    {
      name: "DESCRIPTION",
      value: descriptionParts.join(" "),
      valueType: "text",
    },
  ];
}

export function generateAssessmentCalendar(
  input: AssessmentCalendarInput,
): GeneratedAssessmentCalendar {
  const timezone = input.timezone ?? "America/New_York";
  const unsafe = unsafeAssessmentIds(input.warnings ?? []);
  const candidates = input.assessments.map((assessment) =>
    eventForAssessment(input, assessment, timezone, unsafe),
  );
  const events = candidates.filter(
    (event): event is IcsProperty[] => event !== null,
  );
  const courseLabel = input.course.code ?? input.course.name ?? "Imported course";

  return {
    ics: serializeIcsCalendar({
      name: `${courseLabel} Assessments`,
      properties: [{ name: "X-WR-TIMEZONE", value: timezone }],
      events,
    }),
    exportedCount: events.length,
    excludedCount: candidates.length - events.length,
  };
}
