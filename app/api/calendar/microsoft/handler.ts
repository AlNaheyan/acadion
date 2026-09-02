import { auth } from "@clerk/nextjs/server";
import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import { createMicrosoftAuthorizationRequest, deleteMicrosoftConnection, exchangeMicrosoftAuthorizationCode, microsoftOAuthConfig, MICROSOFT_OAUTH_COOKIE, saveMicrosoftConnection, validateMicrosoftOAuthState, type CalendarConnectionClient } from "../../../../lib/calendar/providers";

export interface MicrosoftOAuthDependencies {
  authenticate(): Promise<string | null>; client(): CalendarConnectionClient;
  config: typeof microsoftOAuthConfig; exchange: typeof exchangeMicrosoftAuthorizationCode;
}
const defaults: MicrosoftOAuthDependencies = {
  async authenticate() { return (await auth()).userId; },
  client: () => createSupabaseServerClient() as unknown as CalendarConnectionClient,
  config: microsoftOAuthConfig, exchange: exchangeMicrosoftAuthorizationCode,
};
function cookie(value: string, maxAge = 600) {
  return `${MICROSOFT_OAUTH_COOKIE}=${value}; Path=/api/calendar/microsoft; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}
function redirect(request: Request, path: string, cookieValue?: string) {
  const headers = new Headers({ Location: new URL(path, request.url).toString() });
  if (cookieValue !== undefined) headers.set("Set-Cookie", cookie(cookieValue, cookieValue ? 600 : 0));
  return new Response(null, { status: 303, headers });
}
function readCookie(request: Request) {
  const prefix = `${MICROSOFT_OAUTH_COOKIE}=`;
  const value = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(prefix));
  return value?.slice(prefix.length) ?? null;
}
export async function handleMicrosoftConnect(request: Request, dependencies: MicrosoftOAuthDependencies = defaults) {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  try {
    const authorization = createMicrosoftAuthorizationRequest(userId, dependencies.config());
    return redirect(request, authorization.url, authorization.cookie);
  } catch { return Response.json({ error: "Microsoft Outlook connection is unavailable." }, { status: 503 }); }
}
export async function handleMicrosoftCallback(request: Request, dependencies: MicrosoftOAuthDependencies = defaults) {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  const url = new URL(request.url); const code = url.searchParams.get("code"); const state = url.searchParams.get("state"); const stored = readCookie(request);
  if (!code || !state || !stored || url.searchParams.has("error")) return redirect(request, "/course-homeground?microsoft=error", "");
  try {
    const payload = validateMicrosoftOAuthState(stored, state, userId);
    const tokens = await dependencies.exchange(code, payload.verifier, dependencies.config());
    await saveMicrosoftConnection(dependencies.client(), userId, tokens);
    return redirect(request, "/course-homeground?microsoft=connected", "");
  } catch { return redirect(request, "/course-homeground?microsoft=error", ""); }
}
export async function handleMicrosoftDisconnect(_request: Request, dependencies: MicrosoftOAuthDependencies = defaults) {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });
  try { await deleteMicrosoftConnection(dependencies.client(), userId); return new Response(null, { status: 204 }); }
  catch { return Response.json({ error: "Microsoft Outlook could not be disconnected." }, { status: 502 }); }
}
