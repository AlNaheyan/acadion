import { handleMicrosoftConnect } from "../handler";
export const runtime = "nodejs";
export function GET(request: Request) { return handleMicrosoftConnect(request); }
