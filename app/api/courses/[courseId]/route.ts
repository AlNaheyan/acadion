import { handleGetCourse } from "./handler";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ courseId: string }> },
): Promise<Response> {
  const { courseId } = await context.params;
  return handleGetCourse(courseId);
}
