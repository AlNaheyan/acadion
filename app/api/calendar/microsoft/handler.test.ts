import { beforeEach, describe, expect, it, vi } from "vitest";
import { MICROSOFT_OAUTH_COOKIE, type CalendarConnectionClient } from "../../../../lib/calendar/providers";
import { handleMicrosoftCallback, handleMicrosoftConnect, type MicrosoftOAuthDependencies } from "./handler";
function deps(): MicrosoftOAuthDependencies {
  return { authenticate: vi.fn().mockResolvedValue("user"), client: vi.fn().mockReturnValue({ from: vi.fn().mockReturnValue({ upsert: vi.fn().mockResolvedValue({ error: null }) }) } as unknown as CalendarConnectionClient),
    config: vi.fn().mockReturnValue({ clientId: "client", clientSecret: "secret", redirectUri: "http://localhost/api/calendar/microsoft/callback", tenant: "common" }),
    exchange: vi.fn().mockResolvedValue({ access_token: "a", refresh_token: "r", expires_in: 3600, scope: "Calendars.ReadWrite", token_type: "Bearer" }) };
}
beforeEach(() => { process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 2).toString("base64"); });
describe("Microsoft OAuth API", () => {
  it("starts authorization with a secure state cookie", async () => {
    const response = await handleMicrosoftConnect(new Request("http://localhost/api/calendar/microsoft/connect"), deps());
    expect(response.status).toBe(303); expect(response.headers.get("set-cookie")).toContain("HttpOnly");
  });
  it("accepts a matching callback and clears state", async () => {
    const dependencies = deps(); const started = await handleMicrosoftConnect(new Request("http://localhost/api/calendar/microsoft/connect"), dependencies);
    const location = new URL(started.headers.get("location")!); const rawCookie = started.headers.get("set-cookie")!.split(";")[0];
    const response = await handleMicrosoftCallback(new Request(`http://localhost/api/calendar/microsoft/callback?code=x&state=${location.searchParams.get("state")}`, { headers: { cookie: rawCookie } }), dependencies);
    expect(response.headers.get("location")).toContain("microsoft=connected"); expect(response.headers.get("set-cookie")).toContain(`${MICROSOFT_OAUTH_COOKIE}=;`);
  });
});
