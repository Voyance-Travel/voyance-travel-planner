import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) => {
  console.log(`[BOOK-ACTIVITY] ${step}`, details ? JSON.stringify(details) : '');
};

interface BookingRequest {
  tripId: string;
  itemType: 'flight' | 'hotel' | 'activity';
  itemId: string;
  itemName: string;
  amountCents: number;
  currency?: string;
  quantity?: number;
  externalProvider?: string;
  externalBookingUrl?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    
    // Create client WITH auth header for proper JWT validation on Lovable Cloud
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.email) throw new Error("User not authenticated");
    log("User authenticated", { userId: user.id, email: user.email });

    const body: BookingRequest = await req.json();
    const { tripId, itemType, itemId, itemName, amountCents, currency = 'USD', quantity = 1, externalProvider, externalBookingUrl } = body;

    if (!tripId || !itemType || !itemId || !itemName || !amountCents) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields", code: "INVALID_INPUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Input validation
    if (typeof tripId !== 'string' || tripId.length > 200) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid tripId", code: "INVALID_INPUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!['flight', 'hotel', 'activity'].includes(itemType)) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid itemType", code: "INVALID_INPUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof amountCents !== 'number' || !Number.isInteger(amountCents) || amountCents <= 0 || amountCents > 10000000) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid amountCents", code: "INVALID_INPUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof itemName !== 'string' || itemName.length > 500) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid itemName", code: "INVALID_INPUT" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    log("Booking request validated", { tripId, itemType, itemId });

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Track the payment row id so we can fail it if anything goes wrong after creation.
    let paymentId: string | null = null;
    let stripeSessionId: string | null = null;

    try {
      // Find or create Stripe customer
      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId: string;
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        log("Found existing Stripe customer", { customerId });
      } else {
        const customer = await stripe.customers.create({ email: user.email });
        customerId = customer.id;
        log("Created new Stripe customer", { customerId });
      }

      // Create Stripe Checkout session for this item
      const origin = req.headers.get("origin") || "https://voyance-travel-planner.lovable.app";

      // Deterministic idempotency key — collapses duplicate clicks for the same item+amount
      // within a 60-second window; later retries get a fresh key so users aren't locked out.
      const minuteBucket = Math.floor(Date.now() / 60000);
      const idempotencyKey = `book_activity:${user.id}:${tripId}:${itemId}:${amountCents}:${minuteBucket}`.slice(0, 255);

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: currency.toLowerCase(),
              product_data: {
                name: itemName,
                description: `${itemType.charAt(0).toUpperCase() + itemType.slice(1)} booking for your trip`,
              },
              unit_amount: amountCents,
            },
            quantity,
          },
        ],
        mode: "payment",
        success_url: `${origin}/trip/${tripId}?payment=success&session_id={CHECKOUT_SESSION_ID}&item=${itemId}`,
        cancel_url: `${origin}/trip/${tripId}?payment=cancelled`,
        metadata: {
          tripId,
          itemType,
          itemId,
          userId: user.id,
          externalProvider: externalProvider || '',
        },
      }, { idempotencyKey });
      stripeSessionId = session.id;
      log("Created Stripe checkout session", { sessionId: session.id });

      // Create or update payment record AFTER we have a session id so it's never
      // orphaned without a Stripe reference. If this write fails, expire the
      // Stripe session and surface a hard error rather than handing the user a
      // checkout URL that can never reconcile.
      const { data: payment, error: paymentError } = await serviceSupabase
        .from("trip_payments")
        .upsert({
          trip_id: tripId,
          user_id: user.id,
          item_type: itemType,
          item_id: itemId,
          item_name: itemName,
          amount_cents: amountCents,
          currency,
          quantity,
          status: 'processing',
          stripe_checkout_session_id: session.id,
          external_provider: externalProvider,
          external_booking_url: externalBookingUrl,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'trip_id,item_type,item_id',
        })
        .select()
        .single();

      if (paymentError || !payment) {
        log("Error creating payment record — expiring Stripe session", paymentError);
        try { await stripe.checkout.sessions.expire(session.id); } catch (_) {}
        return new Response(
          JSON.stringify({ success: false, error: "Could not record booking. Please try again.", code: "PAYMENT_RECORD_FAILED" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      paymentId = payment.id;
      log("Payment record created", { paymentId });

      return new Response(
        JSON.stringify({
          success: true,
          checkoutUrl: session.url,
          sessionId: session.id,
          paymentId,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (innerErr) {
      const innerMsg = innerErr instanceof Error ? innerErr.message : String(innerErr);
      log("Inner ERROR — finalizing failed payment", { message: innerMsg, paymentId, stripeSessionId });
      if (paymentId) {
        await serviceSupabase
          .from("trip_payments")
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', paymentId);
      } else if (stripeSessionId) {
        await serviceSupabase
          .from("trip_payments")
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('stripe_checkout_session_id', stripeSessionId);
      }
      throw innerErr;
    }

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(
      JSON.stringify({ success: false, error: "Booking failed. Please try again.", code: "BOOKING_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
