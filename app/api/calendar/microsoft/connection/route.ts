import { handleMicrosoftDisconnect } from "../handler";
export const runtime = "nodejs";
export function DELETE(request: Request) { return handleMicrosoftDisconnect(request); }
