import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-BOOKING-CHECKOUT] ${step}${detailsStr}`);
};

// =============================================================================
// RATE LIMITING - Database-backed (survives cold starts)
// =============================================================================
import { checkDbRateLimit } from "../_shared/db-rate-limiter.ts";

const RATE_LIMIT = { maxRequests: 5, windowMs: 60000 }; // 5 requests per minute per user

async function checkRateLimit(supabaseAdmin: any, userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const result = await checkDbRateLimit(
    supabaseAdmin,
    userId,
    'create-booking-checkout',
    RATE_LIMIT,
    userId,
  );
  return { allowed: result.allowed, remaining: result.remaining };
}

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

    // Rate limit check
    // Rate limit check — needs service client, create it early
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const rateCheck = await checkRateLimit(serviceClient, userId);
    if (!rateCheck.allowed) {
      logStep("Rate limit exceeded", { userId });
      return new Response(JSON.stringify({ error: "Too many requests. Please wait a minute and try again." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "X-RateLimit-Remaining": "0" },
        status: 429,
      });
    }

    // serviceClient already created above for rate limiting

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

    // =========================================================================
    // SERVER-SIDE PRICE VALIDATION — prevent client-side price manipulation
    // =========================================================================
    const PRICE_TOLERANCE_CENTS = 100; // $1 rounding tolerance

    // Derive flight price from stored selection
    let serverFlightTotal = 0;
    if (trip.flight_selection) {
      const fs = trip.flight_selection as any;
      // Support multiple price shapes stored by Amadeus integration
      serverFlightTotal = Number(fs.totalPrice ?? fs.total_price ?? fs.price ?? fs.grandTotal ?? fs.grand_total ?? 0);
    }

    // Derive hotel price from stored selection
    let serverHotelTotal = 0;
    if (trip.hotel_selection) {
      const hs = trip.hotel_selection as any;
      serverHotelTotal = Number(hs.totalPrice ?? hs.total_price ?? hs.price ?? hs.total ?? 0);
    }

    // Validate client-sent values against server-derived values
    const clientFlightCents = Math.round((flightTotal || 0) * 100);
    const clientHotelCents = Math.round((hotelTotal || 0) * 100);
    const serverFlightCents = Math.round(serverFlightTotal * 100);
    const serverHotelCents = Math.round(serverHotelTotal * 100);

    if (serverFlightCents > 0 && Math.abs(clientFlightCents - serverFlightCents) > PRICE_TOLERANCE_CENTS) {
      logStep("SECURITY: Flight price mismatch", { client: clientFlightCents, server: serverFlightCents });
      return new Response(JSON.stringify({ error: "Flight price has changed. Please refresh and try again.", code: "PRICE_MISMATCH" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    if (serverHotelCents > 0 && Math.abs(clientHotelCents - serverHotelCents) > PRICE_TOLERANCE_CENTS) {
      logStep("SECURITY: Hotel price mismatch", { client: clientHotelCents, server: serverHotelCents });
      return new Response(JSON.stringify({ error: "Hotel price has changed. Please refresh and try again.", code: "PRICE_MISMATCH" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400,
      });
    }

    // Use server-derived prices when available, fall back to client values only when no selection exists
    const flightCents = serverFlightCents > 0 ? serverFlightCents : clientFlightCents;
    const hotelCents = serverHotelCents > 0 ? serverHotelCents : clientHotelCents;
    const activitiesCents = Math.round((activitiesTotal || 0) * 100);

    // Initialize Stripe
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

    // Generate booking reference (VOY-XXXXXXXX format)
    const bookingReference = `VOY-${tripId.slice(0, 8).toUpperCase()}`;

    // Update trip status to pending payment with booking reference
    await serviceClient
      .from('trips')
      .update({ 
        status: 'planning',
        metadata: {
          ...(trip.metadata as object || {}),
          checkout_session_id: session.id,
          payment_status: 'pending',
          booking_reference: bookingReference,
        },
      })
      .eq('id', tripId);

    // Create pending payment records in trip_payments for each item
    const paymentRecords = [];
    
    // Flight payment record
    if (flightCents > 0 && trip.flight_selection) {
      const flightData = trip.flight_selection as any;
      paymentRecords.push({
        trip_id: tripId,
        user_id: userId,
        item_type: 'flight',
        item_id: flightData?.id || `flight-${tripId.slice(0, 8)}`,
        item_name: `Flights to ${trip.destination}`,
        amount_cents: flightCents,
        currency: 'USD',
        quantity: 1,
        status: 'pending',
        stripe_checkout_session_id: session.id,
        external_provider: 'amadeus',
      });
    }

    // Hotel payment record
    if (hotelCents > 0 && trip.hotel_selection) {
      const hotelData = trip.hotel_selection as any;
      paymentRecords.push({
        trip_id: tripId,
        user_id: userId,
        item_type: 'hotel',
        item_id: hotelData?.hotelId || hotelData?.id || `hotel-${tripId.slice(0, 8)}`,
        item_name: hotelData?.name || `Hotel in ${trip.destination}`,
        amount_cents: hotelCents,
        currency: 'USD',
        quantity: 1,
        status: 'pending',
        stripe_checkout_session_id: session.id,
        external_provider: 'amadeus',
      });
    }

    // Activities payment record (aggregated)
    if (activitiesCents > 0) {
      paymentRecords.push({
        trip_id: tripId,
        user_id: userId,
        item_type: 'activity',
        item_id: `activities-${tripId.slice(0, 8)}`,
        item_name: `Activities & Experiences`,
        amount_cents: activitiesCents,
        currency: 'USD',
        quantity: 1,
        status: 'pending',
        stripe_checkout_session_id: session.id,
      });
    }

    // Insert payment records (upsert to handle retries)
    if (paymentRecords.length > 0) {
      const { error: paymentError } = await serviceClient
        .from('trip_payments')
        .upsert(paymentRecords, { 
          onConflict: 'trip_id,item_type,item_id',
          ignoreDuplicates: false 
        });
      
      if (paymentError) {
        logStep("Warning: Failed to create payment records", { error: paymentError.message });
      } else {
        logStep("Payment records created", { count: paymentRecords.length });
      }
    }

    return new Response(JSON.stringify({ 
      url: session.url, 
      sessionId: session.id,
      bookingReference,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ success: false, error: "Booking checkout failed", code: "BOOKING_CHECKOUT_ERROR" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
