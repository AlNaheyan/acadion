import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { generateClassCalendar } from "../../../../../../lib/calendar";
import { createSupabaseServerClient } from "../../../../../../lib/supabase-server";
import {
  CourseReadError,
  readImportedCourse,
  type CourseReadClient,
  type ImportedCourseView,
} from "../../../../../../lib/syllabus";

export interface ClassCalendarRouteDependencies {
  authenticate(): Promise<string | null>;
  readCourse(
    client: CourseReadClient,
    userId: string,
    courseId: string,
  ): Promise<ImportedCourseView>;
  persistenceClient(): CourseReadClient;
  now(): Date;
}

const defaultDependencies: ClassCalendarRouteDependencies = {
  async authenticate() {
    const { userId } = await auth();
    return userId;
  },
  readCourse: readImportedCourse,
  persistenceClient() {
    return createSupabaseServerClient() as unknown as CourseReadClient;
  },
  now: () => new Date(),
};

function calendarFilename(course: ImportedCourseView): string {
  const label = course.course.code ?? course.course.name ?? "course";
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `${slug || "course"}-classes.ics`;
}

export async function handleClassCalendarDownload(
  courseId: string,
  dependencies: ClassCalendarRouteDependencies = defaultDependencies,
): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication is required." } },
      { status: 401 },
    );
  }

  try {
    const course = await dependencies.readCourse(
      dependencies.persistenceClient(),
      userId,
      courseId,
    );
    const generated = generateClassCalendar({
      courseId: course.course_id,
      course: course.course,
      meetings: course.meetings,
      generatedAt: dependencies.now(),
    });

    if (generated.exportedCount === 0) {
      return NextResponse.json(
        {
          error: {
            code: "NO_EXPORTABLE_MEETINGS",
            message: "No complete class meetings are available for export.",
          },
        },
        { status: 422 },
      );
    }

    return new Response(generated.ics, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${calendarFilename(course)}"`,
        "Cache-Control": "private, no-store",
        "X-Calendar-Events": String(generated.exportedCount),
        "X-Calendar-Excluded": String(generated.excludedCount),
      },
    });
  } catch (error) {
    if (error instanceof CourseReadError && error.code === "COURSE_NOT_FOUND") {
      return NextResponse.json(
        { error: { code: "COURSE_NOT_FOUND", message: "Course not found." } },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        error: {
          code: "CALENDAR_EXPORT_FAILED",
          message: "The class calendar could not be generated.",
        },
      },
      { status: 500 },
    );
  }
}
