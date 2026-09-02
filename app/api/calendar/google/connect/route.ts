import { handleGoogleConnect } from "../handler";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  return handleGoogleConnect(request);
}
