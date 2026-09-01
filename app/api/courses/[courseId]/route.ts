import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import {
  CourseReadError,
  readImportedCourse,
  type CourseReadClient,
  type ImportedCourseView,
} from "../../../../lib/syllabus";

export const runtime = "nodejs";

export interface CourseRouteDependencies {
  authenticate(): Promise<string | null>;
  readCourse(
    client: CourseReadClient,
    userId: string,
    courseId: string,
  ): Promise<ImportedCourseView>;
  persistenceClient(): CourseReadClient;
}

const defaultDependencies: CourseRouteDependencies = {
  async authenticate() {
    const { userId } = await auth();
    return userId;
  },
  readCourse: readImportedCourse,
  persistenceClient() {
    return createSupabaseServerClient() as unknown as CourseReadClient;
  },
};

export async function handleGetCourse(
  courseId: string,
  dependencies: CourseRouteDependencies = defaultDependencies,
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
    return NextResponse.json(course, { status: 200 });
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
          code: "COURSE_READ_FAILED",
          message: "The imported course could not be loaded.",
        },
      },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  const { courseId } = await context.params;
  return handleGetCourse(courseId);
}
