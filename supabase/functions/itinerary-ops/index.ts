/**
 * itinerary-ops edge function
 *
 * Sibling of `generate-itinerary` that owns the lighter "edit / read / repair"
 * actions. Split out from the original mega-router so the `generate-itinerary`
 * bundle stays under Supabase's 5 MB deploy ceiling.
 *
 * Actions handled here:
 *   - get-trip
 *   - get-itinerary
 *   - save-itinerary
 *   - toggle-activity-lock
 *   - sync-itinerary-tables
 *   - repair-trip-costs
 *
 * Generation actions (generate-trip, generate-trip-day, generate-day,
 * generate-full, regenerate-day) stay in `generate-itinerary`.
 *
 * Auth + rate-limit logic mirrors generate-itinerary/index.ts. Proof-of-charge
 * gate is NOT applied here — none of the above actions are paid generation
 * endpoints.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

import { handleGetTrip } from './action-get-trip.ts';
import { handleSaveItinerary } from './action-save-itinerary.ts';
import { handleGetItinerary } from './action-get-itinerary.ts';
import { handleToggleActivityLock } from './action-toggle-lock.ts';
import { handleSyncItineraryTables } from '../generate-itinerary/action-sync-tables.ts';
import { handleRepairTripCosts } from './action-repair-costs.ts';
import { corsHeaders, type ActionContext } from '../generate-itinerary/action-types.ts';

import { checkDbRateLimit, type RateLimitRule } from "../_shared/db-rate-limiter.ts";

const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  default: { maxRequests: 60, windowMs: 60_000 },
};

async function checkRateLimit(
  supabaseAdmin: any,
  userId: string,
  action: string,
): Promise<{ allowed: boolean; remaining: number }> {
  const rule = RATE_LIMIT_RULES[action] || RATE_LIMIT_RULES.default;
  const result = await checkDbRateLimit(
    supabaseAdmin,
    userId,
    `itinerary-ops:${action}`,
    rule,
    userId,
  );
  return { allowed: result.allowed, remaining: result.remaining };
}

async function validateAuth(req: Request, supabase: any): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[itinerary-ops] Missing or invalid Authorization header');
    return null;
  }
  const token = authHeader.replace('Bearer ', '');
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3 || tokenParts.some((p: string) => p.length === 0)) {
    console.warn('[itinerary-ops] Malformed JWT — invalid segment count:', tokenParts.length);
    return null;
  }
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.warn('[itinerary-ops] Auth getUser failed:', error?.message);
      return null;
    }
    return { userId: data.user.id };
  } catch (err) {
    console.error('[itinerary-ops] Auth exception:', err);
    return null;
  }
}

function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload?.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Service-role bypass mirrors generate-itinerary so self-chain callers
    // (e.g. action-generate-trip-day → save-itinerary) work identically.
    const bearerToken = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const isServiceRoleCall =
      !!bearerToken &&
      (bearerToken === supabaseKey || decodeJwtRole(bearerToken) === 'service_role');

    let authResult: { userId: string } | null = null;

    if (isServiceRoleCall) {
      const clonedReq = req.clone();
      const peekBody = await clonedReq.json();
      const allowedServiceRoleActions = ['save-itinerary', 'sync-itinerary-tables', 'repair-trip-costs'];
      if (allowedServiceRoleActions.includes(peekBody.action) && peekBody.userId) {
        authResult = { userId: peekBody.userId };
        console.log(`[itinerary-ops] Service-role bypass for ${peekBody.action}, userId: ${authResult.userId}`);
      } else if (allowedServiceRoleActions.includes(peekBody.action) && !peekBody.userId) {
        console.error(`[itinerary-ops] Service-role call missing userId for action: ${peekBody.action}`);
        return new Response(
          JSON.stringify({ error: "Service-role call missing userId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        console.error(`[itinerary-ops] Service-role call for non-whitelisted action: ${peekBody.action}`);
        return new Response(
          JSON.stringify({ error: "Unauthorized action for service role" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    } else {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } },
      });
      authResult = await validateAuth(req, authClient);
      if (!authResult) {
        return new Response(
          JSON.stringify({ error: "Unauthorized. Please sign in." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[itinerary-ops] Action: ${action} user: ${authResult.userId}`);

    const rateCheck = await checkRateLimit(supabase, authResult.userId, action);
    if (!rateCheck.allowed) {
      console.log(`[itinerary-ops] Rate limit exceeded for ${authResult.userId} on ${action}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": "0" } },
      );
    }

    const actCtx: ActionContext = { supabase, userId: authResult.userId, params };

    if (action === 'get-trip') return handleGetTrip(actCtx);
    if (action === 'save-itinerary') return handleSaveItinerary(actCtx);
    if (action === 'get-itinerary') return handleGetItinerary(actCtx);
    if (action === 'toggle-activity-lock') return handleToggleActivityLock(actCtx);
    if (action === 'sync-itinerary-tables') return handleSyncItineraryTables(actCtx);
    if (action === 'repair-trip-costs') return handleRepairTripCosts(actCtx);

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[itinerary-ops] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Itinerary operation failed", code: "OPS_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
