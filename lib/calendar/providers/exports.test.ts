import { describe, expect, it, vi } from "vitest";
import { claimCalendarEvent, type CalendarExportClient } from "./exports";

describe("calendar event claims", () => {
  it("returns the atomic RPC decision", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: false, error: null });
    const client = { rpc } as unknown as CalendarExportClient;
    await expect(claimCalendarEvent(client, {
      connectionId: "connection", courseId: "course", sourceType: "class", logicalKey: "class:key",
    })).resolves.toBe(false);
    expect(rpc).toHaveBeenCalledWith("claim_calendar_event", expect.objectContaining({ p_logical_key: "class:key" }));
  });
});
