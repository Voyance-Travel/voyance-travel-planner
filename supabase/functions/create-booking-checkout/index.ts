import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-BOOKING-CHECKOUT] ${step}${detailsStr}`);
};

// Single Trip Unlock price
const SINGLE_TRIP_PRICE_ID = 'price_1RpYXMFYxIg9jcJUxDiyEFp5'; // $29.99 one-time

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { tripId, flightTotal, hotelTotal, activitiesTotal } = await req.json();
    logStep("Request body", { tripId, flightTotal, hotelTotal, activitiesTotal });

    if (!tripId) throw new Error("tripId is required");

    // Authenticate user using getUser for proper JWT validation
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      logStep("Missing or invalid authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized: No valid authorization header" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData?.user) {
      logStep("JWT validation failed", { error: userError?.message });
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid session. Please sign in again." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const user = userData.user;
    const userId = user.id;
    const userEmail = user.email;
    logStep("User authenticated", { userId, email: userEmail });

    // Use service role client for database operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get trip details using service client
    const { data: trip, error: tripError } = await serviceClient
      .from('trips')
      .select('*')
      .eq('id', tripId)
      .eq('user_id', userId)
      .single();

    if (tripError || !trip) {
      throw new Error("Trip not found or access denied");
    }
    logStep("Trip found", { destination: trip.destination });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://voyance-travel-planner.lovable.app";

    // Calculate totals
    const flightCents = Math.round((flightTotal || 0) * 100);
    const hotelCents = Math.round((hotelTotal || 0) * 100);
    const activitiesCents = Math.round((activitiesTotal || 0) * 100);
    
    // Line items for checkout
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    // Trip service fee (always required)
    lineItems.push({
      price: SINGLE_TRIP_PRICE_ID,
      quantity: 1,
    });

    // Add booking totals as line items if present
    if (flightCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Flight Booking',
            description: `Flights for trip to ${trip.destination}`,
          },
          unit_amount: flightCents,
        },
        quantity: 1,
      });
    }

    if (hotelCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Hotel Booking',
            description: `Accommodation in ${trip.destination}`,
          },
          unit_amount: hotelCents,
        },
        quantity: 1,
      });
    }

    if (activitiesCents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Activities & Experiences',
            description: `Curated activities for your trip`,
          },
          unit_amount: activitiesCents,
        },
        quantity: 1,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/trips/${tripId}/confirmation?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/planner/booking?tripId=${tripId}&canceled=true`,
      metadata: {
        user_id: userId,
        trip_id: tripId,
        trip_destination: trip.destination,
      },
    });

    logStep("Checkout session created", { sessionId: session.id });

    // Update trip status to pending payment
    await serviceClient
      .from('trips')
      .update({ 
        status: 'planning',
        metadata: {
          ...(trip.metadata as object || {}),
          checkout_session_id: session.id,
          payment_status: 'pending',
        },
      })
      .eq('id', tripId);

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
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
