import { getProviderConnectionSecrets, saveProviderAccessToken, type CalendarConnectionClient } from "./connections";
import { microsoftOAuthConfig, refreshMicrosoftAccessToken, type MicrosoftTokenResponse } from "./microsoft";

export interface MicrosoftCalendarChoice { id: string; name: string; canEdit: boolean; isDefault: boolean }

export async function microsoftAccessToken(client: CalendarConnectionClient, userId: string, now = Date.now(), fetcher: typeof fetch = fetch) {
  const connection = await getProviderConnectionSecrets(client, userId, "microsoft");
  if (!connection) throw new Error("Microsoft Outlook is not connected.");
  if (new Date(connection.expiresAt).getTime() > now + 60_000) return { token: connection.accessToken, ...connection };
  const refreshed = await refreshMicrosoftAccessToken(connection.refreshToken, microsoftOAuthConfig(), fetcher);
  await saveProviderAccessToken(client, userId, "microsoft", refreshed.access_token, refreshed.expires_in, now, refreshed.refresh_token);
  return { token: refreshed.access_token, ...connection };
}

export async function listWritableMicrosoftCalendars(accessToken: string, fetcher: typeof fetch = fetch): Promise<MicrosoftCalendarChoice[]> {
  const response = await fetcher("https://graph.microsoft.com/v1.0/me/calendars?$select=id,name,canEdit,isDefaultCalendar", { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error("Microsoft calendars could not be loaded.");
  const body = (await response.json()) as { value?: Array<{ id?: string; name?: string; canEdit?: boolean; isDefaultCalendar?: boolean }> };
  return (body.value ?? []).flatMap((item) => item.id && item.name && item.canEdit === true
    ? [{ id: item.id, name: item.name, canEdit: true, isDefault: item.isDefaultCalendar === true }] : []);
}

export type { MicrosoftTokenResponse };
