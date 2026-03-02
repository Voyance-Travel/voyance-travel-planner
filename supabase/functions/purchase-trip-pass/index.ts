import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { corsResponse, okResponse, errorResponse, unauthorizedResponse, exceptionResponse } from "../_shared/edge-response.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PURCHASE-TRIP-PASS] ${step}${detailsStr}`);
};

// Trip Pass price ID from Stripe
const TRIP_PASS_PRICE_ID = 'price_1SrKykFYxIg9jcJUblEmckuq';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    logStep("Function started");

    const { trip_id } = await req.json();
    
    if (!trip_id) {
      return errorResponse("trip_id is required", "MISSING_TRIP_ID");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return unauthorizedResponse();
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } }
    );

    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return unauthorizedResponse("Invalid token", "INVALID_TOKEN");
    }

    const userId = claimsData.claims.sub as string;
    let email = claimsData.claims.email as string | undefined;
    
    if (!email) {
      const { data: userData } = await supabaseClient.auth.getUser(token);
      email = userData.user?.email;
    }

    if (!email) return errorResponse("Could not get user email", "NO_EMAIL");
    logStep("User authenticated", { userId, email, tripId: trip_id });

    // Verify user owns this trip
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { data: trip, error: tripError } = await supabaseAdmin
      .from('trips')
      .select('id, user_id, destination')
      .eq('id', trip_id)
      .single();

    if (tripError || !trip) {
      return errorResponse("Trip not found", "TRIP_NOT_FOUND", 404);
    }

    if (trip.user_id !== userId) {
      return errorResponse("You don't own this trip", "NOT_TRIP_OWNER", 403);
    }

    // Check if already purchased
    const { data: existingPurchase } = await supabaseAdmin
      .from('trip_purchases')
      .select('id')
      .eq('user_id', userId)
      .eq('trip_id', trip_id)
      .eq('purchase_type', 'trip_pass')
      .single();

    if (existingPurchase) {
      return errorResponse("Trip Pass already purchased for this trip", "ALREADY_PURCHASED", 409);
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://voyance-travel-planner.lovable.app";

    // Create checkout session for Trip Pass
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price: TRIP_PASS_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/trip/${trip_id}?pass_purchased=true`,
      cancel_url: `${origin}/trip/${trip_id}?pass_canceled=true`,
      metadata: {
        user_id: userId,
        trip_id: trip_id,
        type: 'trip_pass',
        destination: trip.destination,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, tripId: trip_id });

    return okResponse({ url: session.url });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return exceptionResponse(error);
  }
});
