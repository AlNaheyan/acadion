import { createHash, randomBytes } from "node:crypto";

import { decryptOAuthSecret, encryptOAuthSecret } from "./token-crypto";

export const MICROSOFT_CALENDAR_SCOPES = ["openid", "profile", "offline_access", "Calendars.ReadWrite"] as const;
export const MICROSOFT_OAUTH_COOKIE = "acadion_microsoft_oauth";

export interface MicrosoftOAuthConfig { clientId: string; clientSecret: string; redirectUri: string; tenant: string }
export interface MicrosoftTokenResponse { access_token: string; refresh_token?: string; expires_in: number; scope: string; token_type: string }
interface MicrosoftState { state: string; userId: string; verifier: string; expiresAt: number }

export function microsoftOAuthConfig(): MicrosoftOAuthConfig {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const redirectUri = process.env.MICROSOFT_OAUTH_REDIRECT_URI;
  if (!clientId || !clientSecret || !redirectUri) throw new Error("Microsoft OAuth is not configured.");
  return { clientId, clientSecret, redirectUri, tenant: process.env.MICROSOFT_TENANT_ID ?? "common" };
}

export function createMicrosoftAuthorizationRequest(userId: string, config: MicrosoftOAuthConfig, now = Date.now()) {
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const cookie = encryptOAuthSecret(JSON.stringify({ state, userId, verifier, expiresAt: now + 600_000 } satisfies MicrosoftState));
  const url = new URL(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/authorize`);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_CALENDAR_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { url: url.toString(), cookie, state };
}

export function validateMicrosoftOAuthState(cookie: string, state: string, userId: string, now = Date.now()): MicrosoftState {
  const value = JSON.parse(decryptOAuthSecret(cookie)) as MicrosoftState;
  if (value.state !== state || value.userId !== userId || value.expiresAt < now || !value.verifier) throw new Error("Invalid Microsoft OAuth state.");
  return value;
}

async function tokenRequest(values: Record<string, string>, config: MicrosoftOAuthConfig, fetcher: typeof fetch): Promise<MicrosoftTokenResponse> {
  const response = await fetcher(`https://login.microsoftonline.com/${encodeURIComponent(config.tenant)}/oauth2/v2.0/token`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...values }),
  });
  if (!response.ok) throw new Error("Microsoft token request failed.");
  const token = (await response.json()) as Partial<MicrosoftTokenResponse>;
  if (!token.access_token || !token.expires_in || !token.scope || !token.token_type) throw new Error("Microsoft token response was incomplete.");
  return token as MicrosoftTokenResponse;
}

export function exchangeMicrosoftAuthorizationCode(code: string, verifier: string, config: MicrosoftOAuthConfig, fetcher: typeof fetch = fetch) {
  return tokenRequest({ code, redirect_uri: config.redirectUri, grant_type: "authorization_code", code_verifier: verifier }, config, fetcher);
}

export function refreshMicrosoftAccessToken(refreshToken: string, config: MicrosoftOAuthConfig, fetcher: typeof fetch = fetch) {
  return tokenRequest({ refresh_token: refreshToken, grant_type: "refresh_token", scope: MICROSOFT_CALENDAR_SCOPES.join(" ") }, config, fetcher);
}
