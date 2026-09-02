import { auth } from "@clerk/nextjs/server";

import { createSupabaseServerClient } from "../../../../../../../lib/supabase-server";
import {
  googleAccessToken,
  claimCalendarEvent,
  insertGoogleEvent,
  mapMeetingToGoogleEvent,
  markCalendarEventFailed,
  saveCreatedCalendarEvent,
  type CalendarConnectionClient,
  type CalendarExportClient,
} from "../../../../../../../lib/calendar/providers";
import {
  CourseReadError,
  readImportedCourse,
  type CourseReadClient,
  type ImportedCourseView,
} from "../../../../../../../lib/syllabus";

export interface GoogleClassDependencies {
  authenticate(): Promise<string | null>;
  client(): unknown;
  readCourse(client: CourseReadClient, userId: string, courseId: string): Promise<ImportedCourseView>;
  accessToken(client: CalendarConnectionClient, userId: string): ReturnType<typeof googleAccessToken>;
  insert: typeof insertGoogleEvent;
  save: typeof saveCreatedCalendarEvent;
  claim: typeof claimCalendarEvent;
  markFailed: typeof markCalendarEventFailed;
}

const defaultDependencies: GoogleClassDependencies = {
  async authenticate() {
    const { userId } = await auth();
    return userId;
  },
  client: createSupabaseServerClient,
  readCourse: readImportedCourse,
  accessToken: googleAccessToken,
  insert: insertGoogleEvent,
  save: saveCreatedCalendarEvent,
  claim: claimCalendarEvent,
  markFailed: markCalendarEventFailed,
};

export async function handleGoogleClassCreation(
  courseId: string,
  dependencies: GoogleClassDependencies = defaultDependencies,
): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } }, { status: 401 });

  try {
    const client = dependencies.client();
    const [course, connection] = await Promise.all([
      dependencies.readCourse(client as CourseReadClient, userId, courseId),
      dependencies.accessToken(client as CalendarConnectionClient, userId),
    ]);
    if (!connection.selectedCalendarId) {
      return Response.json({ error: { code: "CALENDAR_REQUIRED", message: "Select a Google calendar first." } }, { status: 409 });
    }
    const timezone = connection.selectedCalendarTimezone ?? "America/New_York";
    const mapped = course.meetings.map((meeting) => mapMeetingToGoogleEvent({
      courseId: course.course_id, course: course.course, meeting, timezone,
    }));
    const events = mapped.filter((event): event is NonNullable<typeof event> => event !== null);
    if (events.length === 0) {
      return Response.json({ error: { code: "NO_EXPORTABLE_MEETINGS", message: "No complete class meetings are available." } }, { status: 422 });
    }
    const created = [];
    let skippedCount = 0;
    for (const event of events) {
      const claimed = await dependencies.claim(client as CalendarExportClient, {
        connectionId: connection.connectionId, courseId: course.course_id, sourceType: "class", logicalKey: event.logicalKey,
      });
      if (!claimed) { skippedCount += 1; continue; }
      try {
        const provider = await dependencies.insert(connection.selectedCalendarId, connection.token, event.payload);
        await dependencies.save(client as CalendarExportClient, {
          connectionId: connection.connectionId, courseId: course.course_id, sourceType: "class",
          logicalKey: event.logicalKey, providerEventId: provider.id,
        });
        created.push({ logical_key: event.logicalKey, provider_event_id: provider.id });
      } catch {
        await dependencies.markFailed(client as CalendarExportClient, connection.connectionId, event.logicalKey);
      }
    }
    const failedCount = events.length - created.length - skippedCount;
    return Response.json({ created, created_count: created.length, failed_count: failedCount, skipped_count: skippedCount, excluded_count: mapped.length - events.length }, { status: failedCount ? 207 : 201 });
  } catch (error) {
    if (error instanceof CourseReadError && error.code === "COURSE_NOT_FOUND") {
      return Response.json({ error: { code: "COURSE_NOT_FOUND", message: "Course not found." } }, { status: 404 });
    }
    return Response.json({ error: { code: "GOOGLE_CALENDAR_FAILED", message: "Class events could not be added to Google Calendar." } }, { status: 502 });
  }
}
