import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createGoogleAuthorizationRequest,
  GOOGLE_OAUTH_COOKIE,
  type CalendarConnectionClient,
} from "../../../../lib/calendar/providers";
import {
  handleGoogleCallback,
  handleGoogleConnect,
  handleGoogleDisconnect,
  type GoogleOAuthDependencies,
} from "./handler";

const config = {
  clientId: "google-client",
  clientSecret: "google-secret",
  redirectUri: "http://localhost/api/calendar/google/callback",
};

function connectionClient() {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const secondEq = vi.fn().mockReturnValue({ maybeSingle });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const deleteSecondEq = vi.fn().mockResolvedValue({ error: null });
  const deleteFirstEq = vi.fn().mockReturnValue({ eq: deleteSecondEq });
  const from = vi.fn().mockReturnValue({
    upsert,
    select: vi.fn().mockReturnValue({ eq: firstEq }),
    delete: vi.fn().mockReturnValue({ eq: deleteFirstEq }),
  });
  return { client: { from } as unknown as CalendarConnectionClient, upsert, maybeSingle, deleteSecondEq };
}

function dependencies(overrides: Partial<GoogleOAuthDependencies> = {}) {
  const store = connectionClient();
  return {
    store,
    value: {
      authenticate: vi.fn().mockResolvedValue("user_123"),
      connectionClient: vi.fn().mockReturnValue(store.client),
      config: vi.fn().mockReturnValue(config),
      exchange: vi.fn().mockResolvedValue({
        access_token: "access-token",
        refresh_token: "refresh-token",
        expires_in: 3600,
        scope: "scope-a scope-b",
        token_type: "Bearer",
      }),
      revoke: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    } satisfies GoogleOAuthDependencies,
  };
}

beforeEach(() => {
  process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("Google OAuth routes", () => {
  it("requires authentication before starting OAuth", async () => {
    const { value } = dependencies({ authenticate: vi.fn().mockResolvedValue(null) });
    const response = await handleGoogleConnect(new Request("http://localhost/api/calendar/google/connect"), value);
    expect(response.status).toBe(401);
  });

  it("starts OAuth with an encrypted, short-lived HttpOnly state cookie", async () => {
    const { value } = dependencies();
    const response = await handleGoogleConnect(new Request("http://localhost/api/calendar/google/connect"), value);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toContain("accounts.google.com");
    expect(response.headers.get("set-cookie")).toContain(`${GOOGLE_OAUTH_COOKIE}=v1.`);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=Lax");
    expect(response.headers.get("set-cookie")).toContain("Max-Age=600");
  });

  it("validates the callback and saves encrypted tokens", async () => {
    const { cookie, state } = createGoogleAuthorizationRequest("user_123", config);
    const { value, store } = dependencies();
    const request = new Request(`http://localhost/api/calendar/google/callback?code=code-1&state=${state}`, {
      headers: { cookie: `${GOOGLE_OAUTH_COOKIE}=${cookie}` },
    });

    const response = await handleGoogleCallback(request, value);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost/course-homeground?google=connected");
    expect(store.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user_123",
        provider: "google",
        access_token_ciphertext: expect.stringMatching(/^v1\./),
        refresh_token_ciphertext: expect.stringMatching(/^v1\./),
      }),
      { onConflict: "user_id,provider" },
    );
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });

  it("rejects a callback when the state belongs to another user", async () => {
    const { cookie, state } = createGoogleAuthorizationRequest("different-user", config);
    const { value, store } = dependencies();
    const request = new Request(`http://localhost/api/calendar/google/callback?code=code-1&state=${state}`, {
      headers: { cookie: `${GOOGLE_OAUTH_COOKIE}=${cookie}` },
    });
    const response = await handleGoogleCallback(request, value);
    expect(response.headers.get("location")).toBe("http://localhost/course-homeground?google=error");
    expect(store.upsert).not.toHaveBeenCalled();
  });

  it("deletes a connection that has no stored token", async () => {
    const { value, store } = dependencies();
    const response = await handleGoogleDisconnect(new Request("http://localhost/api/calendar/google/connection"), value);
    expect(response.status).toBe(204);
    expect(value.revoke).not.toHaveBeenCalled();
    expect(store.deleteSecondEq).toHaveBeenCalledWith("provider", "google");
  });
});
