import { handleGoogleClassCreation } from "./handler";

export const runtime = "nodejs";

export async function POST(_request: Request, context: { params: Promise<{ courseId: string }> }): Promise<Response> {
  const { courseId } = await context.params;
  return handleGoogleClassCreation(courseId);
}
