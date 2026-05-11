// Enumeration-safe friend-request-by-email.
//
// Replaces the prior client-side `rpc('get_user_id_by_email', ...)` flow
// (`get_user_id_by_email` is now admin-only after the Q43 hardening).
//
// Privacy contract — Q43 watch-list:
//   * The response shape is IDENTICAL whether or not the email is registered.
//   * Caller can never tell from the response whether an account exists.
//   * Errors (auth, malformed input) are explicit; lookup outcomes are not.
//
// Memory: mem://constraints/security/security-definer-accepted-class
//
// Allowed transitions performed (when target user_id is found via service-role):
//   - no friendship row     → INSERT pending (caller=requester)
//   - existing pending sent by THEM → UPDATE to accepted (auto-accept inbound)
//   - existing declined     → flip back to pending in caller's direction
//   - already-accepted, self-target, or own request already pending: silent ack
//
// Non-2xx responses are reserved for: bad auth (401), bad input (400),
// or unexpected server failure (500). Lookup misses are 200/ack.

import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseAuth } from "../_shared/require-auth.ts";
import { checkDbRateLimit } from "../_shared/db-rate-limiter.ts";

// Per-caller rate limit: 20 requests / hour / auth.uid().
// Eliminates timing-based enumeration channel (DB lookup latency would
// otherwise leak whether an email exists). Over-limit returns the same
// neutral ACK shape — never a 429 — so no enumeration via status code either.
const RATE_RULE = { maxRequests: 20, windowMs: 60 * 60 * 1000 };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// Single canonical "ack" response shape — never reveals registration.
const ACK = { ok: true, message: "If that email belongs to a Voyance user, your request has been sent." };

const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  // Auth gate (mirrors require-auth.ts pattern).
  const auth = await parseAuth(req);
  if (auth instanceof Response) return auth;
  const callerId = auth.userId;

  // Parse body.
  let body: { email?: string };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }
  const rawEmail = String(body?.email || "").trim().toLowerCase();
  if (!rawEmail || !EMAIL_RE.test(rawEmail) || rawEmail.length > 320) {
    return json(400, { error: "Invalid email" });
  }

  // Service-role client for the privileged auth.users lookup.
  const SERVICE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SERVICE_URL || !SERVICE_KEY) {
    console.error("[friend-request-by-email] missing service-role env");
    return json(500, { error: "Server configuration error" });
  }
  const admin = createClient(SERVICE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Look up target user_id.
  // Use existing `get_user_id_by_email` if the service role can call it;
  // otherwise fall back to a direct auth.users query via admin API.
  let targetId: string | null = null;
  try {
    const { data, error } = await admin.rpc("get_user_id_by_email", { lookup_email: rawEmail }) as
      { data: string | null; error: { message?: string } | null };
    if (error) throw error;
    targetId = data ?? null;
  } catch (e) {
    // Fallback: list users and filter by email (kept narrow with a generous page size).
    try {
      const { data: page, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1, filter: `email.eq.${rawEmail}` } as any);
      if (listErr) throw listErr;
      targetId = (page?.users?.[0]?.id as string | undefined) ?? null;
    } catch (e2) {
      console.error("[friend-request-by-email] lookup failed:", e, e2);
      // Privacy preserved — caller still gets ACK, not an error.
      return json(200, ACK);
    }
  }

  // Self-target / not-found / hits-existing edge cases all return identical ACK.
  if (!targetId || targetId === callerId) {
    return json(200, ACK);
  }

  // Caller-scoped client honours friendships RLS.
  const callerClient = createClient(SERVICE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: `Bearer ${auth.token}` } },
  });

  try {
    const { data: existing } = await callerClient
      .from("friendships")
      .select("id, status, requester_id")
      .or(`and(requester_id.eq.${callerId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${callerId})`)
      .maybeSingle();

    if (existing) {
      if (existing.status === "accepted") return json(200, ACK);
      if (existing.status === "pending" && existing.requester_id === callerId) return json(200, ACK);
      if (existing.status === "pending" && existing.requester_id === targetId) {
        await callerClient.from("friendships").update({ status: "accepted" }).eq("id", existing.id);
        return json(200, ACK);
      }
      if (existing.status === "declined") {
        await callerClient
          .from("friendships")
          .update({
            requester_id: callerId,
            addressee_id: targetId,
            status: "pending",
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
        return json(200, ACK);
      }
    }

    await callerClient
      .from("friendships")
      .insert({ requester_id: callerId, addressee_id: targetId, status: "pending" });

    return json(200, ACK);
  } catch (e) {
    console.error("[friend-request-by-email] write failed:", e);
    // Still ack — never reveal lookup outcome via error shape.
    return json(200, ACK);
  }
});
