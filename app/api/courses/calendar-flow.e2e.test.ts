import { describe, expect, it, vi } from "vitest";
import { handleCourseImport, type ImportCourseDependencies } from "./import/handler";
import { handleClassCalendarDownload } from "./[courseId]/calendar/classes.ics/handler";
import { handleAssessmentCalendarDownload } from "./[courseId]/calendar/assessments.ics/handler";
import type { CourseExtraction, ImportedCourseView } from "../../../lib/syllabus";

const extraction: CourseExtraction = {
  course: { code: "ECO 101", name: "Economics", section: "01", semester: "Fall 2026", instructor: "Dr. Rivera" },
  meetings: [{ days: ["MONDAY", "WEDNESDAY"], start_time: "09:00", end_time: "10:00", location: "Room 1", start_date: "2026-09-01", end_date: "2026-12-01" }],
  assessments: [{ id: "midterm", type: "midterm", title: "Midterm", release_date: null, due_date: null, date: "2026-10-01", due_time: null, start_time: "09:00", end_time: "10:00", location: "Room 1", coverage: null, date_status: "confirmed", raw_date_text: "October 1", source: { page: 1, text: "Midterm October 1" } }],
  assessment_rules: [], metadata: { source_type: "syllabus", extraction_status: "success", warnings: [] },
};

describe("syllabus upload to both ICS downloads", () => {
  it("preserves the imported course through recurring and assessment calendars", async () => {
    let stored: ImportedCourseView | null = null;
    const importDependencies: ImportCourseDependencies = {
      authenticate: vi.fn().mockResolvedValue("user"), validateUpload: vi.fn().mockResolvedValue(undefined),
      extractText: vi.fn().mockResolvedValue([{ page: 1, text: "syllabus text", items: [] }]),
      extractStructured: vi.fn().mockResolvedValue(extraction), persistenceClient: () => ({}) as never,
      persist: vi.fn().mockImplementation(async () => {
        stored = { course_id: "course-1", course: extraction.course, meetings: extraction.meetings, assessments: extraction.assessments, assessment_rules: [], warnings: [] };
        return { courseId: "course-1" };
      }),
    };
    const form = new FormData(); form.append("file", new Blob(["%PDF-1.7 test"], { type: "application/pdf" }), "syllabus.pdf");
    const imported = await handleCourseImport(new Request("http://localhost/api/courses/import", { method: "POST", body: form }), importDependencies);
    expect(imported.status).toBe(201); expect((await imported.json()).course_id).toBe("course-1");
    expect(stored).not.toBeNull();
    const calendarDependencies = { authenticate: vi.fn().mockResolvedValue("user"), persistenceClient: () => ({}) as never, readCourse: vi.fn().mockImplementation(async () => stored!), now: () => new Date("2026-09-02T00:00:00Z") };
    const classes = await handleClassCalendarDownload("course-1", calendarDependencies);
    const assessments = await handleAssessmentCalendarDownload("course-1", calendarDependencies);
    expect(classes.status).toBe(200); expect(await classes.text()).toContain("RRULE:FREQ=WEEKLY;BYDAY=MO,WE");
    expect(assessments.status).toBe(200); expect(await assessments.text()).toContain("SUMMARY:ECO 101 - Midterm");
    expect(classes.headers.get("x-calendar-events")).toBe("1"); expect(assessments.headers.get("x-calendar-events")).toBe("1");
  });
});
