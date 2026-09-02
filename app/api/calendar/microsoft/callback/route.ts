import { handleMicrosoftCallback } from "../handler";
export const runtime = "nodejs";
export function GET(request: Request) { return handleMicrosoftCallback(request); }
