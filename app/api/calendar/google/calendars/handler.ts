import { auth } from "@clerk/nextjs/server";

import { createSupabaseServerClient } from "../../../../../lib/supabase-server";
import {
  googleAccessToken,
  listWritableGoogleCalendars,
  saveSelectedGoogleCalendar,
  type CalendarConnectionClient,
  type GoogleCalendarChoice,
} from "../../../../../lib/calendar/providers";

export interface GoogleCalendarDependencies {
  authenticate(): Promise<string | null>;
  connectionClient(): CalendarConnectionClient;
  accessToken(client: CalendarConnectionClient, userId: string): Promise<{ token: string; selectedCalendarId: string | null; connectionId: string; selectedCalendarTimezone: string | null }>;
  list(token: string): Promise<GoogleCalendarChoice[]>;
}

const defaultDependencies: GoogleCalendarDependencies = {
  async authenticate() {
    const { userId } = await auth();
    return userId;
  },
  connectionClient() {
    return createSupabaseServerClient() as unknown as CalendarConnectionClient;
  },
  accessToken: googleAccessToken,
  list: listWritableGoogleCalendars,
};

async function loadCalendars(dependencies: GoogleCalendarDependencies, userId: string) {
  const client = dependencies.connectionClient();
  const connection = await dependencies.accessToken(client, userId);
  const calendars = await dependencies.list(connection.token);
  return { client, calendars, selectedCalendarId: connection.selectedCalendarId };
}

export async function handleGoogleCalendarsGet(
  dependencies: GoogleCalendarDependencies = defaultDependencies,
): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  try {
    const { calendars, selectedCalendarId } = await loadCalendars(dependencies, userId);
    return Response.json({ calendars, selected_calendar_id: selectedCalendarId });
  } catch {
    return Response.json({ error: "Writable Google calendars could not be loaded." }, { status: 502 });
  }
}

export async function handleGoogleCalendarsPut(
  request: Request,
  dependencies: GoogleCalendarDependencies = defaultDependencies,
): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  let calendarId: string | undefined;
  try {
    const body = (await request.json()) as { calendar_id?: unknown };
    if (typeof body.calendar_id === "string" && body.calendar_id.trim()) calendarId = body.calendar_id;
  } catch {
    // The stable validation response below handles malformed JSON.
  }
  if (!calendarId) return Response.json({ error: "A calendar_id is required." }, { status: 400 });

  try {
    const { client, calendars } = await loadCalendars(dependencies, userId);
    const selected = calendars.find((calendar) => calendar.id === calendarId);
    if (!selected) return Response.json({ error: "Select a writable Google calendar." }, { status: 400 });
    await saveSelectedGoogleCalendar(client, userId, selected);
    return Response.json({ calendar: selected });
  } catch {
    return Response.json({ error: "Google calendar selection could not be saved." }, { status: 502 });
  }
}
