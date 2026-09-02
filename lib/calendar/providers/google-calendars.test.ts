import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarConnectionClient } from "./connections";
import { googleAccessToken, listWritableGoogleCalendars } from "./google-calendars";

beforeEach(() => {
  process.env.OAUTH_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 4).toString("base64");
});

describe("Google calendar selection provider", () => {
  it("requests and returns only complete writable calendars", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ items: [
      { id: "primary", summary: "My calendar", timeZone: "America/New_York", primary: true, accessRole: "owner" },
      { id: "shared", summary: "Shared", timeZone: "UTC", accessRole: "writer" },
      { id: "readonly", summary: "Holidays", timeZone: "UTC", accessRole: "reader" },
    ] }));
    await expect(listWritableGoogleCalendars("token", fetcher)).resolves.toHaveLength(2);
    const url = new URL(String(fetcher.mock.calls[0][0]));
    expect(url.searchParams.get("minAccessRole")).toBe("writer");
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer token" } });
  });

  it("uses a stored access token before its refresh window", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: {
      access_token_ciphertext: "v1.invalid",
      refresh_token_ciphertext: "v1.invalid",
      token_expires_at: new Date(20_000_000).toISOString(),
      selected_calendar_id: "primary",
    }, error: null });
    const client = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) }),
      }),
    } as unknown as CalendarConnectionClient;
    // Replace ciphertext with real values after constructing the compact mock.
    const { encryptOAuthSecret } = await import("./token-crypto");
    const row = (await maybeSingle()).data;
    row.access_token_ciphertext = encryptOAuthSecret("stored-access");
    row.refresh_token_ciphertext = encryptOAuthSecret("stored-refresh");
    await expect(googleAccessToken(client, "user", 1_000_000)).resolves.toEqual({
      token: "stored-access",
      selectedCalendarId: "primary",
    });
  });
});
