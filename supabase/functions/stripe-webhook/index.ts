/**
 * Stripe Webhook Handler - Enhanced with Finance Subledger Auto-Posting
 * 
 * Handles Stripe events and auto-posts to the finance ledger:
 * - payment_intent.succeeded → client_payment entry
 * - charge.refunded → client_refund entry
 * - charge.dispute.* → client_credit (dispute adjustment)
 * - transfer.created → agent_payout entry
 * - payout.paid → marks funds settled
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const log = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
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

    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      throw new Error("No Stripe signature found");
    }

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

    switch (event.type) {
      // ========================================
      // Payment Intent Succeeded - Create Payment Entry
      // ========================================
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        log("PaymentIntent succeeded", { 
          id: paymentIntent.id, 
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata 
        });

        const metadata = paymentIntent.metadata || {};
        
        // Check if this is an agency payment (has trip_id or invoice_id)
        if (metadata.trip_id || metadata.invoice_id || metadata.agent_id) {
          const agentId = metadata.agent_id;
          const tripId = metadata.trip_id;
          const invoiceId = metadata.invoice_id;
          
          if (agentId) {
            // IDEMPOTENCY CHECK: Skip if already processed
            const { data: existingPayment } = await supabaseAdmin
              .from("finance_ledger_entries")
              .select("id")
              .eq("stripe_payment_intent_id", paymentIntent.id)
              .eq("entry_type", "client_payment")
              .maybeSingle();

            if (existingPayment) {
              log("Duplicate payment event, skipping", { paymentIntentId: paymentIntent.id });
              break;
            }

            // Calculate Stripe fee (approximately 2.9% + $0.30)
            const stripeFee = Math.round(paymentIntent.amount * 0.029 + 30);

            // Create ledger entry for client payment
            const { error: paymentError } = await supabaseAdmin
              .from("finance_ledger_entries")
              .insert({
                agent_id: agentId,
                trip_id: tripId || null,
                invoice_id: invoiceId || null,
                entry_type: 'client_payment',
                entry_source: 'stripe_webhook',
                amount_cents: paymentIntent.amount,
                currency: paymentIntent.currency.toUpperCase(),
                description: `Payment received via Stripe`,
                stripe_payment_intent_id: paymentIntent.id,
                stripe_charge_id: typeof paymentIntent.latest_charge === 'string' 
                  ? paymentIntent.latest_charge 
                  : paymentIntent.latest_charge?.id,
                effective_date: new Date().toISOString().split('T')[0],
                metadata: {
                  customer_email: metadata.customer_email,
                  payment_method: paymentIntent.payment_method_types?.[0],
                  stripe_event_id: event.id,
                  activity_id: metadata.activity_id,
                },
              });

            if (paymentError) {
              log("Error creating payment ledger entry", paymentError);
            } else {
              log("Payment ledger entry created", { agentId, tripId, amount: paymentIntent.amount });
            }

            // Create ledger entry for Stripe fee
            const { error: feeError } = await supabaseAdmin
              .from("finance_ledger_entries")
              .insert({
                agent_id: agentId,
                trip_id: tripId || null,
                invoice_id: invoiceId || null,
                entry_type: 'stripe_fee',
                entry_source: 'stripe_webhook',
                amount_cents: -stripeFee, // Negative as it's an expense
                currency: paymentIntent.currency.toUpperCase(),
                description: `Stripe processing fee`,
                stripe_payment_intent_id: paymentIntent.id,
                effective_date: new Date().toISOString().split('T')[0],
                metadata: { stripe_event_id: event.id },
              });

            if (feeError) {
              log("Error creating fee ledger entry", feeError);
            }

            // Update invoice if linked
            if (invoiceId) {
              const { data: invoice } = await supabaseAdmin
                .from("agency_invoices")
                .select("amount_paid_cents, total_cents")
                .eq("id", invoiceId)
                .single();

              if (invoice) {
                const newPaid = (invoice.amount_paid_cents || 0) + paymentIntent.amount;
                const newBalance = (invoice.total_cents || 0) - newPaid;
                const newStatus = newBalance <= 0 ? 'paid' : 'partially_paid';

                await supabaseAdmin
                  .from("agency_invoices")
                  .update({
                    amount_paid_cents: newPaid,
                    balance_due_cents: Math.max(0, newBalance),
                    status: newStatus,
                    paid_date: newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null,
                  })
                  .eq("id", invoiceId);
              }
            }

            // Update trip totals if linked
            if (tripId) {
              const { data: trip } = await supabaseAdmin
                .from("agency_trips")
                .select("total_paid_cents")
                .eq("id", tripId)
                .single();

              if (trip) {
                await supabaseAdmin
                  .from("agency_trips")
                  .update({
                    total_paid_cents: (trip.total_paid_cents || 0) + paymentIntent.amount,
                  })
                  .eq("id", tripId);
              }
            }
          }
        }

        // Handle credit top-up (existing logic)
        if (metadata.type === "credit_topup") {
          const userId = metadata.user_id;
          const amountCents = parseInt(metadata.amount_cents || "0", 10);

          if (userId && amountCents > 0) {
            const { data: existingCredits } = await supabaseAdmin
              .from("user_credits")
              .select("balance_cents")
              .eq("user_id", userId)
              .single();

            const currentBalance = existingCredits?.balance_cents || 0;
            const newBalance = currentBalance + amountCents;

            await supabaseAdmin
              .from("user_credits")
              .upsert({
                user_id: userId,
                balance_cents: newBalance,
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id" });

            await supabaseAdmin
              .from("credit_transactions")
              .insert({
                user_id: userId,
                type: "topup",
                amount_cents: amountCents,
                metadata: {
                  stripe_session_id: metadata.checkout_session_id,
                  payment_intent: paymentIntent.id,
                },
              });

            log("Credit topup fulfilled", { userId, newBalance });
          }
        }

        break;
      }

      // ========================================
      // Checkout Session Completed
      // ========================================
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        log("Checkout completed", { sessionId: session.id, metadata: session.metadata });

        const metadata = session.metadata || {};

        // Trip Pass Fulfillment
        if (metadata.type === "trip_pass") {
          const userId = metadata.user_id;
          const tripId = metadata.trip_id;

          if (userId && tripId) {
            await supabaseAdmin
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

            log("Trip pass fulfilled", { userId, tripId });
          }
        }

        // Activity/Flight/Hotel Payment Fulfillment
        if (metadata.tripId && metadata.itemId && metadata.itemType) {
          log("Activity payment checkout completed", { 
            tripId: metadata.tripId, 
            itemId: metadata.itemId, 
            itemType: metadata.itemType 
          });

          // Update trip_payments to 'paid' status
          const { data: payment, error: updateError } = await supabaseAdmin
            .from("trip_payments")
            .update({
              status: 'paid',
              paid_at: new Date().toISOString(),
              stripe_payment_intent_id: typeof session.payment_intent === 'string' 
                ? session.payment_intent 
                : (session.payment_intent as any)?.id,
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_checkout_session_id', session.id)
            .select()
            .single();

          if (updateError) {
            log("Error updating trip_payment to paid", updateError);
          } else {
            log("Trip payment marked as paid", { paymentId: payment?.id });

            // If this is a Viator activity, update booking state to awaiting_booking
            // The actual Viator API call happens when user provides traveler info
            if (payment?.external_provider === 'viator' && metadata.itemType === 'activity') {
              log("Viator activity payment confirmed, ready for booking", { 
                paymentId: payment.id,
                itemId: metadata.itemId 
              });

              // Update the trip_activities booking state to indicate payment received
              const { error: activityError } = await supabaseAdmin.rpc('transition_booking_state', {
                p_activity_id: metadata.itemId,
                p_new_state: 'payment_confirmed',
                p_trigger_source: 'stripe_webhook',
                p_trigger_reference: session.id,
                p_metadata: { 
                  payment_id: payment.id,
                  stripe_session_id: session.id,
                },
              });

              if (activityError) {
                log("Error transitioning booking state", activityError);
              } else {
                log("Booking state transitioned to payment_confirmed");
              }
            }
          }
        }

        // ========================================
        // Day Purchase Fulfillment
        // ========================================
        if (metadata.type === "day_purchase") {
          const userId = metadata.user_id;
          const priceId = metadata.price_id;
          const productId = metadata.product_id;
          const daysToAdd = parseInt(metadata.days || "0", 10);
          const packageTier = metadata.package_tier as 'essential' | 'complete' | null;
          const amountCents = session.amount_total || 0;

          if (userId && daysToAdd > 0) {
            log("Processing day purchase", { userId, daysToAdd, packageTier, priceId });

            // IDEMPOTENCY CHECK: Skip if this session already processed
            const { data: existingLedger } = await supabaseAdmin
              .from("day_ledger")
              .select("id")
              .eq("stripe_session_id", session.id)
              .eq("transaction_type", "purchase")
              .maybeSingle();

            if (existingLedger) {
              log("Duplicate day purchase event, skipping", { sessionId: session.id });
              break;
            }

            // Get or create day balance record
            const { data: existingBalance } = await supabaseAdmin
              .from("day_balances")
              .select("*")
              .eq("user_id", userId)
              .maybeSingle();

            // Calculate new values
            const currentPurchasedDays = existingBalance?.purchased_days || 0;
            const newPurchasedDays = currentPurchasedDays + daysToAdd;

            // Determine tier and package limits
            let swapsRemaining = existingBalance?.swaps_remaining;
            let regeneratesRemaining = existingBalance?.regenerates_remaining;
            let activeTier = existingBalance?.active_tier;

            // If buying a package, set tier and limits
            if (packageTier) {
              activeTier = packageTier;
              if (packageTier === 'essential') {
                // Essential: 5 swaps, 2 regenerates per package
                swapsRemaining = (swapsRemaining || 0) + 5;
                regeneratesRemaining = (regeneratesRemaining || 0) + 2;
              } else if (packageTier === 'complete') {
                // Complete: unlimited (-1)
                swapsRemaining = -1;
                regeneratesRemaining = -1;
              }
            }

            // Upsert day balance
            const { error: balanceError } = await supabaseAdmin
              .from("day_balances")
              .upsert({
                user_id: userId,
                purchased_days: newPurchasedDays,
                free_days: existingBalance?.free_days || 0,
                free_days_expires_at: existingBalance?.free_days_expires_at || null,
                active_tier: activeTier,
                swaps_remaining: swapsRemaining,
                regenerates_remaining: regeneratesRemaining,
                monthly_swaps_used: existingBalance?.monthly_swaps_used || 0,
                monthly_regenerates_used: existingBalance?.monthly_regenerates_used || 0,
                monthly_reset_at: existingBalance?.monthly_reset_at || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
                updated_at: new Date().toISOString(),
              }, { onConflict: "user_id" });

            if (balanceError) {
              log("Error upserting day balance", balanceError);
            } else {
              log("Day balance updated", { userId, newPurchasedDays, activeTier });
            }

            // Create ledger entry
            const { error: ledgerError } = await supabaseAdmin
              .from("day_ledger")
              .insert({
                user_id: userId,
                transaction_type: 'purchase',
                days_delta: daysToAdd,
                is_free_day: false,
                stripe_session_id: session.id,
                stripe_product_id: productId,
                price_id: priceId,
                amount_cents: amountCents,
                package_tier: packageTier,
                package_days: daysToAdd,
                notes: packageTier 
                  ? `${packageTier.charAt(0).toUpperCase() + packageTier.slice(1)} package - ${daysToAdd} days`
                  : `${daysToAdd} day${daysToAdd > 1 ? 's' : ''} à la carte`,
              });

            if (ledgerError) {
              log("Error creating day ledger entry", ledgerError);
            } else {
              log("Day ledger entry created", { userId, daysToAdd, packageTier });
            }
          }
        }

        break;
      }

      // ========================================
      // Charge Refunded - Create Refund Entry
      // ========================================
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        log("Charge refunded", { chargeId: charge.id, amountRefunded: charge.amount_refunded });

        // Get refund details
        const refunds = charge.refunds?.data || [];
        const latestRefund = refunds[0];

        // IDEMPOTENCY CHECK: Skip if this specific refund already processed
        if (latestRefund?.id) {
          const { data: existingRefund } = await supabaseAdmin
            .from("finance_ledger_entries")
            .select("id")
            .eq("stripe_refund_id", latestRefund.id)
            .eq("entry_type", "client_refund")
            .maybeSingle();

          if (existingRefund) {
            log("Duplicate refund event, skipping", { refundId: latestRefund.id });
            break;
          }
        }

        // Find the original payment entry
        const { data: originalEntry } = await supabaseAdmin
          .from("finance_ledger_entries")
          .select("*")
          .eq("stripe_charge_id", charge.id)
          .eq("entry_type", "client_payment")
          .single();

        if (originalEntry) {
          const { error: refundError } = await supabaseAdmin
            .from("finance_ledger_entries")
            .insert({
              agent_id: originalEntry.agent_id,
              trip_id: originalEntry.trip_id,
              invoice_id: originalEntry.invoice_id,
              entry_type: 'client_refund',
              entry_source: 'stripe_webhook',
              amount_cents: -charge.amount_refunded, // Negative as money flows out
              currency: charge.currency.toUpperCase(),
              description: `Refund processed`,
              stripe_charge_id: charge.id,
              stripe_refund_id: latestRefund?.id,
              effective_date: new Date().toISOString().split('T')[0],
              metadata: {
                refund_reason: latestRefund?.reason,
                stripe_event_id: event.id,
                activity_id: originalEntry.metadata?.activity_id,
              },
            });

          if (refundError) {
            log("Error creating refund ledger entry", refundError);
          } else {
            log("Refund ledger entry created", { 
              agentId: originalEntry.agent_id, 
              amount: charge.amount_refunded 
            });

            // P0 FIX: Sync booking state to 'refunded' if activity linked
            const activityId = originalEntry.metadata?.activity_id;
            if (activityId) {
              const { data: stateResult, error: stateError } = await supabaseAdmin
                .rpc('transition_booking_state', {
                  p_activity_id: activityId,
                  p_new_state: 'refunded',
                  p_trigger_source: 'stripe_webhook',
                  p_trigger_reference: latestRefund?.id,
                  p_metadata: { refund_amount: charge.amount_refunded },
                });

              if (stateError) {
                log("Error transitioning booking state to refunded", stateError);
              } else {
                log("Booking state transitioned to refunded", { activityId, result: stateResult });
              }
            }
          }
        }

        break;
      }

      // ========================================
      // Dispute Created/Updated - Create Credit Entry
      // ========================================
      case "charge.dispute.created":
      case "charge.dispute.updated": {
        const dispute = event.data.object as Stripe.Dispute;
        log("Dispute event", { disputeId: dispute.id, status: dispute.status, amount: dispute.amount });

        // Find the original payment
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
        
        const { data: originalEntry } = await supabaseAdmin
          .from("finance_ledger_entries")
          .select("*")
          .eq("stripe_charge_id", chargeId)
          .eq("entry_type", "client_payment")
          .single();

        if (originalEntry) {
          // Check if we already have a dispute entry
          const { data: existingDispute } = await supabaseAdmin
            .from("finance_ledger_entries")
            .select("id")
            .eq("stripe_dispute_id", dispute.id)
            .single();

          if (!existingDispute) {
            // Only create new entry if dispute is lost (funds withdrawn)
            if (dispute.status === 'lost' || dispute.status === 'warning_needs_response') {
              const { error: disputeError } = await supabaseAdmin
                .from("finance_ledger_entries")
                .insert({
                  agent_id: originalEntry.agent_id,
                  trip_id: originalEntry.trip_id,
                  invoice_id: originalEntry.invoice_id,
                  entry_type: 'client_credit',
                  entry_source: 'stripe_webhook',
                  amount_cents: -dispute.amount, // Negative as money flows out
                  currency: dispute.currency.toUpperCase(),
                  description: `Dispute ${dispute.status === 'lost' ? 'lost' : 'pending'}: ${dispute.reason}`,
                  stripe_charge_id: chargeId,
                  stripe_dispute_id: dispute.id,
                  effective_date: new Date().toISOString().split('T')[0],
                  metadata: {
                    dispute_reason: dispute.reason,
                    dispute_status: dispute.status,
                    stripe_event_id: event.id,
                  },
                });

              if (disputeError) {
                log("Error creating dispute ledger entry", disputeError);
              } else {
                log("Dispute ledger entry created", { disputeId: dispute.id });
              }
            }
          }
        }

        break;
      }

      // ========================================
      // Transfer Created - Agent Payout Entry
      // ========================================
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        log("Transfer created", { transferId: transfer.id, amount: transfer.amount });

        const metadata = transfer.metadata || {};
        const agentId = metadata.agent_id;
        const tripId = metadata.trip_id;

        if (agentId) {
          // Record the transfer as an agent payout
          const { error: transferError } = await supabaseAdmin
            .from("finance_ledger_entries")
            .insert({
              agent_id: agentId,
              trip_id: tripId || null,
              entry_type: 'agent_payout',
              entry_source: 'stripe_webhook',
              amount_cents: -transfer.amount, // Negative as money flows out of platform
              currency: transfer.currency.toUpperCase(),
              description: `Payout to agent (Stripe Connect)`,
              stripe_transfer_id: transfer.id,
              effective_date: new Date().toISOString().split('T')[0],
              metadata: {
                destination_account: transfer.destination,
                stripe_event_id: event.id,
              },
            });

          if (transferError) {
            log("Error creating transfer ledger entry", transferError);
          } else {
            log("Transfer ledger entry created", { agentId, amount: transfer.amount });
          }

          // Update payout run if linked
          if (metadata.payout_run_id) {
            await supabaseAdmin
              .from("finance_payout_runs")
              .update({
                stripe_transfer_id: transfer.id,
                status: 'processing',
                initiated_at: new Date().toISOString(),
              })
              .eq("id", metadata.payout_run_id);
          }
        }

        break;
      }

      // ========================================
      // Payout Paid - Mark Funds Settled
      // ========================================
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        log("Payout paid", { payoutId: payout.id, amount: payout.amount });

        // Find related payout runs by looking at transfers
        const { data: relatedEntries } = await supabaseAdmin
          .from("finance_ledger_entries")
          .select("id, metadata")
          .eq("entry_type", "agent_payout")
          .not("stripe_transfer_id", "is", null);

        // Update payout runs status to completed
        await supabaseAdmin
          .from("finance_payout_runs")
          .update({
            stripe_payout_id: payout.id,
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq("status", "processing");

        log("Payout marked as complete", { payoutId: payout.id });

        break;
      }

      // ========================================
      // Subscription Events (existing)
      // ========================================
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        log("Subscription event", { 
          subscriptionId: subscription.id, 
          status: subscription.status,
          customerId: subscription.customer 
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        log("Subscription canceled", { subscriptionId: subscription.id });
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
