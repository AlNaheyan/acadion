import { describe, expect, it, vi } from "vitest";
import type { ImportedCourseView } from "../../../../../../lib/syllabus";
import { handleMicrosoftEventCreation, type MicrosoftEventDependencies } from "./handler";
const course: ImportedCourseView = { course_id: "course", course: { code: "ECO", name: null, section: null, semester: null, instructor: null }, meetings: [{ days: ["MONDAY"], start_time: "09:00", end_time: "10:00", location: null, start_date: "2026-09-01", end_date: "2026-12-01" }], assessments: [], assessment_rules: [], warnings: [] };
function deps(overrides: Partial<MicrosoftEventDependencies> = {}): MicrosoftEventDependencies { return {
  authenticate: vi.fn().mockResolvedValue("user"), client: () => ({}), readCourse: vi.fn().mockResolvedValue(course),
  accessToken: vi.fn().mockResolvedValue({ token: "access", connectionId: "connection", accessToken: "access", refreshToken: "refresh", expiresAt: "2099-01-01", selectedCalendarId: "calendar", selectedCalendarTimezone: null }),
  insert: vi.fn().mockResolvedValue({ id: "event" }), claim: vi.fn().mockResolvedValue(true), save: vi.fn().mockResolvedValue(undefined), markFailed: vi.fn().mockResolvedValue(undefined), ...overrides,
}; }
describe("Microsoft event creation", () => {
  it("creates and records Outlook events", async () => { const dependencies = deps(); const response = await handleMicrosoftEventCreation("course", "class", dependencies); expect(response.status).toBe(201); expect(dependencies.save).toHaveBeenCalledOnce(); });
  it("marks failures and reports partial results", async () => { const dependencies = deps({ insert: vi.fn().mockRejectedValue(new Error("Graph")) }); const response = await handleMicrosoftEventCreation("course", "class", dependencies); expect(response.status).toBe(207); expect(dependencies.markFailed).toHaveBeenCalledOnce(); });
  it("skips a previously claimed event", async () => { const dependencies = deps({ claim: vi.fn().mockResolvedValue(false) }); const response = await handleMicrosoftEventCreation("course", "class", dependencies); await expect(response.json()).resolves.toMatchObject({ skipped_count: 1 }); expect(dependencies.insert).not.toHaveBeenCalled(); });
});
