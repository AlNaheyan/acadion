import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGoogleAuthorizationRequest,
  exchangeGoogleAuthorizationCode,
  GOOGLE_CALENDAR_SCOPES,
  refreshGoogleAccessToken,
  revokeGoogleToken,
  validateGoogleOAuthState,
} from "./google";
import { decryptOAuthSecret, encryptOAuthSecret } from "./token-crypto";

const config = { clientId: "client", clientSecret: "secret", redirectUri: "https://app.test/callback" };

describe("Google OAuth security", () => {
  beforeEach(() => {
    process.env.OAUTH_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString("base64");
  });
  afterEach(() => delete process.env.OAUTH_TOKEN_ENCRYPTION_KEY);

  it("encrypts secrets with authenticated random nonces", () => {
    const first = encryptOAuthSecret("refresh-token");
    const second = encryptOAuthSecret("refresh-token");
    expect(first).not.toBe(second);
    expect(decryptOAuthSecret(first)).toBe("refresh-token");
    expect(first).not.toContain("refresh-token");
  });

  it("creates an offline PKCE request with minimum scopes and validates state", () => {
    const request = createGoogleAuthorizationRequest("user_123", config, 1_000);
    const url = new URL(request.url);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(GOOGLE_CALENDAR_SCOPES);
    expect(validateGoogleOAuthState(request.cookie, request.state, "user_123", 2_000)).toMatchObject({ userId: "user_123" });
    expect(() => validateGoogleOAuthState(request.cookie, "wrong", "user_123", 2_000)).toThrow("Invalid Google OAuth state");
    expect(() => validateGoogleOAuthState(request.cookie, request.state, "user_123", 700_001)).toThrow("Invalid Google OAuth state");
  });

  it("exchanges and refreshes tokens with the expected grants", async () => {
    const fetcher = vi.fn().mockImplementation(async () => Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, scope: GOOGLE_CALENDAR_SCOPES.join(" "), token_type: "Bearer" }));
    await exchangeGoogleAuthorizationCode("code", "verifier", config, fetcher);
    expect(String(fetcher.mock.calls[0][1].body)).toContain("grant_type=authorization_code");
    await refreshGoogleAccessToken("refresh", config, fetcher);
    expect(String(fetcher.mock.calls[1][1].body)).toContain("grant_type=refresh_token");
  });

  it("revokes tokens and maps provider failures safely", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await expect(revokeGoogleToken("token", fetcher)).resolves.toBeUndefined();
    expect(String(fetcher.mock.calls[0][1].body)).toBe("token=token");
    await expect(revokeGoogleToken("token", vi.fn().mockResolvedValue(new Response(null, { status: 500 })))).rejects.toThrow("Google token revocation failed");
  });
});
