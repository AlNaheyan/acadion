import { describe, expect, it, vi } from "vitest";

import {
  CourseReadError,
  type ImportedCourseView,
} from "../../../../lib/syllabus";
import {
  handleGetCourse,
  type CourseRouteDependencies,
} from "./handler";

const course: ImportedCourseView = {
  course_id: "course_123",
  course: {
    name: "Microeconomics",
    code: "ECO 20250",
    section: null,
    semester: "Fall 2026",
    instructor: null,
  },
  meetings: [],
  assessments: [],
  assessment_rules: [],
  warnings: [],
};

function dependencies(
  overrides: Partial<CourseRouteDependencies> = {},
): CourseRouteDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue("user_123"),
    readCourse: vi.fn().mockResolvedValue(course),
    persistenceClient: vi.fn().mockReturnValue({}),
    ...overrides,
  } as CourseRouteDependencies;
}

describe("GET /api/courses/:courseId", () => {
  it("requires authentication", async () => {
    const deps = dependencies({ authenticate: vi.fn().mockResolvedValue(null) });
    const response = await handleGetCourse("course_123", deps);

    expect(response.status).toBe(401);
    expect(deps.readCourse).not.toHaveBeenCalled();
  });

  it("returns a user-owned imported course", async () => {
    const deps = dependencies();
    const response = await handleGetCourse("course_123", deps);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(course);
    expect(deps.readCourse).toHaveBeenCalledWith(
      expect.anything(),
      "user_123",
      "course_123",
    );
  });

  it("returns the same not-found response for missing or unowned courses", async () => {
    const deps = dependencies({
      readCourse: vi.fn().mockRejectedValue(
        new CourseReadError("COURSE_NOT_FOUND", "private ownership detail"),
      ),
    });
    const response = await handleGetCourse("unowned", deps);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: { code: "COURSE_NOT_FOUND", message: "Course not found." },
    });
  });

  it("returns a safe failure for malformed stored data", async () => {
    const deps = dependencies({
      readCourse: vi.fn().mockRejectedValue(
        new CourseReadError(
          "INVALID_STORED_COURSE",
          "private malformed row details",
        ),
      ),
    });
    const response = await handleGetCourse("course_123", deps);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({
      error: {
        code: "COURSE_READ_FAILED",
        message: "The imported course could not be loaded.",
      },
    });
    expect(JSON.stringify(body)).not.toContain("private");
  });
});
