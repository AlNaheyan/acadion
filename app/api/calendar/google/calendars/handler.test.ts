import { describe, expect, it, vi } from "vitest";

import type { CalendarConnectionClient, GoogleCalendarChoice } from "../../../../../lib/calendar/providers";
import { handleGoogleCalendarsGet, handleGoogleCalendarsPut, type GoogleCalendarDependencies } from "./handler";

const calendars: GoogleCalendarChoice[] = [
  { id: "primary", name: "My calendar", timeZone: "America/New_York", primary: true, accessRole: "owner" },
];

function dependencies(overrides: Partial<GoogleCalendarDependencies> = {}) {
  const finalEq = vi.fn().mockResolvedValue({ error: null });
  const client = { from: vi.fn().mockReturnValue({
    update: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: finalEq }) }),
  }) } as unknown as CalendarConnectionClient;
  return { finalEq, value: {
    authenticate: vi.fn().mockResolvedValue("user_123"),
    connectionClient: vi.fn().mockReturnValue(client),
    accessToken: vi.fn().mockResolvedValue({ token: "access", selectedCalendarId: null, connectionId: "connection-1", selectedCalendarTimezone: null }),
    list: vi.fn().mockResolvedValue(calendars),
    ...overrides,
  } satisfies GoogleCalendarDependencies };
}

describe("Google calendar selection API", () => {
  it("lists writable calendars and the persisted selection", async () => {
    const { value } = dependencies({ accessToken: vi.fn().mockResolvedValue({ token: "access", selectedCalendarId: "primary", connectionId: "connection-1", selectedCalendarTimezone: "America/New_York" }) });
    const response = await handleGoogleCalendarsGet(value);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ calendars, selected_calendar_id: "primary" });
  });

  it("rejects a calendar not returned by the writable list", async () => {
    const { value, finalEq } = dependencies();
    const response = await handleGoogleCalendarsPut(new Request("http://localhost", {
      method: "PUT", body: JSON.stringify({ calendar_id: "readonly" }),
    }), value);
    expect(response.status).toBe(400);
    expect(finalEq).not.toHaveBeenCalled();
  });

  it("persists the provider-owned calendar metadata", async () => {
    const { value, finalEq } = dependencies();
    const response = await handleGoogleCalendarsPut(new Request("http://localhost", {
      method: "PUT", body: JSON.stringify({ calendar_id: "primary" }),
    }), value);
    expect(response.status).toBe(200);
    expect(finalEq).toHaveBeenCalledWith("provider", "google");
  });
});
