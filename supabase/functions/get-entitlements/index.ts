import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GET-ENTITLEMENTS] ${step}${detailsStr}`);
};

// Stripe price ID to plan ID mapping
const PRICE_TO_PLAN: Record<string, string> = {
  'price_1RpYVWFYxIg9jcJU4t3JVCy0': 'paid',
  'price_1RpYWpFYxIg9jcJUPrSLmFsu': 'addon_voyagermaps',
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // 1. Check Stripe subscription status
    let activePlans: string[] = ['free']; // Default to free
    let subscriptionEnd: string | null = null;

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (stripeKey) {
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      
      if (customers.data.length > 0) {
        const customerId = customers.data[0].id;
        const subscriptions = await stripe.subscriptions.list({
          customer: customerId,
          status: "active",
          limit: 10,
        });

        if (subscriptions.data.length > 0) {
          activePlans = ['free']; // Start fresh, keep free as base
          
          for (const sub of subscriptions.data) {
            subscriptionEnd = new Date(sub.current_period_end * 1000).toISOString();
            
            for (const item of sub.items.data) {
              const planId = PRICE_TO_PLAN[item.price.id];
              if (planId && !activePlans.includes(planId)) {
                activePlans.push(planId);
              }
            }
          }
          logStep("Active plans from Stripe", { activePlans });
        }
      }
    }

    // 2. Get plan entitlements from database
    const { data: entitlements, error: entError } = await supabaseClient
      .from('plan_entitlements')
      .select('flag_id, enabled, value_number, value_json, plan_id')
      .in('plan_id', activePlans);

    if (entError) {
      logStep("Error fetching entitlements", { error: entError.message });
      throw new Error("Failed to fetch entitlements");
    }

    // 3. Get user overrides
    const { data: overrides } = await supabaseClient
      .from('user_entitlement_overrides')
      .select('flag_id, enabled, value_number, value_json, expires_at')
      .eq('user_id', user.id);

    // 4. Get current month usage
    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
    const { data: usage } = await supabaseClient
      .from('user_usage')
      .select('metric_key, count')
      .eq('user_id', user.id)
      .eq('period', currentPeriod);

    // 5. Resolve entitlements (higher plan values override lower)
    const resolvedEntitlements: Record<string, { enabled: boolean; limit?: number; used?: number }> = {};
    const planPriority = ['free', 'paid', 'addon_voyagermaps'];

    // Sort entitlements by plan priority
    const sortedEntitlements = (entitlements || []).sort((a, b) => {
      return planPriority.indexOf(a.plan_id) - planPriority.indexOf(b.plan_id);
    });

    for (const ent of sortedEntitlements) {
      const current = resolvedEntitlements[ent.flag_id];
      
      // Higher priority plan overrides
      if (!current || ent.enabled || ent.value_number !== null) {
        resolvedEntitlements[ent.flag_id] = {
          enabled: ent.enabled,
          limit: ent.value_number ?? undefined,
        };
      }
    }

    // Apply user overrides (highest priority)
    for (const override of overrides || []) {
      // Check if override has expired
      if (override.expires_at && new Date(override.expires_at) < new Date()) {
        continue;
      }
      
      resolvedEntitlements[override.flag_id] = {
        enabled: override.enabled,
        limit: override.value_number ?? undefined,
      };
    }

    // Add usage data
    for (const u of usage || []) {
      if (resolvedEntitlements[u.metric_key]) {
        resolvedEntitlements[u.metric_key].used = u.count;
      }
    }

    logStep("Resolved entitlements", { count: Object.keys(resolvedEntitlements).length });

    // 6. Build response
    const response = {
      user_id: user.id,
      plans: activePlans,
      is_paid: activePlans.includes('paid'),
      has_addon: activePlans.includes('addon_voyagermaps'),
      subscription_end: subscriptionEnd,
      entitlements: resolvedEntitlements,
      usage: (usage || []).reduce((acc, u) => {
        acc[u.metric_key] = u.count;
        return acc;
      }, {} as Record<string, number>),
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
