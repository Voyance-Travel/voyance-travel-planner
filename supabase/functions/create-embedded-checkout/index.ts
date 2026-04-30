import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { corsResponse, errorResponse } from "../_shared/edge-response.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-EMBEDDED-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    logStep("Function started");

    const { 
      priceId, 
      mode = "subscription", 
      returnPath = "/profile",
      // Credit purchase fields
      productId,
      credits,
      // Group unlock fields
      tripId: groupTripId,
      groupTier,
      // Group-pool credit destination (new): credits buy into a trip's group pool
      destination,
      // Legacy day purchase fields (deprecated)
      days,
      packageTier,
    } = await req.json();
    logStep("Request body parsed", { priceId, mode, returnPath, credits, days, packageTier, groupTripId, groupTier, destination });

    // Validate required inputs
    if (!priceId || typeof priceId !== 'string' || priceId.length > 200) {
      return errorResponse("priceId is required", "INVALID_INPUT");
    }
    if (mode && !['subscription', 'payment'].includes(mode)) {
      return errorResponse("Invalid mode", "INVALID_INPUT");
    }
    if (credits !== undefined && (typeof credits !== 'number' || credits < 0 || credits > 100000)) {
      return errorResponse("Invalid credits value", "INVALID_INPUT");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return errorResponse("No authorization header provided", "UNAUTHORIZED", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) {
      return errorResponse("Invalid or expired token", "UNAUTHORIZED", 401);
    }

    const userId = userData.user.id;
    const email = userData.user.email;
    if (!email) {
      return errorResponse("User email not available", "MISSING_EMAIL");
    }

    logStep("User authenticated", { userId, email });

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const rawOrigin = req.headers.get("origin");
    const origin = (rawOrigin && rawOrigin.startsWith("http"))
      ? rawOrigin
      : "https://travelwithvoyance.com";

    // Build metadata based on purchase type
    const sessionMetadata: Record<string, string> = {
      user_id: userId,
    };

    // Group-pool credit purchase (new): credits land in the trip's shared pool, not personal balance
    if (destination === "group_pool" && groupTripId && credits && Number(credits) > 0) {
      // OWNERSHIP CHECK: only the trip owner can route credits into the pool
      const { data: tripRow, error: tripErr } = await supabaseClient
        .from('trips')
        .select('user_id')
        .eq('id', groupTripId)
        .maybeSingle();
      if (tripErr || !tripRow) {
        return errorResponse("Trip not found", "TRIP_NOT_FOUND", 404);
      }
      if (tripRow.user_id !== userId) {
        return errorResponse("Only the trip owner can fund the group pool", "FORBIDDEN", 403);
      }
      sessionMetadata.type = "group_pool_credit_purchase";
      sessionMetadata.trip_id = groupTripId;
      sessionMetadata.credits = String(credits);
      sessionMetadata.price_id = priceId;
      if (productId) sessionMetadata.product_id = productId;
    }
    // Group unlock metadata
    else if (groupTripId && groupTier) {
      sessionMetadata.type = "group_unlock";
      sessionMetadata.trip_id = groupTripId;
      sessionMetadata.group_tier = groupTier;
      if (productId) sessionMetadata.product_id = productId;
    }
    // Credit purchase metadata
    else if (credits && Number(credits) > 0) {
      sessionMetadata.type = "credit_purchase";
      sessionMetadata.credits = String(credits);
      sessionMetadata.price_id = priceId;
      if (productId) sessionMetadata.product_id = productId;
    }
    // Legacy day purchase metadata
    else if (days && Number(days) > 0) {
      sessionMetadata.type = "day_purchase";
      sessionMetadata.days = String(days);
      sessionMetadata.price_id = priceId;
      if (productId) sessionMetadata.product_id = productId;
      if (packageTier) sessionMetadata.package_tier = packageTier;
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: mode as "subscription" | "payment",
      ui_mode: "embedded",
      return_url: `${origin}${returnPath}?session_id={CHECKOUT_SESSION_ID}&payment=success`,
      metadata: sessionMetadata,
    });

    logStep("Embedded checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ 
      clientSecret: session.client_secret,
      sessionId: session.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return errorResponse("Checkout session creation failed", "CHECKOUT_ERROR", 500);
  }
});
