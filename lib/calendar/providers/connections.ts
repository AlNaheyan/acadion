import { decryptOAuthSecret, encryptOAuthSecret } from "./token-crypto";
import type { GoogleTokenResponse } from "./google";

export interface CalendarConnectionClient {
  from(table: "calendar_connections"): {
    upsert(values: Record<string, unknown>, options: { onConflict: string }): PromiseLike<{ error: { message: string } | null }>;
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): PromiseLike<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
        };
      };
    };
    delete(): { eq(column: string, value: string): { eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }> } };
    update(values: Record<string, unknown>): {
      eq(column: string, value: string): {
        eq(column: string, value: string): PromiseLike<{ error: { message: string } | null }>;
      };
    };
  };
}

export interface GoogleConnectionSecrets {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  selectedCalendarId: string | null;
}

export async function saveGoogleConnection(
  client: CalendarConnectionClient,
  userId: string,
  tokens: GoogleTokenResponse,
  now = Date.now(),
): Promise<void> {
  if (!tokens.refresh_token) throw new Error("Google did not return a refresh token.");
  const { error } = await client.from("calendar_connections").upsert(
    {
      user_id: userId,
      provider: "google",
      access_token_ciphertext: encryptOAuthSecret(tokens.access_token),
      refresh_token_ciphertext: encryptOAuthSecret(tokens.refresh_token),
      token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
      scopes: tokens.scope.split(" ").filter(Boolean),
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error("Google connection could not be saved.");
}

export async function deleteGoogleConnection(client: CalendarConnectionClient, userId: string): Promise<void> {
  const { error } = await client.from("calendar_connections").delete().eq("user_id", userId).eq("provider", "google");
  if (error) throw new Error("Google connection could not be removed.");
}

export async function getGoogleConnectionSecrets(
  client: CalendarConnectionClient,
  userId: string,
): Promise<GoogleConnectionSecrets | null> {
  const { data, error } = await client
    .from("calendar_connections")
    .select("access_token_ciphertext,refresh_token_ciphertext,token_expires_at,selected_calendar_id")
    .eq("user_id", userId)
    .eq("provider", "google")
    .maybeSingle();
  if (error) throw new Error("Google connection could not be loaded.");
  if (!data) return null;
  return {
    accessToken: decryptOAuthSecret(String(data.access_token_ciphertext)),
    refreshToken: decryptOAuthSecret(String(data.refresh_token_ciphertext)),
    expiresAt: String(data.token_expires_at),
    selectedCalendarId: data.selected_calendar_id ? String(data.selected_calendar_id) : null,
  };
}

export async function saveGoogleAccessToken(
  client: CalendarConnectionClient,
  userId: string,
  accessToken: string,
  expiresIn: number,
  now = Date.now(),
): Promise<void> {
  const { error } = await client
    .from("calendar_connections")
    .update({
      access_token_ciphertext: encryptOAuthSecret(accessToken),
      token_expires_at: new Date(now + expiresIn * 1000).toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google");
  if (error) throw new Error("Google access token could not be saved.");
}

export async function saveSelectedGoogleCalendar(
  client: CalendarConnectionClient,
  userId: string,
  calendar: { id: string; name: string; timeZone: string },
): Promise<void> {
  const { error } = await client
    .from("calendar_connections")
    .update({
      selected_calendar_id: calendar.id,
      selected_calendar_name: calendar.name,
      selected_calendar_timezone: calendar.timeZone,
    })
    .eq("user_id", userId)
    .eq("provider", "google");
  if (error) throw new Error("Google calendar selection could not be saved.");
}
