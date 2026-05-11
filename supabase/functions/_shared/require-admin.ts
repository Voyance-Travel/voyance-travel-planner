// Shared admin auth gate. Validates JWT and verifies the caller has the
// `admin` role in `user_roles`. Returns null on success, or a Response
// (401/403) on failure. Mirrors the pattern in `delete-users/index.ts`.

import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function deny(message: string, status: number, code: string): Response {
  return new Response(
    JSON.stringify({ error: message, code }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
}

export async function requireAdmin(
  req: Request,
): Promise<Response | { userId: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return deny("Authentication required", 401, "UNAUTHORIZED");
  }
  const token = authHeader.replace("Bearer ", "");

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Service-role bypass for trusted server-to-server calls.
  if (token === serviceKey) {
    return { userId: "service_role" };
  }

  try {
    const authClient = createClient(url, anonKey);
    const { data, error } = await authClient.auth.getClaims(token);
    const sub = (data?.claims as { sub?: string } | undefined)?.sub;
    if (error || !sub) {
      return deny("Invalid token", 401, "AUTH_INVALID");
    }

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: roleData, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", sub)
      .eq("role", "admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return deny("Admin access required", 403, "FORBIDDEN");
    }
    return { userId: sub };
  } catch (e) {
    console.error("[requireAdmin] check failed:", e);
    return deny("Invalid token", 401, "AUTH_INVALID");
  }
}
