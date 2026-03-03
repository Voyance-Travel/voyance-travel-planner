// SYNC CHECK: Run 'npx ts-node scripts/check-edge-constants.ts' after any
// pricing or cost constant change. See src/config/pricing.ts for source of truth.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-ENTITLEMENTS] ${step}${detailsStr}`);
};

// ============================================================
// CREDIT_COSTS — Mirror of src/config/pricing.ts CREDIT_COSTS
// ============================================================
// WARNING: These values MUST match src/config/pricing.ts exactly.
// When updating pricing.ts, update this block AND the
// TIER_CAPS block below at the same time.
// Last synced: 2026-02-14
// ============================================================
const CREDIT_COSTS = {
  unlock_day: 60,            // src/config/pricing.ts:13
  smart_finish: 50,          // src/config/pricing.ts:14
  swap_activity: 5,          // src/config/pricing.ts:16
  regenerate_day: 10,        // src/config/pricing.ts:15
  ai_message: 5,             // src/config/pricing.ts:18
  restaurant_rec: 5,         // src/config/pricing.ts:17
  hotel_search: 40,          // src/config/pricing.ts:10
  hotel_optimization: 100,   // src/config/pricing.ts:19
  transport_mode_change: 5,  // src/config/pricing.ts:22
  mystery_getaway: 15,       // src/config/pricing.ts:20
  mystery_logistics: 5,      // src/config/pricing.ts:21
  base_rate_per_day: 60,     // src/lib/tripCostCalculator.ts:BASE_RATE_PER_DAY
  group_small: 150,          // src/config/pricing.ts:GROUP_UNLOCK_CREDITS.small
  group_medium: 300,         // src/config/pricing.ts:GROUP_UNLOCK_CREDITS.medium
  group_large: 500,          // src/config/pricing.ts:GROUP_UNLOCK_CREDITS.large
};

// ============================================================
// TIER_CAPS — Mirror of src/config/pricing.ts TIER_FREE_CAPS
// ============================================================
// Must match src/config/pricing.ts TIER_FREE_CAPS exactly.
// Last synced: 2026-02-14
// ============================================================
const TIER_CAPS: Record<string, { swaps: number; regenerates: number; ai_messages: number; restaurant_recs: number }> = {
  free:       { swaps: 3,  regenerates: 1, ai_messages: 5,  restaurant_recs: 1 },
  flex:       { swaps: 3,  regenerates: 1, ai_messages: 5,  restaurant_recs: 1 },
  voyager:    { swaps: 6,  regenerates: 2, ai_messages: 10, restaurant_recs: 2 },
  explorer:   { swaps: 9,  regenerates: 3, ai_messages: 15, restaurant_recs: 3 },
  adventurer: { swaps: 15, regenerates: 5, ai_messages: 25, restaurant_recs: 5 },
};

// Trip length scaling for Free/Flex only
const FLEX_CAPS_BY_DAYS: Record<number, { swaps: number; regenerates: number; ai_messages: number; restaurant_recs: number }> = {
  2:  { swaps: 3,  regenerates: 1, ai_messages: 5,  restaurant_recs: 1 },
  4:  { swaps: 5,  regenerates: 2, ai_messages: 10, restaurant_recs: 2 },
  6:  { swaps: 7,  regenerates: 3, ai_messages: 15, restaurant_recs: 3 },
  8:  { swaps: 10, regenerates: 4, ai_messages: 20, restaurant_recs: 4 },
};

function getScaledCaps(unlockedDays: number) {
  if (unlockedDays >= 7) return FLEX_CAPS_BY_DAYS[8];
  if (unlockedDays >= 5) return FLEX_CAPS_BY_DAYS[6];
  if (unlockedDays >= 3) return FLEX_CAPS_BY_DAYS[4];
  return FLEX_CAPS_BY_DAYS[2];
}

// Stripe price ID to plan mapping (legacy subscription support)
const PRICE_TO_PLAN: Record<string, { plan: string; type: 'subscription' | 'payment' }> = {
  'price_1SrKz2FYxIg9jcJUVbrbOfFl': { plan: 'monthly', type: 'subscription' },
  'price_1SrKz4FYxIg9jcJU8kMbZDSk': { plan: 'yearly', type: 'subscription' },
  'price_1RpYVWFYxIg9jcJU4t3JVCy0': { plan: 'monthly', type: 'subscription' },
  'price_1RpYWpFYxIg9jcJUPrSLmFsu': { plan: 'yearly', type: 'subscription' },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) {
      logStep("Auth error", { message: userError.message });
      return new Response(JSON.stringify({ error: "Session expired or invalid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }
    const user = userData.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401,
      });
    }
    logStep("User authenticated", { userId: user.id });

    // ── Parse optional tripId from body ──
    let tripId: string | null = null;
    try {
      const body = await req.json();
      tripId = body?.tripId || null;
    } catch {
      // No body or not JSON — that's fine
    }

    // ── Stripe subscription check (legacy) ──
    let activePlan = 'free';
    let subscriptionEnd: string | null = null;
    let subscriptionPriceId: string | null = null;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      if (customers.data.length > 0) {
        const customerId = customers.data[0].id;
        const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: "active", limit: 1 });
        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0];
          subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
          subscriptionPriceId = sub.items.data[0].price.id;
          if (subscriptionPriceId) {
            const planInfo = PRICE_TO_PLAN[subscriptionPriceId];
            if (planInfo) activePlan = planInfo.plan;
          }
        }
      }
    }

    // ── Credit balance (from credit_purchases, FIFO source of truth) ──
    const now = new Date().toISOString();
    const { data: creditRows } = await supabaseAdmin
      .from('credit_purchases')
      .select('remaining, expires_at, credit_type')
      .eq('user_id', user.id)
      .gt('remaining', 0);

    let purchasedCredits = 0;
    let freeCredits = 0;
    for (const row of creditRows || []) {
      if (row.expires_at && new Date(row.expires_at) < new Date()) continue;
      if (['free_monthly', 'signup_bonus', 'referral_bonus'].includes(row.credit_type)) {
        freeCredits += row.remaining;
      } else {
        purchasedCredits += row.remaining;
      }
    }
    const totalCredits = purchasedCredits + freeCredits;

    // ── User tier ──
    const { data: tierData } = await supabaseAdmin
      .from('user_tiers')
      .select('tier')
      .eq('user_id', user.id)
      .maybeSingle();
    const tier = tierData?.tier || 'free';
    const isClubMember = ['voyager', 'explorer', 'adventurer'].includes(tier);

    // ── Access gates ──
    // 1. Has completed purchase (any non-free credit purchase)
    const { data: purchaseCheck } = await supabaseAdmin
      .from('credit_purchases')
      .select('id')
      .eq('user_id', user.id)
      .not('credit_type', 'in', '("free_monthly","signup_bonus","referral_bonus")')
      .limit(1);
    const hasCompletedPurchase = (purchaseCheck?.length || 0) > 0;

    // 2. Is first trip — use the `first_trip_used` flag on profiles.
    // This flag is only set to true after a generation completes successfully,
    // so crashed trips don't consume the first-trip benefit.
    const { data: profileData } = await supabaseAdmin
      .from('profiles')
      .select('first_trip_used')
      .eq('id', user.id)
      .maybeSingle();
    const isFirstTrip = profileData?.first_trip_used === false;

    // 3. Smart Finish + trip usage (if tripId provided)
    let tripHasSmartFinish = false;
    let unlockedDays = 0;
    let tripUsage = { swaps: 0, regenerates: 0, ai_messages: 0, restaurant_recs: 0 };

    if (tripId) {
      const { data: tripData } = await supabaseAdmin
        .from('trips')
        .select('smart_finish_purchased, unlocked_day_count')
        .eq('id', tripId)
        .maybeSingle();

      tripHasSmartFinish = tripData?.smart_finish_purchased || false;
      unlockedDays = tripData?.unlocked_day_count || 0;

      // Get trip action usage
      const { data: usageData } = await supabaseAdmin
        .from('trip_action_usage')
        .select('action_type, usage_count')
        .eq('trip_id', tripId)
        .eq('user_id', user.id);

      if (usageData) {
        for (const row of usageData) {
          if (row.action_type === 'swap_activity') tripUsage.swaps = row.usage_count;
          if (row.action_type === 'regenerate_day') tripUsage.regenerates = row.usage_count;
          if (row.action_type === 'ai_message') tripUsage.ai_messages = row.usage_count;
          if (row.action_type === 'restaurant_rec') tripUsage.restaurant_recs = row.usage_count;
        }
      }
    }

    // ── Compute free caps based on tier + trip length ──
    let freeCaps = TIER_CAPS[tier] || TIER_CAPS.free;
    if (!isClubMember && tripId && unlockedDays > 0) {
      freeCaps = getScaledCaps(unlockedDays);
    }

    const remainingFreeActions = {
      swaps: Math.max(0, freeCaps.swaps - tripUsage.swaps),
      regenerates: Math.max(0, freeCaps.regenerates - tripUsage.regenerates),
      ai_messages: Math.max(0, freeCaps.ai_messages - tripUsage.ai_messages),
      restaurant_recs: Math.max(0, freeCaps.restaurant_recs - tripUsage.restaurant_recs),
    };

    // ── Feature flags ──
    // GUARD: hasPaidAccess is PER-TRIP only.
    // tripHasSmartFinish = user bought Smart Finish for THIS trip.
    // unlockedDays > 0 = user unlocked days on THIS trip.
    // NEVER include hasCompletedPurchase here — that is account-wide, not trip-scoped.
    // See: src/lib/voyanceFlowController.ts → hasPaidAccessForTrip()
    const hasPaidAccess = tripHasSmartFinish || unlockedDays > 0;

    // ── Legacy usage/limits ──
    const { data: usage } = await supabaseAdmin
      .from('user_usage')
      .select('metric_key, count, period')
      .eq('user_id', user.id)
      .eq('period', 'lifetime');

    const usageMap: Record<string, number> = {};
    for (const u of usage || []) {
      usageMap[u.metric_key] = u.count;
    }

    const { count: draftTripsCount } = await supabaseAdmin
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'draft');

    const { data: tripPurchases } = await supabaseAdmin
      .from('trip_purchases')
      .select('trip_id')
      .eq('user_id', user.id)
      .eq('purchase_type', 'trip_pass');

    const unlockedTrips = (tripPurchases || []).map(p => p.trip_id);

    logStep("Resolved entitlements", { tier, totalCredits, hasCompletedPurchase, isFirstTrip, tripHasSmartFinish });

    const response = {
      user_id: user.id,
      plan: activePlan,
      is_subscribed: activePlan !== 'free',
      subscription_end: subscriptionEnd,
      subscription_price_id: subscriptionPriceId,

      // Tier
      tier,

      // Credits
      credits_balance: totalCredits,
      credits_purchased: purchasedCredits,
      credits_free: freeCredits,

      // Access gates
      has_completed_purchase: hasCompletedPurchase,
      is_first_trip: isFirstTrip,
      trip_has_smart_finish: tripHasSmartFinish,

      // Feature flags (computed from gates)
      unlocked_day_count: unlockedDays,
      can_view_photos: hasPaidAccess || isFirstTrip,
      can_view_addresses: hasPaidAccess || isFirstTrip,
      can_view_booking_links: hasPaidAccess || isFirstTrip,
      can_view_tips: hasPaidAccess || isFirstTrip,
      can_view_reviews: hasPaidAccess || isFirstTrip,
      can_export_pdf: hasPaidAccess, // Never free on first trip

      // Credit-gated actions
      can_build_itinerary: activePlan !== 'free' || totalCredits >= CREDIT_COSTS.base_rate_per_day,
      can_unlock_day: totalCredits >= CREDIT_COSTS.unlock_day,
      can_smart_finish: totalCredits >= CREDIT_COSTS.smart_finish,
      can_search_hotels: totalCredits >= CREDIT_COSTS.hotel_search,
      can_swap_activity: true,
      can_regenerate_day: true,
      can_send_message: true,
      can_get_restaurant_rec: true,
      can_optimize_routes: unlockedDays >= 1 || isFirstTrip || hasPaidAccess,

      // Free caps
      free_caps: freeCaps,
      trip_usage: tripUsage,
      remaining_free_actions: remainingFreeActions,

      // Legacy
      usage: usageMap,
      draft_trips_count: draftTripsCount || 0,
      unlocked_trips: unlockedTrips,

      // Costs (frontend should use these instead of hardcoding)
      costs: CREDIT_COSTS,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ success: false, error: "Failed to retrieve entitlements", code: "ENTITLEMENTS_ERROR" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500,
    });
  }
});
