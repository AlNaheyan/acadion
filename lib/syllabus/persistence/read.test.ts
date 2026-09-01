import { describe, expect, it, vi } from "vitest";

import {
  readImportedCourse,
  CourseReadError,
  type CourseReadClient,
} from "./read";

const storedCourse = {
  id: "course_123",
  code: "ECO 20250",
  name: "Microeconomics",
  section: "01",
  semester: "Fall 2026",
  instructor: "Dr. Rivera",
  extraction_status: "success",
  extraction_warnings: [],
  course_meetings: [
    {
      day: "MONDAY",
      start_time: "09:30:00",
      end_time: "10:45:00",
      location: "Room 101",
      start_date: "2026-08-24",
      end_date: "2026-12-14",
    },
    {
      day: "WEDNESDAY",
      start_time: "09:30:00",
      end_time: "10:45:00",
      location: "Room 101",
      start_date: "2026-08-24",
      end_date: "2026-12-14",
    },
  ],
  course_assessments: [
    {
      external_id: "midterm-1",
      type: "midterm",
      title: "Midterm 1",
      release_date: null,
      due_date: null,
      event_date: "2026-10-01",
      due_time: null,
      start_time: "09:30:00",
      end_time: "10:45:00",
      location: "Room 101",
      coverage: null,
      date_status: "confirmed",
      raw_date_text: "October 1",
      source_page: 3,
      source_text: "Midterm 1 — October 1",
    },
  ],
  assessment_rules: [
    {
      type: "quiz",
      rule: "Quizzes occur on Fridays.",
      source_page: 2,
      source_text: "Friday quizzes",
    },
  ],
};

function client(result: { data: unknown; error: { message: string } | null }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const query = {
    eq: vi.fn(),
    maybeSingle,
  };
  query.eq.mockReturnValue(query);
  const select = vi.fn().mockReturnValue(query);
  const from = vi.fn().mockReturnValue({ select });

  return {
    client: { from } as unknown as CourseReadClient,
    from,
    select,
    query,
  };
}

describe("readImportedCourse", () => {
  it("returns canonical frontend data scoped to owner and course", async () => {
    const database = client({ data: storedCourse, error: null });

    const result = await readImportedCourse(
      database.client,
      "user_123",
      "course_123",
    );

    expect(database.from).toHaveBeenCalledWith("imported_courses");
    expect(database.query.eq).toHaveBeenNthCalledWith(1, "id", "course_123");
    expect(database.query.eq).toHaveBeenNthCalledWith(2, "user_id", "user_123");
    expect(result).toMatchObject({
      course_id: "course_123",
      course: { code: "ECO 20250" },
      meetings: [
        {
          days: ["MONDAY", "WEDNESDAY"],
          start_time: "09:30",
          end_time: "10:45",
        },
      ],
      assessments: [
        {
          id: "midterm-1",
          date: "2026-10-01",
          source: { page: 3, text: "Midterm 1 — October 1" },
        },
      ],
    });
  });

  it("does not distinguish a missing course from a course outside ownership", async () => {
    const database = client({ data: null, error: null });
    await expect(
      readImportedCourse(database.client, "user_123", "someone-elses-course"),
    ).rejects.toMatchObject({ code: "COURSE_NOT_FOUND" });
  });

  it("rejects malformed stored data", async () => {
    const database = client({
      data: { ...storedCourse, extraction_warnings: "not-an-array" },
      error: null,
    });
    await expect(
      readImportedCourse(database.client, "user_123", "course_123"),
    ).rejects.toBeInstanceOf(CourseReadError);
    await expect(
      readImportedCourse(database.client, "user_123", "course_123"),
    ).rejects.toMatchObject({ code: "INVALID_STORED_COURSE" });
  });

  it("maps database failures without exposing their details", async () => {
    const database = client({
      data: null,
      error: { message: "private database details" },
    });
    const promise = readImportedCourse(database.client, "user_123", "course_123");
    await expect(promise).rejects.toMatchObject({
      code: "COURSE_QUERY_FAILED",
      message: "The imported course could not be loaded.",
    });
  });
});
