import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-ENTITLEMENTS] ${step}${detailsStr}`);
};

// Stripe price ID to plan mapping
const PRICE_TO_PLAN: Record<string, { plan: string; type: 'subscription' | 'payment' }> = {
  // Subscriptions
  'price_1SrKz2FYxIg9jcJUVbrbOfFl': { plan: 'monthly', type: 'subscription' },
  'price_1SrKz4FYxIg9jcJU8kMbZDSk': { plan: 'yearly', type: 'subscription' },
  // Legacy prices (keep for existing customers)
  'price_1RpYVWFYxIg9jcJU4t3JVCy0': { plan: 'monthly', type: 'subscription' },
  'price_1RpYWpFYxIg9jcJUPrSLmFsu': { plan: 'yearly', type: 'subscription' },
};

// Credit costs in cents - must match src/config/pricing.ts
const CREDIT_COSTS: Record<string, number> = {
  build_day: 399,          // $3.99
  build_full_trip: 999,    // $9.99
  route_optimize: 199,     // $1.99
  group_budget_setup: 299, // $2.99
};

// Plan features configuration
const PLAN_LIMITS = {
  free: {
    fullBuilds: 1,
    draftTrips: 1,
    dayRebuilds: 0,
    tripVersions: 1,
    flightHotelOptimization: false,
    groupBudgeting: false,
    coEditCollaboration: false,
    routeOptimization: false,
    weatherTracker: true, // Free users can see weather
  },
  monthly: {
    fullBuilds: -1, // Unlimited
    draftTrips: 5,
    dayRebuilds: -1,
    tripVersions: 4,
    flightHotelOptimization: true,
    groupBudgeting: true,
    coEditCollaboration: true,
    routeOptimization: true,
    weatherTracker: true,
  },
  yearly: {
    fullBuilds: -1,
    draftTrips: -1, // Unlimited
    dayRebuilds: -1,
    tripVersions: -1,
    flightHotelOptimization: true,
    groupBudgeting: true,
    coEditCollaboration: true,
    routeOptimization: true,
    weatherTracker: true,
    preferenceLearning: true,
  },
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

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError) {
      logStep("Auth error", { message: userError.message });
      return new Response(JSON.stringify({ error: "Session expired or invalid" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    
    const user = userData.user;
    if (!user?.email) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Default to free plan
    let activePlan = 'free';
    let subscriptionEnd: string | null = null;
    let subscriptionPriceId: string | null = null;

    // Check Stripe subscription status
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      
      if (customers.data.length > 0) {
        const customerId = customers.data[0].id;
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
          limit: 1,
        });

        if (subscriptions.data.length > 0) {
          const sub = subscriptions.data[0];
          subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
          subscriptionPriceId = sub.items.data[0].price.id;
          
          if (subscriptionPriceId) {
            const planInfo = PRICE_TO_PLAN[subscriptionPriceId];
            if (planInfo) {
              activePlan = planInfo.plan;
            }
          }
          logStep("Active subscription found", { plan: activePlan, priceId: subscriptionPriceId });
        }
      }
    }

    // Get user credits
    const { data: credits } = await supabaseAdmin
      .from('user_credits')
      .select('balance_cents')
      .eq('user_id', user.id)
      .single();

    const creditBalance = credits?.balance_cents || 0;

    // Get user usage for free tier tracking
    const { data: usage } = await supabaseAdmin
      .from('user_usage')
      .select('metric_key, count, period')
      .eq('user_id', user.id)
      .eq('period', 'lifetime');

    // Get trip purchases (Trip Passes)
    const { data: tripPurchases } = await supabaseAdmin
      .from('trip_purchases')
      .select('trip_id, purchase_type, features_unlocked')
      .eq('user_id', user.id)
      .eq('purchase_type', 'trip_pass');

    // Get draft trips count
    const { count: draftTripsCount } = await supabaseAdmin
      .from('trips')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'draft');

    // Build usage map
    const usageMap: Record<string, number> = {};
    for (const u of usage || []) {
      usageMap[u.metric_key] = u.count;
    }

    // Get plan limits
    const limits = PLAN_LIMITS[activePlan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.free;

    // Build unlocked trips map (trips with Trip Pass)
    const unlockedTrips = (tripPurchases || []).map(p => p.trip_id);

    // Calculate remaining free builds
    const freeBuildsUsed = usageMap['full_builds'] || 0;
    const freeBuildsRemaining = activePlan === 'free' 
      ? Math.max(0, limits.fullBuilds - freeBuildsUsed)
      : -1; // Unlimited for paid

    // Build credit-based feature availability
    const creditFeatures: Record<string, { cost: number; can_afford: boolean }> = {};
    for (const [key, cost] of Object.entries(CREDIT_COSTS)) {
      creditFeatures[key] = {
        cost,
        can_afford: creditBalance >= cost,
      };
    }

    logStep("Resolved entitlements", { 
      plan: activePlan, 
      credits: creditBalance,
      draftTrips: draftTripsCount,
      unlockedTrips: unlockedTrips.length,
    });

    // Build response
    const response = {
      user_id: user.id,
      plan: activePlan,
      is_subscribed: activePlan !== 'free',
      subscription_end: subscriptionEnd,
      subscription_price_id: subscriptionPriceId,
      
      // Credits/wallet
      credits_balance_cents: creditBalance,
      
      // Credit-based feature availability (for pay-per-use)
      credit_features: creditFeatures,
      
      // Usage
      usage: usageMap,
      draft_trips_count: draftTripsCount || 0,
      
      // Limits
      limits: {
        ...limits,
        freeBuildsRemaining,
        draftTripsRemaining: limits.draftTrips === -1 
          ? -1 
          : Math.max(0, limits.draftTrips - (draftTripsCount || 0)),
      },
      
      // Trip Passes
      unlocked_trips: unlockedTrips,
      
      // Feature flags (quick boolean checks)
      // Paid users always have access; free users can use credits for some features
      can_build_itinerary: activePlan !== 'free' || freeBuildsRemaining > 0 || creditBalance >= CREDIT_COSTS.build_full_trip,
      can_build_day: activePlan !== 'free' || creditBalance >= CREDIT_COSTS.build_day,
      can_use_flight_hotel_optimization: limits.flightHotelOptimization,
      can_use_group_budgeting: limits.groupBudgeting || creditBalance >= CREDIT_COSTS.group_budget_setup,
      can_co_edit: limits.coEditCollaboration,
      can_optimize_routes: limits.routeOptimization || creditBalance >= CREDIT_COSTS.route_optimize,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
