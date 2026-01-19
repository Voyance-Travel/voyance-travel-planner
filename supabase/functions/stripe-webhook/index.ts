import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const log = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  // Stripe webhooks send POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    log("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the raw body for signature verification
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      log("Signature verification failed", err);
      return new Response(`Webhook signature verification failed`, { status: 400 });
    }

    log("Event type", { type: event.type, id: event.id });

    // Create admin Supabase client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        log("Checkout completed", { sessionId: session.id, metadata: session.metadata });

        const metadata = session.metadata || {};

        // ========================================
        // Credit Top-up Fulfillment
        // ========================================
        if (metadata.type === "credit_topup") {
          const userId = metadata.user_id;
          const amountCents = parseInt(metadata.amount_cents || "0", 10);

          if (!userId || amountCents <= 0) {
            log("Invalid credit topup metadata", metadata);
            break;
          }

          log("Fulfilling credit topup", { userId, amountCents });

          // Upsert user credits (add to existing balance)
          const { data: existingCredits } = await supabaseAdmin
            .from("user_credits")
            .select("balance_cents")
            .eq("user_id", userId)
            .single();

          const currentBalance = existingCredits?.balance_cents || 0;
          const newBalance = currentBalance + amountCents;

          const { error: upsertError } = await supabaseAdmin
            .from("user_credits")
            .upsert({
              user_id: userId,
              balance_cents: newBalance,
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

          if (upsertError) {
            log("Error upserting credits", upsertError);
            throw upsertError;
          }

          // Record transaction for audit trail
          const { error: txError } = await supabaseAdmin
            .from("credit_transactions")
            .insert({
              user_id: userId,
              type: "topup",
              amount_cents: amountCents,
              metadata: {
                stripe_session_id: session.id,
                payment_intent: session.payment_intent,
              },
            });

          if (txError) {
            log("Error recording transaction", txError);
          }

          log("Credit topup fulfilled", { userId, newBalance });
        }

        // ========================================
        // Trip Pass Fulfillment
        // ========================================
        if (metadata.type === "trip_pass") {
          const userId = metadata.user_id;
          const tripId = metadata.trip_id;

          if (!userId || !tripId) {
            log("Invalid trip pass metadata", metadata);
            break;
          }

          log("Fulfilling trip pass", { userId, tripId });

          // Insert trip purchase record
          const { error: purchaseError } = await supabaseAdmin
            .from("trip_purchases")
            .upsert({
              user_id: userId,
              trip_id: tripId,
              purchase_type: "trip_pass",
              features_unlocked: {
                unlimited_rebuilds: true,
                unlimited_day_builds: true,
                route_optimization: true,
                weather_tracker: true,
                group_budgeting: true,
                co_edit: true,
              },
              stripe_session_id: session.id,
              created_at: new Date().toISOString(),
            }, { onConflict: "user_id,trip_id" });

          if (purchaseError) {
            log("Error recording trip pass", purchaseError);
            throw purchaseError;
          }

          log("Trip pass fulfilled", { userId, tripId });
        }

        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        log("Subscription event", { 
          subscriptionId: subscription.id, 
          status: subscription.status,
          customerId: subscription.customer 
        });
        // Subscription status is checked via get-entitlements, no DB updates needed
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        log("Subscription canceled", { subscriptionId: subscription.id });
        // Entitlements will automatically downgrade when get-entitlements is called
        break;
      }

      default:
        log("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ error: message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
