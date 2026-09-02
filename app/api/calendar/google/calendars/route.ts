import { handleGoogleCalendarsGet, handleGoogleCalendarsPut } from "./handler";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return handleGoogleCalendarsGet();
}

export async function PUT(request: Request): Promise<Response> {
  return handleGoogleCalendarsPut(request);
}
