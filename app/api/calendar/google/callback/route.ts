import { handleGoogleCallback } from "../handler";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return handleGoogleCallback(request);
}
