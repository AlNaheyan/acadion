import { handleGoogleAssessmentCreation } from "./handler";
export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ courseId: string }> }): Promise<Response> {
  return handleGoogleAssessmentCreation((await context.params).courseId);
}
