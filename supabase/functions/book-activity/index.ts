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
      throw new Error("Missing required fields: tripId, itemType, itemId, itemName, amountCents");
    }

    log("Booking request", body);

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

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
      // Include session_id placeholder so verify-payment can use it
      success_url: `${origin}/trip/${tripId}?payment=success&session_id={CHECKOUT_SESSION_ID}&item=${itemId}`,
      cancel_url: `${origin}/trip/${tripId}?payment=cancelled`,
      metadata: {
        tripId,
        itemType,
        itemId,
        userId: user.id,
        externalProvider: externalProvider || '',
      },
    });

    log("Created Stripe checkout session", { sessionId: session.id });

    // Create or update payment record
    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

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

    if (paymentError) {
      log("Error creating payment record", paymentError);
      // Don't fail - we still have the Stripe session
    } else {
      log("Payment record created", { paymentId: payment?.id });
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        checkoutUrl: session.url,
        sessionId: session.id,
        paymentId: payment?.id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
