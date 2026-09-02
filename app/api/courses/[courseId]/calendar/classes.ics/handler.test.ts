import { describe, expect, it, vi } from "vitest";

import {
  CourseReadError,
  type ImportedCourseView,
} from "../../../../../../lib/syllabus";
import {
  handleClassCalendarDownload,
  type ClassCalendarRouteDependencies,
} from "./handler";

const course: ImportedCourseView = {
  course_id: "course-123",
  course: {
    code: "ECO 20250",
    name: "Microeconomics",
    section: null,
    semester: "Fall 2026",
    instructor: null,
  },
  meetings: [
    {
      days: ["MONDAY", "WEDNESDAY"],
      start_time: "09:30",
      end_time: "10:45",
      location: "Room 101",
      start_date: "2026-08-24",
      end_date: "2026-12-14",
    },
  ],
  assessments: [],
  assessment_rules: [],
  warnings: [],
};

function dependencies(
  overrides: Partial<ClassCalendarRouteDependencies> = {},
): ClassCalendarRouteDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue("user_123"),
    readCourse: vi.fn().mockResolvedValue(course),
    persistenceClient: vi.fn().mockReturnValue({}),
    now: () => new Date("2026-09-01T12:00:00Z"),
    ...overrides,
  } as ClassCalendarRouteDependencies;
}

describe("GET class calendar", () => {
  it("returns an owned course as a downloadable calendar", async () => {
    const response = await handleClassCalendarDownload(
      "course-123",
      dependencies(),
    );
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe(
      "text/calendar; charset=utf-8",
    );
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="eco-20250-classes.ics"',
    );
    expect(response.headers.get("x-calendar-events")).toBe("1");
    expect(body).toContain("BEGIN:VCALENDAR");
    expect(body).toContain("RRULE:FREQ=WEEKLY");
  });

  it("requires authentication before reading a course", async () => {
    const deps = dependencies({ authenticate: vi.fn().mockResolvedValue(null) });
    const response = await handleClassCalendarDownload("course-123", deps);
    expect(response.status).toBe(401);
    expect(deps.readCourse).not.toHaveBeenCalled();
  });

  it("returns one non-enumerable not-found response", async () => {
    const response = await handleClassCalendarDownload(
      "unowned-course",
      dependencies({
        readCourse: vi.fn().mockRejectedValue(
          new CourseReadError("COURSE_NOT_FOUND", "private ownership detail"),
        ),
      }),
    );
    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "COURSE_NOT_FOUND", message: "Course not found." },
    });
  });

  it("rejects an empty or incomplete meeting set", async () => {
    const response = await handleClassCalendarDownload(
      "course-123",
      dependencies({
        readCourse: vi.fn().mockResolvedValue({ ...course, meetings: [] }),
      }),
    );
    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "NO_EXPORTABLE_MEETINGS" },
    });
  });
});
