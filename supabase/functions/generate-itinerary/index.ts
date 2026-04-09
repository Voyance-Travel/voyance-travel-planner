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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
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
    const bearerToken = req.headers.get('Authorization')?.replace('Bearer ', '') || '';
    const isServiceRoleCall = bearerToken === supabaseKey;

    let authResult: { userId: string } | null = null;

    if (isServiceRoleCall) {
      const clonedReq = req.clone();
      const peekBody = await clonedReq.json();
      
      const allowedServiceRoleActions = ['generate-trip', 'generate-trip-day', 'generate-day', 'regenerate-day'];
      if (allowedServiceRoleActions.includes(peekBody.action) && peekBody.userId) {
        authResult = { userId: peekBody.userId };
        console.log(`[generate-itinerary] Service-role bypass for ${peekBody.action}, userId: ${authResult.userId}`);
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
