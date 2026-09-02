import type { CalendarConnectionClient } from "./connections";
import { getGoogleConnectionSecrets, saveGoogleAccessToken } from "./connections";
import { googleOAuthConfig, refreshGoogleAccessToken } from "./google";

export interface GoogleCalendarChoice {
  id: string;
  name: string;
  timeZone: string;
  primary: boolean;
  accessRole: "owner" | "writer";
}

interface CalendarListResponse {
  items?: Array<{
    id?: string;
    summary?: string;
    timeZone?: string;
    primary?: boolean;
    accessRole?: string;
    deleted?: boolean;
  }>;
}

export async function googleAccessToken(
  client: CalendarConnectionClient,
  userId: string,
  now = Date.now(),
  fetcher: typeof fetch = fetch,
): Promise<{ token: string; selectedCalendarId: string | null; connectionId: string; selectedCalendarTimezone: string | null }> {
  const connection = await getGoogleConnectionSecrets(client, userId);
  if (!connection) throw new Error("Google Calendar is not connected.");
  if (new Date(connection.expiresAt).getTime() > now + 60_000) {
    return { token: connection.accessToken, selectedCalendarId: connection.selectedCalendarId, connectionId: connection.connectionId, selectedCalendarTimezone: connection.selectedCalendarTimezone };
  }
  const refreshed = await refreshGoogleAccessToken(connection.refreshToken, googleOAuthConfig(), fetcher);
  await saveGoogleAccessToken(client, userId, refreshed.access_token, refreshed.expires_in, now);
  return { token: refreshed.access_token, selectedCalendarId: connection.selectedCalendarId, connectionId: connection.connectionId, selectedCalendarTimezone: connection.selectedCalendarTimezone };
}

export async function listWritableGoogleCalendars(
  accessToken: string,
  fetcher: typeof fetch = fetch,
): Promise<GoogleCalendarChoice[]> {
  const url = new URL("https://www.googleapis.com/calendar/v3/users/me/calendarList");
  url.searchParams.set("minAccessRole", "writer");
  url.searchParams.set("showDeleted", "false");
  const response = await fetcher(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Google calendars could not be loaded.");
  const body = (await response.json()) as CalendarListResponse;
  return (body.items ?? []).flatMap((item) => {
    if (!item.id || !item.summary || !item.timeZone || item.deleted) return [];
    if (item.accessRole !== "owner" && item.accessRole !== "writer") return [];
    return [{
      id: item.id,
      name: item.summary,
      timeZone: item.timeZone,
      primary: item.primary === true,
      accessRole: item.accessRole,
    }];
  });
}
