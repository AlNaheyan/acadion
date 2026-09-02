import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "../../../../../../lib/supabase-server";
import { claimCalendarEvent, insertMicrosoftEvent, mapAssessmentToMicrosoftEvent, mapMeetingToMicrosoftEvent, markCalendarEventFailed, microsoftAccessToken, saveCreatedCalendarEvent, type CalendarConnectionClient, type CalendarExportClient, type MicrosoftCalendarEvent } from "../../../../../../lib/calendar/providers";
import { readImportedCourse, type CourseReadClient, type ImportedCourseView } from "../../../../../../lib/syllabus";

export type MicrosoftEventKind = "class" | "assessment";
export interface MicrosoftEventDependencies {
  authenticate(): Promise<string | null>; client(): unknown;
  readCourse(client: CourseReadClient, userId: string, courseId: string): Promise<ImportedCourseView>;
  accessToken: typeof microsoftAccessToken; insert: typeof insertMicrosoftEvent;
  claim: typeof claimCalendarEvent; save: typeof saveCreatedCalendarEvent; markFailed: typeof markCalendarEventFailed;
}
const defaults: MicrosoftEventDependencies = {
  async authenticate() { return (await auth()).userId; }, client: createSupabaseServerClient,
  readCourse: readImportedCourse, accessToken: microsoftAccessToken, insert: insertMicrosoftEvent,
  claim: claimCalendarEvent, save: saveCreatedCalendarEvent, markFailed: markCalendarEventFailed,
};

function mappedEvents(kind: MicrosoftEventKind, course: ImportedCourseView, timezone: string): { events: MicrosoftCalendarEvent[]; excluded: number } {
  if (kind === "class") {
    const values = course.meetings.map((meeting) => mapMeetingToMicrosoftEvent({ courseId: course.course_id, course: course.course, meeting, timezone }));
    return { events: values.filter((item): item is MicrosoftCalendarEvent => item !== null), excluded: values.filter((item) => item === null).length };
  }
  const unsafe = course.warnings.filter((warning) => ["conflict", "source_mismatch", "unsupported"].includes(warning.type));
  const global = unsafe.some((warning) => !warning.assessment_id); const ids = new Set(unsafe.map((warning) => warning.assessment_id));
  const values = course.assessments.map((assessment) => mapAssessmentToMicrosoftEvent({ courseId: course.course_id, course: course.course, assessment, timezone, blocked: global || ids.has(assessment.id) }));
  return { events: values.filter((item): item is MicrosoftCalendarEvent => item !== null), excluded: values.filter((item) => item === null).length };
}

export async function handleMicrosoftEventCreation(courseId: string, kind: MicrosoftEventKind, dependencies: MicrosoftEventDependencies = defaults): Promise<Response> {
  const userId = await dependencies.authenticate(); if (!userId) return Response.json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } }, { status: 401 });
  try {
    const client = dependencies.client(); const [course, connection] = await Promise.all([
      dependencies.readCourse(client as CourseReadClient, userId, courseId), dependencies.accessToken(client as CalendarConnectionClient, userId),
    ]);
    if (!connection.selectedCalendarId) return Response.json({ error: { code: "CALENDAR_REQUIRED", message: "Select a Microsoft calendar first." } }, { status: 409 });
    const timezone = process.env.MICROSOFT_CALENDAR_TIME_ZONE ?? "Eastern Standard Time";
    const { events, excluded } = mappedEvents(kind, course, timezone);
    if (!events.length) return Response.json({ error: { code: "NO_CONFIRMED_EVENTS", message: "No complete confirmed events are available." } }, { status: 422 });
    const results: Array<{ logical_key: string; status: "created" | "failed" | "skipped"; provider_event_id?: string }> = [];
    for (const event of events) {
      const claimed = await dependencies.claim(client as CalendarExportClient, { connectionId: connection.connectionId, courseId, sourceType: kind, logicalKey: event.logicalKey });
      if (!claimed) { results.push({ logical_key: event.logicalKey, status: "skipped" }); continue; }
      try {
        const created = await dependencies.insert(connection.selectedCalendarId, connection.token, event.payload);
        await dependencies.save(client as CalendarExportClient, { connectionId: connection.connectionId, courseId, sourceType: kind, logicalKey: event.logicalKey, providerEventId: created.id });
        results.push({ logical_key: event.logicalKey, status: "created", provider_event_id: created.id });
      } catch { await dependencies.markFailed(client as CalendarExportClient, connection.connectionId, event.logicalKey); results.push({ logical_key: event.logicalKey, status: "failed" }); }
    }
    const createdCount = results.filter((item) => item.status === "created").length; const failedCount = results.filter((item) => item.status === "failed").length;
    return Response.json({ results, created_count: createdCount, failed_count: failedCount, skipped_count: results.length - createdCount - failedCount, excluded_count: excluded }, { status: failedCount ? 207 : 201 });
  } catch { return Response.json({ error: { code: "MICROSOFT_CALENDAR_FAILED", message: "Events could not be added to Microsoft Outlook." } }, { status: 502 }); }
}
