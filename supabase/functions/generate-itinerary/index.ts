// deploy-marker: pr29-pr32 (bundles #24 DNA fix, #25 share-RPC, #29 Stripe credit security, #32 guide-gen charge) — forces Lovable bundler to redeploy edge functions
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

// =============================================================================
// EXTRACTED ACTION HANDLERS
// =============================================================================
import { handleGetTrip } from './action-get-trip.ts';
import { handleSaveItinerary } from './action-save-itinerary.ts';
import { handleGetItinerary } from './action-get-itinerary.ts';
import { handleToggleActivityLock } from './action-toggle-lock.ts';
import { handleSyncItineraryTables } from './action-sync-tables.ts';
import { handleRepairTripCosts } from './action-repair-costs.ts';
import { handleGenerateTrip } from './action-generate-trip.ts';
import { handleGenerateTripDay } from './action-generate-trip-day.ts';
import { handleGenerateTripDayV2, shouldUseV2Chain } from './v2/generate-trip-day-v2.ts';
import { handleGenerateDay } from './action-generate-day.ts';
import { handleGenerateFull } from './action-generate-full.ts';
import { corsHeaders, type ActionContext } from './action-types.ts';

// =============================================================================
// RATE LIMITING - Database-backed (survives cold starts)
// =============================================================================
import { checkDbRateLimit, type RateLimitRule } from "../_shared/db-rate-limiter.ts";

const RATE_LIMIT_RULES: Record<string, RateLimitRule> = {
  'generate-full': { maxRequests: 3, windowMs: 300000 },
  'generate-day': { maxRequests: 20, windowMs: 60000 },
  default: { maxRequests: 20, windowMs: 60000 },
};

async function checkRateLimit(
  supabaseAdmin: any,
  userId: string,
  action: string
): Promise<{ allowed: boolean; remaining: number }> {
  const rule = RATE_LIMIT_RULES[action] || RATE_LIMIT_RULES.default;
  const result = await checkDbRateLimit(
    supabaseAdmin,
    userId,
    `generate-itinerary:${action}`,
    rule,
    userId,
  );
  return { allowed: result.allowed, remaining: result.remaining };
}

// =============================================================================
// AUTHENTICATION HELPER
// =============================================================================
async function validateAuth(req: Request, supabase: any): Promise<{ userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    console.warn('[generate-itinerary] Missing or invalid Authorization header');
    return null;
  }
  
  const token = authHeader.replace('Bearer ', '');

  // Early token sanity check — reject obviously malformed tokens
  const tokenParts = token.split('.');
  if (tokenParts.length !== 3 || tokenParts.some((p: string) => p.length === 0)) {
    console.warn('[generate-itinerary] Malformed JWT — invalid segment count:', tokenParts.length);
    return null;
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.warn('[generate-itinerary] Auth getUser failed:', error?.message);
      return null;
    }
    return { userId: data.user.id };
  } catch (err) {
    console.error('[generate-itinerary] Auth exception:', err);
    return null;
  }
}

// =============================================================================
// MAIN HANDLER
// =============================================================================

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");

    if (!OPENROUTER_API_KEY) {
      console.error("OPENROUTER_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Service-role auth bypass for server-to-server self-chaining ──
    // We accept either an exact match of the current SERVICE_ROLE_KEY env var
    // OR a JWT whose `role` claim is `service_role` (handles signing-key rotation
    // where the deployed key string and the runtime env var briefly diverge).
    const bearerToken = req.headers.get('Authorization')?.replace('Bearer ', '') || '';

    function decodeJwtRole(token: string): string | null {
      try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = JSON.parse(
          atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
        );
        return typeof payload?.role === 'string' ? payload.role : null;
      } catch {
        return null;
      }
    }

    const isServiceRoleCall =
      !!bearerToken &&
      (bearerToken === supabaseKey || decodeJwtRole(bearerToken) === 'service_role');

    let authResult: { userId: string } | null = null;

    if (isServiceRoleCall) {
      const clonedReq = req.clone();
      const peekBody = await clonedReq.json();

      const allowedServiceRoleActions = ['generate-trip', 'generate-trip-day', 'generate-day', 'regenerate-day', 'save-itinerary'];
      if (allowedServiceRoleActions.includes(peekBody.action) && peekBody.userId) {
        authResult = { userId: peekBody.userId };
        console.log(`[generate-itinerary] Service-role bypass for ${peekBody.action}, userId: ${authResult.userId}`);
      } else if (allowedServiceRoleActions.includes(peekBody.action) && !peekBody.userId) {
        // Self-chain payloads should always include userId; log and reject so we
        // notice rather than silently downgrading to unauthenticated.
        console.error(`[generate-itinerary] Service-role call missing userId for action: ${peekBody.action}`);
        return new Response(
          JSON.stringify({ error: "Service-role call missing userId" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.error(`[generate-itinerary] Service-role call for non-whitelisted action: ${peekBody.action}`);
        return new Response(
          JSON.stringify({ error: "Unauthorized action for service role" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
      });

      authResult = await validateAuth(req, authClient);
      if (!authResult) {
        console.error("[generate-itinerary] Unauthorized request");
        return new Response(
          JSON.stringify({ error: "Unauthorized. Please sign in to generate itineraries." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    console.log(`[generate-itinerary] Authenticated user: ${authResult.userId}`);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[generate-itinerary] Action: ${action}`);

    // ====================================================================
    // PROOF-OF-CHARGE GATE — blocks $$$ abuse via direct edge calls
    // Service-role self-chain bypasses (originating call already cleared gate).
    // See .lovable/plan.md (proof-of-charge gate).
    // ====================================================================
    const PAID_GENERATION_ACTIONS = ['generate-trip', 'generate-full', 'generate-day', 'regenerate-day'];
    if (!isServiceRoleCall && PAID_GENERATION_ACTIONS.includes(action)) {
      const tripId = (params as any)?.tripId;
      if (!tripId) {
        console.warn(`[generate-itinerary] Paid action ${action} missing tripId — rejecting`);
        return new Response(
          JSON.stringify({ success: false, error: 'tripId required for generation actions', code: 'MISSING_TRIP_ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map edge action → spend-credits action label(s) (proof of charge)
      // NOTE: regenerate_trip authorizes the per-day loop fired by EditorialItinerary's
      // full-trip Regenerate (one umbrella charge → many generate-day calls). Without it
      // every day call returns GENERATION_NOT_AUTHORIZED and silently burns the charge.
      // trip_generation similarly authorizes day-chain calls during primary generation.
      const SPEND_ACTIONS_BY_EDGE: Record<string, string[]> = {
        'generate-trip':  ['trip_generation', 'regenerate_trip'],
        'generate-full':  ['trip_generation', 'regenerate_trip'],
        'regenerate-day': ['regenerate_day', 'unlock_day', 'regenerate_trip', 'trip_generation'],
        'generate-day':   ['regenerate_day', 'unlock_day', 'regenerate_trip', 'trip_generation'],
      };
      const allowedSpendActions = SPEND_ACTIONS_BY_EDGE[action] || [];

      const tenMinAgo = new Date(Date.now() - 10 * 60_000).toISOString();

      const [balanceRes, tierRes, chargeRes] = await Promise.all([
        supabase
          .from('credit_balances')
          .select('purchased_credits, free_credits')
          .eq('user_id', authResult.userId)
          .maybeSingle(),
        supabase
          .from('user_tiers')
          .select('tier')
          .eq('user_id', authResult.userId)
          .maybeSingle(),
        supabase
          .from('pending_credit_charges')
          .select('id, status, action, created_at')
          .eq('user_id', authResult.userId)
          .eq('trip_id', tripId)
          .in('action', allowedSpendActions)
          .in('status', ['pending', 'completed'])
          .gte('created_at', tenMinAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      let charge = chargeRes.data;
      const totalCredits =
        (balanceRes.data?.purchased_credits ?? 0) + (balanceRes.data?.free_credits ?? 0);
      const tier = tierRes.data?.tier ?? 'free';

      // Durable retry proof: a trip-generation charge can outlive the short
      // pending-charge window when the launcher is killed before Day 1. For
      // unfinished trips only, accept the committed ledger row as proof so a
      // retry/resume does not require a second charge.
      if (!charge && action === 'generate-trip') {
        const { data: tripProofState } = await supabase
          .from('trips')
          .select('itinerary_status, itinerary_data, metadata')
          .eq('id', tripId)
          .maybeSingle();
        const tripMeta = (tripProofState?.metadata as Record<string, unknown>) || {};
        const days = ((tripProofState?.itinerary_data as any)?.days || []) as unknown[];
        const isUnfinishedTrip =
          !['ready', 'generated'].includes(String(tripProofState?.itinerary_status || '')) &&
          days.length === 0 &&
          tripMeta.fully_persisted !== true;

        if (isUnfinishedTrip) {
          const { data: ledgerProof } = await supabase
            .from('credit_ledger')
            .select('id, action_type, created_at, metadata')
            .eq('user_id', authResult.userId)
            .eq('trip_id', tripId)
            .in('action_type', allowedSpendActions)
            .eq('transaction_type', 'spend')
            .lt('credits_delta', 0)
            .filter('metadata->>status', 'eq', 'committed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (ledgerProof) {
            charge = {
              id: ledgerProof.id,
              status: 'ledger_committed',
              action: ledgerProof.action_type,
              created_at: ledgerProof.created_at,
            } as any;
            console.log(
              `[generate-itinerary] Durable proof-of-charge OK via committed ledger=${ledgerProof.id} action=${ledgerProof.action_type}`
            );
          }
        }
      }

      // Durable ledger proof for per-day regen paths (generate-day, regenerate-day).
      // spend-credits does NOT write a pending_credit_charges row for low-value
      // actions like regenerate_day (only HIGH_VALUE_ACTIONS get one), so the
      // pending-charge query above always misses for these. Accept any committed
      // ledger spend in the last 10 minutes that matches allowedSpendActions.
      // Mirrors the pattern already shipped for generate-trip retry/resume.
      if (!charge && (action === 'generate-day' || action === 'regenerate-day')) {
        const { data: ledgerProof } = await supabase
          .from('credit_ledger')
          .select('id, action_type, created_at, metadata')
          .eq('user_id', authResult.userId)
          .eq('trip_id', tripId)
          .in('action_type', allowedSpendActions)
          .eq('transaction_type', 'spend')
          .lt('credits_delta', 0)
          .filter('metadata->>status', 'eq', 'committed')
          .gte('created_at', tenMinAgo)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (ledgerProof) {
          charge = {
            id: ledgerProof.id,
            status: 'ledger_committed',
            action: ledgerProof.action_type,
            created_at: ledgerProof.created_at,
          } as any;
          console.log(
            `[generate-itinerary] Durable proof-of-charge OK via committed ledger=${ledgerProof.id} action=${ledgerProof.action_type}`
          );
        }
      }

      // ── Free-first-trip authorization (post-migration drift fix) ──────────
      // The client (useGenerationGate / get-entitlements) makes a user's FIRST
      // trip free based on profiles.first_trip_used === false, and intentionally
      // does NOT spend credits for it — so no proof-of-charge row exists. The
      // server gate below ignored that and 403'd, so every fresh account's first
      // generation failed. Honor the SAME canonical flag here. The flag is
      // consumed (set true) by an existing trigger only AFTER a generation
      // completes, so a blocked/crashed trip can't abuse this; paid (2nd+) trips
      // still require a real proof-of-charge.
      if (!charge && action === 'generate-trip') {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('first_trip_used')
          .eq('id', authResult.userId)
          .maybeSingle();
        if (profileRow?.first_trip_used === false) {
          charge = {
            id: 'free_first_trip',
            status: 'free_first_trip',
            action: 'trip_generation',
            created_at: new Date().toISOString(),
          } as any;
          console.log(
            `[generate-itinerary] Free-first-trip authorization for user=${authResult.userId} (profiles.first_trip_used=false)`
          );
        }
      }

      if (!charge) {
        console.warn(
          `[generate-itinerary] No proof-of-charge for user=${authResult.userId} trip=${tripId} action=${action} ` +
          `tier=${tier} balance=${totalCredits} — blocking`
        );
        if (totalCredits <= 0 && tier === 'free') {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Free tier credits exhausted. Upgrade to continue generating trips.',
              code: 'TIER_LIMIT_EXCEEDED',
            }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Generation must be initiated through the app (no charge record found).',
            code: 'GENERATION_NOT_AUTHORIZED',
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(
        `[generate-itinerary] Proof-of-charge OK: charge=${charge.id} action=${charge.action} status=${charge.status}`
      );
    }

    // Rate limit check
    const rateCheck = await checkRateLimit(supabase, authResult.userId, action);
    if (!rateCheck.allowed) {
      console.log(`[generate-itinerary] Rate limit exceeded for ${authResult.userId} on ${action}`);
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a few minutes before trying again." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": "0" } }
      );
    }

    // ====================================================================
    // ACTION DISPATCH
    // ====================================================================
    if (action === 'generate-full') {
      return handleGenerateFull(supabase, authResult.userId, params);
    }

    if (action === 'generate-day' || action === 'regenerate-day') {
      return handleGenerateDay(supabase, authResult.userId, { ...params, action });
    }

    if (action === 'generate-trip') {
      return handleGenerateTrip(supabase, authResult.userId, params);
    }

    if (action === 'generate-trip-day') {
      // Phase D (cutover): v2 chain is the DEFAULT.
      // Kill-switch: `trips.metadata.useV1Chain === true` forces legacy v1
      // handler for emergency rollback during the 1-week soak.
      // Scheduled for deletion in Phase E.
      if (await shouldUseV2Chain(supabase, (params as any)?.tripId)) {
        console.log(`[generate-itinerary] Routing to v2 chain for trip=${(params as any)?.tripId}`);
        return handleGenerateTripDayV2(supabase, authResult.userId, params);
      }
      console.log(`[generate-itinerary] Kill-switch active — routing to v1 for trip=${(params as any)?.tripId}`);
      // Soak-telemetry stamp: mark this trip as having been served by the
      // legacy v1 chain so the 7-day soak query can prove which trips never
      // crossed the v2 boundary. Mirrors the v2 stamp in
      // v2/generate-trip-day-v2.ts. Read-modify-write JSON merge; failures
      // are swallowed (telemetry never blocks generation).
      try {
        const tid = (params as any)?.tripId;
        if (tid) {
          const { data: row } = await supabase
            .from('trips')
            .select('metadata')
            .eq('id', tid)
            .maybeSingle();
          const priorMeta = (row?.metadata as any) || {};
          const priorQuality = priorMeta.quality || {};
          if (priorQuality.v1_chain_used !== true) {
            await supabase
              .from('trips')
              .update({
                metadata: { ...priorMeta, quality: { ...priorQuality, v1_chain_used: true } },
              })
              .eq('id', tid);
            console.log(`[generate-itinerary] stamped metadata.quality.v1_chain_used=true tripId=${tid}`);
          }
        }
      } catch (e) {
        console.warn(`[generate-itinerary] v1_chain_used stamp failed (non-fatal):`, (e as Error)?.message);
      }
      return handleGenerateTripDay(supabase, authResult.userId, params);
    }


    // Simple CRUD actions — use ActionContext interface
    const actCtx: ActionContext = { supabase, userId: authResult.userId, params };

    if (action === 'get-trip') return handleGetTrip(actCtx);
    if (action === 'save-itinerary') return handleSaveItinerary(actCtx);
    if (action === 'get-itinerary') return handleGetItinerary(actCtx);
    if (action === 'toggle-activity-lock') return handleToggleActivityLock(actCtx);
    if (action === 'sync-itinerary-tables') return handleSyncItineraryTables(actCtx);
    if (action === 'repair-trip-costs') return handleRepairTripCosts(actCtx);

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-itinerary] Error:", error);

    return new Response(
      JSON.stringify({ success: false, error: "Itinerary generation failed", code: "GENERATE_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
