import { handleMicrosoftCalendarsGet, handleMicrosoftCalendarsPut } from "./handler";
export const runtime = "nodejs";
export function GET() { return handleMicrosoftCalendarsGet(); }
export function PUT(request: Request) { return handleMicrosoftCalendarsPut(request); }
