import { describe, expect, it, vi } from "vitest";

import type { ImportedCourseView } from "../../../../../../../lib/syllabus";
import { handleGoogleClassCreation, type GoogleClassDependencies } from "./handler";

const course: ImportedCourseView = {
  course_id: "course-1",
  course: { code: "ECO 101", name: "Economics", section: null, semester: "Fall 2026", instructor: null },
  meetings: [{ days: ["MONDAY"], start_time: "09:00", end_time: "10:00", location: null, start_date: "2026-09-01", end_date: "2026-12-01" }],
  assessments: [], assessment_rules: [], warnings: [],
};

function dependencies(overrides: Partial<GoogleClassDependencies> = {}): GoogleClassDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue("user-1"),
    client: vi.fn().mockReturnValue({}),
    readCourse: vi.fn().mockResolvedValue(course),
    accessToken: vi.fn().mockResolvedValue({ token: "access", selectedCalendarId: "calendar-1", connectionId: "connection-1", selectedCalendarTimezone: "America/New_York" }),
    insert: vi.fn().mockResolvedValue({ id: "event-1" }),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("direct Google class creation", () => {
  it("creates a recurring event and persists its provider ID", async () => {
    const deps = dependencies();
    const response = await handleGoogleClassCreation("course-1", deps);
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ created_count: 1, excluded_count: 0 });
    expect(deps.insert).toHaveBeenCalledOnce();
    expect(deps.save).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      connectionId: "connection-1", providerEventId: "event-1", sourceType: "class",
    }));
  });

  it("requires a selected destination calendar", async () => {
    const deps = dependencies({ accessToken: vi.fn().mockResolvedValue({ token: "access", selectedCalendarId: null, connectionId: "connection-1", selectedCalendarTimezone: null }) });
    const response = await handleGoogleClassCreation("course-1", deps);
    expect(response.status).toBe(409);
    expect(deps.insert).not.toHaveBeenCalled();
  });

  it("does not send incomplete meetings", async () => {
    const deps = dependencies({ readCourse: vi.fn().mockResolvedValue({ ...course, meetings: [{ ...course.meetings[0], start_time: null }] }) });
    const response = await handleGoogleClassCreation("course-1", deps);
    expect(response.status).toBe(422);
    expect(deps.insert).not.toHaveBeenCalled();
  });
});
