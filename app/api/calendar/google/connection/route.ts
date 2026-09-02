import { handleGoogleDisconnect } from "../handler";

export const runtime = "nodejs";

export async function DELETE(request: Request): Promise<Response> {
  return handleGoogleDisconnect(request);
}
