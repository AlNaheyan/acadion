import { describe, expect, it, vi } from "vitest";

import {
  CourseReadError,
  type Assessment,
  type ImportedCourseView,
} from "../../../../../../lib/syllabus";
import {
  handleAssessmentCalendarDownload,
  type AssessmentCalendarRouteDependencies,
} from "./handler";

function assessment(overrides: Partial<Assessment> = {}): Assessment {
  return {
    id: "midterm-1",
    type: "midterm",
    title: "Midterm 1",
    release_date: null,
    due_date: null,
    date: "2026-10-01",
    due_time: null,
    start_time: "09:30",
    end_time: "10:45",
    location: "Room 101",
    coverage: null,
    date_status: "confirmed",
    raw_date_text: "October 1",
    source: { page: 4, text: "Midterm October 1" },
    ...overrides,
  };
}

const course: ImportedCourseView = {
  course_id: "course-123",
  course: {
    code: "ECO 20250",
    name: "Microeconomics",
    section: null,
    semester: "Fall 2026",
    instructor: null,
  },
  meetings: [],
  assessments: [
    assessment(),
    assessment({
      id: "final-exam",
      type: "final_exam",
      title: "Final Exam",
      date: null,
      start_time: null,
      end_time: null,
      date_status: "TBD",
    }),
  ],
  assessment_rules: [],
  warnings: [],
};

function dependencies(
  overrides: Partial<AssessmentCalendarRouteDependencies> = {},
): AssessmentCalendarRouteDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue("user_123"),
    readCourse: vi.fn().mockResolvedValue(course),
    persistenceClient: vi.fn().mockReturnValue({}),
    now: () => new Date("2026-09-01T12:00:00Z"),
    ...overrides,
  } as AssessmentCalendarRouteDependencies;
}

describe("GET assessment calendar", () => {
  it("downloads only confirmed safe assessments with metadata headers", async () => {
    const response = await handleAssessmentCalendarDownload(
      "course-123",
      dependencies(),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="eco-20250-assessments.ics"',
    );
    expect(response.headers.get("x-calendar-events")).toBe("1");
    expect(response.headers.get("x-calendar-excluded")).toBe("1");
    expect(body).toContain("Midterm 1");
    expect(body).not.toContain("Final Exam");
  });

  it("requires authentication before reading the course", async () => {
    const deps = dependencies({ authenticate: vi.fn().mockResolvedValue(null) });
    const response = await handleAssessmentCalendarDownload("course-123", deps);
    expect(response.status).toBe(401);
    expect(deps.readCourse).not.toHaveBeenCalled();
  });

  it("does not disclose whether another user's course exists", async () => {
    const response = await handleAssessmentCalendarDownload(
      "unowned",
      dependencies({
        readCourse: vi.fn().mockRejectedValue(
          new CourseReadError("COURSE_NOT_FOUND", "private owner detail"),
        ),
      }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "COURSE_NOT_FOUND", message: "Course not found." },
    });
  });

  it("returns exclusion metadata when no confirmed set exists", async () => {
    const response = await handleAssessmentCalendarDownload(
      "course-123",
      dependencies({
        readCourse: vi.fn().mockResolvedValue({
          ...course,
          assessments: [course.assessments[1]],
        }),
      }),
    );
    expect(response.status).toBe(422);
    expect(response.headers.get("x-calendar-events")).toBe("0");
    expect(response.headers.get("x-calendar-excluded")).toBe("1");
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NO_EXPORTABLE_ASSESSMENTS" },
    });
  });
});
