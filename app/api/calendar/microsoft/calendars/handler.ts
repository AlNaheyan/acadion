import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "../../../../../lib/supabase-server";
import { listWritableMicrosoftCalendars, microsoftAccessToken, saveSelectedMicrosoftCalendar, type CalendarConnectionClient, type MicrosoftCalendarChoice } from "../../../../../lib/calendar/providers";
export interface MicrosoftCalendarDependencies {
  authenticate(): Promise<string | null>; client(): CalendarConnectionClient;
  accessToken: typeof microsoftAccessToken; list(token: string): Promise<MicrosoftCalendarChoice[]>;
}
const defaults: MicrosoftCalendarDependencies = { async authenticate() { return (await auth()).userId; }, client: () => createSupabaseServerClient() as unknown as CalendarConnectionClient, accessToken: microsoftAccessToken, list: listWritableMicrosoftCalendars };
async function load(deps: MicrosoftCalendarDependencies, userId: string) { const client = deps.client(); const connection = await deps.accessToken(client, userId); return { client, connection, calendars: await deps.list(connection.token) }; }
export async function handleMicrosoftCalendarsGet(deps: MicrosoftCalendarDependencies = defaults) {
  const userId = await deps.authenticate(); if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  try { const { connection, calendars } = await load(deps, userId); return Response.json({ calendars, selected_calendar_id: connection.selectedCalendarId }); }
  catch { return Response.json({ error: "Writable Microsoft calendars could not be loaded." }, { status: 502 }); }
}
export async function handleMicrosoftCalendarsPut(request: Request, deps: MicrosoftCalendarDependencies = defaults) {
  const userId = await deps.authenticate(); if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  let id: string | null = null; try { const body = await request.json() as { calendar_id?: unknown }; if (typeof body.calendar_id === "string") id = body.calendar_id; } catch {}
  if (!id) return Response.json({ error: "A calendar_id is required." }, { status: 400 });
  try { const { client, calendars } = await load(deps, userId); const selected = calendars.find((item) => item.id === id); if (!selected) return Response.json({ error: "Select a writable Microsoft calendar." }, { status: 400 }); await saveSelectedMicrosoftCalendar(client, userId, selected); return Response.json({ calendar: selected }); }
  catch { return Response.json({ error: "Microsoft calendar selection could not be saved." }, { status: 502 }); }
}
