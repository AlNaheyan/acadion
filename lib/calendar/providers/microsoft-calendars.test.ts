import { describe, expect, it, vi } from "vitest";
import { listWritableMicrosoftCalendars } from "./microsoft-calendars";
describe("Microsoft calendars", () => {
  it("returns only editable calendars", async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ value: [
      { id: "one", name: "Calendar", canEdit: true, isDefaultCalendar: true },
      { id: "two", name: "Birthdays", canEdit: false },
    ] }));
    await expect(listWritableMicrosoftCalendars("access", fetcher)).resolves.toEqual([{ id: "one", name: "Calendar", canEdit: true, isDefault: true }]);
    expect(fetcher.mock.calls[0][1]).toMatchObject({ headers: { Authorization: "Bearer access" } });
  });
});
