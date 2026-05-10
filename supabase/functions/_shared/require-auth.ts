// Shared auth gate for paid-API edge functions.
// Returns null on success, or a Response (401) on failure.
//
// Usage:
//   const authFail = await requireAuth(req);
//   if (authFail) return authFail;
//
// Mirrors the pattern in `weather/index.ts` (auth.getClaims on the bearer
// token) so any future change happens in one place.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function unauthorized(message: string, code: string): Response {
  return new Response(
    JSON.stringify({ error: message, code }),
    {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

export interface AuthOk {
  userId: string;
  token: string;
}

/**
 * Validates the caller's bearer token. Returns:
 *   - `null` on success (you can read user via parseAuth if needed),
 *   - a `Response` to return immediately on failure.
 */
export async function requireAuth(req: Request): Promise<Response | null> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized("Authentication required", "UNAUTHORIZED");
  }
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await client.auth.getClaims(token);
    if (error || !data?.claims) {
      return unauthorized("Invalid token", "AUTH_INVALID");
    }
    return null;
  } catch (e) {
    console.error("[requireAuth] check failed:", e);
    return unauthorized("Invalid token", "AUTH_INVALID");
  }
}

/**
 * Returns `{ userId, token }` when the caller is authenticated, otherwise
 * a `Response` (401) to return immediately.
 */
export async function parseAuth(req: Request): Promise<AuthOk | Response> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return unauthorized("Authentication required", "UNAUTHORIZED");
  }
  try {
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const token = authHeader.replace("Bearer ", "");
    const { data, error } = await client.auth.getClaims(token);
    const sub = (data?.claims as { sub?: string } | undefined)?.sub;
    if (error || !sub) {
      return unauthorized("Invalid token", "AUTH_INVALID");
    }
    return { userId: sub, token };
  } catch (e) {
    console.error("[parseAuth] check failed:", e);
    return unauthorized("Invalid token", "AUTH_INVALID");
  }
}
