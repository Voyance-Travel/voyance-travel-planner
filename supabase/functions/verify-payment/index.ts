import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { corsResponse, okResponse, errorResponse, exceptionResponse } from "../_shared/edge-response.ts";

const log = (step: string, details?: any) => {
  console.log(`[VERIFY-PAYMENT] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return corsResponse();
  }

  try {
    log("Function started");

    const { sessionId, tripId, itemId } = await req.json();

    const serviceSupabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Try to authenticate user (optional for session verification)
    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (!authError && user) {
        userId = user.id;
        log("User authenticated", { userId });
      } else {
        log("User not authenticated, will verify by session ID only");
      }
    }

    if (!sessionId && !tripId) {
      return errorResponse("Either sessionId or tripId is required", "MISSING_INPUT");
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) return errorResponse("STRIPE_SECRET_KEY not configured", "CONFIG_ERROR", 500);

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // If sessionId provided, verify that specific session
    if (sessionId) {
      log("Verifying session", { sessionId });

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      log("Session status", { status: session.payment_status, paymentIntent: session.payment_intent });

      if (session.payment_status === 'paid') {
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

        return okResponse({ status: 'paid', session });
      }

      return okResponse({ status: session.payment_status });
    }

    // If tripId provided, get all payments for the trip
    if (!userId) {
      return errorResponse("Authentication required to fetch trip payments", "AUTH_REQUIRED", 401);
    }

    log("Fetching payments for trip", { tripId, userId });

    const { data: payments, error: paymentsError } = await serviceSupabase
      .from("trip_payments")
      .select("*")
      .eq("trip_id", tripId)
      .eq("user_id", userId);

    if (paymentsError) {
      return errorResponse(`Failed to fetch payments: ${paymentsError.message}`, "QUERY_FAILED", 500);
    }

    const totalPaid = payments
      ?.filter(p => p.status === 'paid')
      .reduce((sum, p) => sum + (p.amount_cents * (p.quantity || 1)), 0) || 0;

    const totalPending = payments
      ?.filter(p => p.status === 'pending' || p.status === 'processing')
      .reduce((sum, p) => sum + (p.amount_cents * (p.quantity || 1)), 0) || 0;

    log("Payment totals", { totalPaid, totalPending, count: payments?.length });

    return okResponse({
      payments: payments || [],
      totals: {
        paid: totalPaid,
        pending: totalPending,
        total: totalPaid + totalPending,
      },
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return exceptionResponse(error);
  }
});
