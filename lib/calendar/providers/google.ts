import { createHash, randomBytes } from "node:crypto";

import { decryptOAuthSecret, encryptOAuthSecret } from "./token-crypto";

export const GOOGLE_CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.events",
] as const;

export const GOOGLE_OAUTH_COOKIE = "acadion_google_oauth";

export interface GoogleOAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface OAuthStatePayload {
  state: string;
  userId: string;
  verifier: string;
  expiresAt: number;
}

export function googleOAuthConfig(): GoogleOAuthConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Google OAuth is not configured.");
  return { clientId, clientSecret, redirectUri };
}

export function createGoogleAuthorizationRequest(
  userId: string,
  config: GoogleOAuthConfig,
  now = Date.now(),
): { url: string; cookie: string; state: string } {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const payload: OAuthStatePayload = { state, userId, verifier, expiresAt: now + 10 * 60_000 };
  const cookie = encryptOAuthSecret(JSON.stringify(payload));
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GOOGLE_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { url: url.toString(), cookie, state };
}

export function validateGoogleOAuthState(
  cookie: string,
  returnedState: string,
  userId: string,
  now = Date.now(),
): OAuthStatePayload {
  const payload = JSON.parse(decryptOAuthSecret(cookie)) as OAuthStatePayload;
  if (
    payload.state !== returnedState ||
    payload.userId !== userId ||
    payload.expiresAt < now ||
    !payload.verifier
  ) {
    throw new Error("Invalid Google OAuth state.");
  }
  return payload;
}

export async function exchangeGoogleAuthorizationCode(
  code: string,
  verifier: string,
  config: GoogleOAuthConfig,
  fetcher: typeof fetch = fetch,
): Promise<GoogleTokenResponse> {
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new Error("Google token exchange failed.");
  const tokens = (await response.json()) as Partial<GoogleTokenResponse>;
  if (!tokens.access_token || !tokens.expires_in || !tokens.scope || !tokens.token_type) {
    throw new Error("Google token response was incomplete.");
  }
  return tokens as GoogleTokenResponse;
}

export async function refreshGoogleAccessToken(
  refreshToken: string,
  config: GoogleOAuthConfig,
  fetcher: typeof fetch = fetch,
): Promise<GoogleTokenResponse> {
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) throw new Error("Google token refresh failed.");
  const tokens = (await response.json()) as Partial<GoogleTokenResponse>;
  if (!tokens.access_token || !tokens.expires_in || !tokens.scope || !tokens.token_type) {
    throw new Error("Google token response was incomplete.");
  }
  return tokens as GoogleTokenResponse;
}

export async function revokeGoogleToken(token: string, fetcher: typeof fetch = fetch): Promise<void> {
  const response = await fetcher("https://oauth2.googleapis.com/revoke", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
  if (!response.ok) throw new Error("Google token revocation failed.");
}
