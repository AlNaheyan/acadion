import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "../../../../../../../lib/supabase-server";
import { claimCalendarEvent, googleAccessToken, insertGoogleEvent, mapAssessmentToGoogleEvent, saveCreatedCalendarEvent, type CalendarConnectionClient, type CalendarExportClient } from "../../../../../../../lib/calendar/providers";
import { readImportedCourse, type CourseReadClient, type ImportedCourseView } from "../../../../../../../lib/syllabus";

export interface GoogleAssessmentDependencies {
  authenticate(): Promise<string | null>; client(): unknown;
  readCourse(client: CourseReadClient, userId: string, courseId: string): Promise<ImportedCourseView>;
  accessToken(client: CalendarConnectionClient, userId: string): ReturnType<typeof googleAccessToken>;
  insert: typeof insertGoogleEvent; save: typeof saveCreatedCalendarEvent;
  claim: typeof claimCalendarEvent;
}
const defaults: GoogleAssessmentDependencies = {
  async authenticate() { return (await auth()).userId; }, client: createSupabaseServerClient,
  readCourse: readImportedCourse, accessToken: googleAccessToken, insert: insertGoogleEvent, save: saveCreatedCalendarEvent, claim: claimCalendarEvent,
};

export async function handleGoogleAssessmentCreation(courseId: string, dependencies: GoogleAssessmentDependencies = defaults): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } }, { status: 401 });
  try {
    const client = dependencies.client();
    const [course, connection] = await Promise.all([
      dependencies.readCourse(client as CourseReadClient, userId, courseId),
      dependencies.accessToken(client as CalendarConnectionClient, userId),
    ]);
    if (!connection.selectedCalendarId) return Response.json({ error: { code: "CALENDAR_REQUIRED", message: "Select a Google calendar first." } }, { status: 409 });
    const blocked = new Set(course.warnings.filter((warning) => ["conflict", "source_mismatch", "unsupported"].includes(warning.type)).map((warning) => warning.assessment_id));
    const mapped = course.assessments.map((assessment) => mapAssessmentToGoogleEvent({
      courseId, course: course.course, assessment,
      timezone: connection.selectedCalendarTimezone ?? "America/New_York",
      blocked: blocked.has(assessment.id) || blocked.has(null),
    })).filter((event): event is NonNullable<typeof event> => event !== null);
    if (!mapped.length) return Response.json({ error: { code: "NO_CONFIRMED_ASSESSMENTS", message: "No confirmed assessments are available." } }, { status: 422 });
    const results = [];
    for (const event of mapped) {
      try {
        const claimed = await dependencies.claim(client as CalendarExportClient, { connectionId: connection.connectionId, courseId, sourceType: "assessment", logicalKey: event.logicalKey });
        if (!claimed) { results.push({ logical_key: event.logicalKey, status: "skipped" }); continue; }
        const created = await dependencies.insert(connection.selectedCalendarId, connection.token, event.payload);
        await dependencies.save(client as CalendarExportClient, { connectionId: connection.connectionId, courseId, sourceType: "assessment", logicalKey: event.logicalKey, providerEventId: created.id });
        results.push({ logical_key: event.logicalKey, status: "created", provider_event_id: created.id });
      } catch {
        results.push({ logical_key: event.logicalKey, status: "failed" });
      }
    }
    const createdCount = results.filter((result) => result.status === "created").length;
    const failedCount = results.filter((result) => result.status === "failed").length;
    return Response.json({ results, created_count: createdCount, failed_count: failedCount, skipped_count: results.length - createdCount - failedCount }, { status: failedCount ? 207 : 201 });
  } catch {
    return Response.json({ error: { code: "GOOGLE_CALENDAR_FAILED", message: "Assessments could not be added to Google Calendar." } }, { status: 502 });
  }
}
