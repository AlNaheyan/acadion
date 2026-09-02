import { auth } from "@clerk/nextjs/server";

import { createSupabaseServerClient } from "../../../../lib/supabase-server";
import {
  createGoogleAuthorizationRequest,
  deleteGoogleConnection,
  exchangeGoogleAuthorizationCode,
  getGoogleConnectionSecrets,
  googleOAuthConfig,
  GOOGLE_OAUTH_COOKIE,
  revokeGoogleToken,
  saveGoogleConnection,
  validateGoogleOAuthState,
  type CalendarConnectionClient,
} from "../../../../lib/calendar/providers";

const COOKIE_MAX_AGE_SECONDS = 10 * 60;

export interface GoogleOAuthDependencies {
  authenticate(): Promise<string | null>;
  connectionClient(): CalendarConnectionClient;
  config: typeof googleOAuthConfig;
  exchange: typeof exchangeGoogleAuthorizationCode;
  revoke: typeof revokeGoogleToken;
}

const defaultDependencies: GoogleOAuthDependencies = {
  async authenticate() {
    const { userId } = await auth();
    return userId;
  },
  connectionClient() {
    return createSupabaseServerClient() as unknown as CalendarConnectionClient;
  },
  config: googleOAuthConfig,
  exchange: exchangeGoogleAuthorizationCode,
  revoke: revokeGoogleToken,
};

function cookieOptions(maxAge: number): string {
  return `${GOOGLE_OAUTH_COOKIE}=; Path=/api/calendar/google; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

function oauthCookie(value: string): string {
  return cookieOptions(COOKIE_MAX_AGE_SECONDS).replace(`${GOOGLE_OAUTH_COOKIE}=`, `${GOOGLE_OAUTH_COOKIE}=${value}`);
}

function redirect(request: Request, path: string, cookie?: string): Response {
  const headers = new Headers({ Location: new URL(path, request.url).toString() });
  if (cookie) headers.set("Set-Cookie", cookie);
  return new Response(null, { status: 303, headers });
}

function readCookie(request: Request, name: string): string | null {
  const match = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`));
  return match ? match.slice(name.length + 1) : null;
}

export async function handleGoogleConnect(
  request: Request,
  dependencies: GoogleOAuthDependencies = defaultDependencies,
): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });

  try {
    const authorization = createGoogleAuthorizationRequest(userId, dependencies.config());
    return new Response(null, {
      status: 303,
      headers: {
        Location: authorization.url,
        "Set-Cookie": oauthCookie(authorization.cookie),
      },
    });
  } catch {
    return Response.json({ error: "Google Calendar connection is unavailable." }, { status: 503 });
  }
}

export async function handleGoogleCallback(
  request: Request,
  dependencies: GoogleOAuthDependencies = defaultDependencies,
): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookie = readCookie(request, GOOGLE_OAUTH_COOKIE);
  if (!code || !state || !cookie || url.searchParams.has("error")) {
    return redirect(request, "/course-homeground?google=error", cookieOptions(0));
  }

  try {
    const payload = validateGoogleOAuthState(cookie, state, userId);
    const tokens = await dependencies.exchange(code, payload.verifier, dependencies.config());
    await saveGoogleConnection(dependencies.connectionClient(), userId, tokens);
    return redirect(request, "/course-homeground?google=connected", cookieOptions(0));
  } catch {
    return redirect(request, "/course-homeground?google=error", cookieOptions(0));
  }
}

export async function handleGoogleDisconnect(
  _request: Request,
  dependencies: GoogleOAuthDependencies = defaultDependencies,
): Promise<Response> {
  const userId = await dependencies.authenticate();
  if (!userId) return Response.json({ error: "Authentication is required." }, { status: 401 });

  try {
    const client = dependencies.connectionClient();
    const connection = await getGoogleConnectionSecrets(client, userId);
    if (connection) await dependencies.revoke(connection.refreshToken);
    await deleteGoogleConnection(client, userId);
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: "Google Calendar could not be disconnected." }, { status: 502 });
  }
}
