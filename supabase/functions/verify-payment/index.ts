import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: any) => {
  console.log(`[VERIFY-PAYMENT] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log("Function started");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("User not authenticated");
    log("User authenticated", { userId: user.id });

    const { sessionId, tripId, itemId } = await req.json();

    if (!sessionId && !tripId) {
      throw new Error("Either sessionId or tripId is required");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // If sessionId provided, verify that specific session
    if (sessionId) {
      log("Verifying session", { sessionId });

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      log("Session status", { status: session.payment_status, paymentIntent: session.payment_intent });

      if (session.payment_status === 'paid') {
        // Update payment record to paid
        const { error: updateError } = await serviceSupabase
          .from("trip_payments")
          .update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_checkout_session_id', sessionId);

        if (updateError) {
          log("Error updating payment", updateError);
        } else {
          log("Payment marked as paid");
        }

        return new Response(
          JSON.stringify({ success: true, status: 'paid', session }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, status: session.payment_status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If tripId provided, get all payments for the trip
    log("Fetching payments for trip", { tripId });

    const { data: payments, error: paymentsError } = await serviceSupabase
      .from("trip_payments")
      .select("*")
      .eq("trip_id", tripId)
      .eq("user_id", user.id);

    if (paymentsError) {
      throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
    }

    // Calculate totals
    const totalPaid = payments
      ?.filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount_cents * (p.quantity || 1)), 0) || 0;

    const totalPending = payments
      ?.filter(p => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + (p.amount_cents * (p.quantity || 1)), 0) || 0;

    log("Payment totals", { totalPaid, totalPending, count: payments?.length });

    return new Response(
      JSON.stringify({
        success: true,
        payments: payments || [],
        totals: {
          paid: totalPaid,
          pending: totalPending,
          total: totalPaid + totalPending,
        },
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
