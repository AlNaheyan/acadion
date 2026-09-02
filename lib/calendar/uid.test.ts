import { describe, expect, it } from "vitest";

import { createCalendarEventUid } from "./uid";

describe("createCalendarEventUid", () => {
  it("is stable for the same logical event", () => {
    const first = createCalendarEventUid("course-123", "assessment", "midterm-1");
    const second = createCalendarEventUid("course-123", "assessment", "midterm-1");
    expect(first).toBe(second);
  });

  it("is unique across courses, event kinds, and event IDs", () => {
    const values = new Set([
      createCalendarEventUid("course-123", "assessment", "midterm-1"),
      createCalendarEventUid("course-456", "assessment", "midterm-1"),
      createCalendarEventUid("course-123", "class", "midterm-1"),
      createCalendarEventUid("course-123", "assessment", "midterm-2"),
    ]);
    expect(values.size).toBe(4);
  });

  it("never exposes or copies unsafe source characters", () => {
    const uid = createCalendarEventUid(
      "course\r\nBAD:value",
      "assessment",
      "exam,1; DROP calendar",
    );
    expect(uid).toMatch(/^assessment-[a-f0-9]{32}@calendar\.acadion$/);
    expect(uid).not.toContain("\r");
    expect(uid).not.toContain(";");
  });
});
