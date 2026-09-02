import { describe, expect, it, vi } from "vitest";
import type { ImportedCourseView } from "../../../../../../../lib/syllabus";
import { handleGoogleAssessmentCreation, type GoogleAssessmentDependencies } from "./handler";

const course: ImportedCourseView = {
  course_id: "course-1", course: { code: "ECO 101", name: null, section: null, semester: null, instructor: null }, meetings: [], assessment_rules: [], warnings: [],
  assessments: ["one", "two"].map((id) => ({ id, type: "exam", title: id, release_date: null, due_date: null, date: "2026-10-01", due_time: null, start_time: "09:00", end_time: "10:00", location: null, coverage: null, date_status: "confirmed", raw_date_text: null, source: null })),
};
function deps(): GoogleAssessmentDependencies {
  const insert = vi.fn().mockResolvedValueOnce({ id: "event-1" }).mockRejectedValueOnce(new Error("provider"));
  return { authenticate: vi.fn().mockResolvedValue("user"), client: () => ({}), readCourse: vi.fn().mockResolvedValue(course),
    accessToken: vi.fn().mockResolvedValue({ token: "access", selectedCalendarId: "calendar", connectionId: "connection", selectedCalendarTimezone: "UTC" }),
    insert, save: vi.fn().mockResolvedValue(undefined), claim: vi.fn().mockResolvedValue(true), markFailed: vi.fn().mockResolvedValue(undefined) };
}
describe("bulk Google assessments", () => {
  it("keeps per-item results when one provider call fails", async () => {
    const dependencies = deps();
    const response = await handleGoogleAssessmentCreation("course-1", dependencies);
    expect(response.status).toBe(207);
    await expect(response.json()).resolves.toMatchObject({ created_count: 1, failed_count: 1 });
    expect(dependencies.save).toHaveBeenCalledOnce();
    expect(dependencies.markFailed).toHaveBeenCalledOnce();
  });
});
