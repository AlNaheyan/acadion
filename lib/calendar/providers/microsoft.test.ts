import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMicrosoftAuthorizationRequest, exchangeMicrosoftAuthorizationCode, MICROSOFT_CALENDAR_SCOPES, validateMicrosoftOAuthState } from "./microsoft";

const config = { clientId: "client", clientSecret: "secret", redirectUri: "https://app.test/callback", tenant: "common" };
beforeEach(() => { process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64"); });
describe("Microsoft OAuth", () => {
  it("uses PKCE, state, offline access, and calendar write scope", () => {
    const request = createMicrosoftAuthorizationRequest("user", config, 1_000); const url = new URL(request.url);
    expect(url.searchParams.get("scope")?.split(" ")).toEqual(MICROSOFT_CALENDAR_SCOPES);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(validateMicrosoftOAuthState(request.cookie, request.state, "user", 2_000).userId).toBe("user");
    expect(() => validateMicrosoftOAuthState(request.cookie, request.state, "other", 2_000)).toThrow();
  });
  it("exchanges the authorization code with its verifier", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ access_token: "access", refresh_token: "refresh", expires_in: 3600, scope: "Calendars.ReadWrite", token_type: "Bearer" }));
    await exchangeMicrosoftAuthorizationCode("code", "verifier", config, fetcher);
    expect(String(fetcher.mock.calls[0][1].body)).toContain("code_verifier=verifier");
  });
});
