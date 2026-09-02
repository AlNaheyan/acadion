import { handleMicrosoftEventCreation } from "../handler";
export const runtime = "nodejs";
export async function POST(_request: Request, context: { params: Promise<{ courseId: string }> }) { return handleMicrosoftEventCreation((await context.params).courseId, "class"); }
