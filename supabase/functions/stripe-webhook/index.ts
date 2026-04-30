/**
 * Stripe Webhook Handler - Enhanced with FIFO credit purchases + badges + group unlocks
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const log = (step: string, details?: unknown) => {
  console.log(`[STRIPE-WEBHOOK] ${step}`, details ? JSON.stringify(details) : '');
};
const logError = (step: string, details?: unknown) => {
  console.error(`[STRIPE-WEBHOOK] ${step}`, details ? JSON.stringify(details) : '');
};

// Club pack product IDs → tier mapping
const CLUB_PRODUCT_MAP: Record<string, { tier: string; baseCredits: number; bonusCredits: number }> = {
  'prod_TwpdsFwCQpA4ew': { tier: 'voyager', baseCredits: 500, bonusCredits: 100 },
  'prod_TwpdzBlDJuJfbS': { tier: 'explorer', baseCredits: 1200, bonusCredits: 400 },
  'prod_TwpdxFwT7d6EIc': { tier: 'adventurer', baseCredits: 2500, bonusCredits: 700 },
};

// Group unlock product IDs → tier mapping
const GROUP_PRODUCT_MAP: Record<string, { tier: string; caps: Record<string, number> }> = {
  'prod_TwpdLWc2OUADWF': { tier: 'small', caps: { swap_activity: 15, regenerate_day: 8, ai_message: 30, restaurant_rec: 10 } },
  'prod_TwpdnmZV4SWa88': { tier: 'medium', caps: { swap_activity: 25, regenerate_day: 12, ai_message: 50, restaurant_rec: 15 } },
  'prod_TwpdEoxWuAKPOB': { tier: 'large', caps: { swap_activity: 50, regenerate_day: 20, ai_message: 100, restaurant_rec: 25 } },
};

/**
 * Sync credit_balances cache from credit_purchases source of truth.
 */
async function syncBalanceCache(supabaseAdmin: ReturnType<typeof createClient>, userId: string) {
  const now = new Date();
  const { data: rows } = await supabaseAdmin
    .from('credit_purchases')
    .select('remaining, expires_at, credit_type')
    .eq('user_id', userId)
    .gt('remaining', 0);

  let purchased = 0;
  let free = 0;
  let freeExpiresAt: string | null = null;

  for (const row of rows || []) {
    const expired = row.expires_at && new Date(row.expires_at) < now;
    if (expired) continue;
    if (['free_monthly', 'signup_bonus', 'referral_bonus'].includes(row.credit_type)) {
      free += row.remaining;
      if (row.expires_at && (!freeExpiresAt || new Date(row.expires_at) > new Date(freeExpiresAt))) {
        freeExpiresAt = row.expires_at;
      }
    } else {
      purchased += row.remaining;
    }
  }

  await supabaseAdmin
    .from('credit_balances')
    .upsert({
      user_id: userId,
      purchased_credits: purchased,
      free_credits: free,
      free_credits_expires_at: freeExpiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
}

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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (event.type) {
      // ========================================
      // Payment Intent Succeeded
      // ========================================
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        log("PaymentIntent succeeded", { id: paymentIntent.id, amount: paymentIntent.amount, metadata: paymentIntent.metadata });

        const metadata = paymentIntent.metadata || {};
        
        // Agency payment handling
        if (metadata.trip_id || metadata.invoice_id || metadata.agent_id) {
          const agentId = metadata.agent_id;
          const tripId = metadata.trip_id;
          const invoiceId = metadata.invoice_id;
          
          if (agentId) {
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

            const stripeFee = Math.round(paymentIntent.amount * 0.029 + 30);

            await supabaseAdmin.from("finance_ledger_entries").insert({
              agent_id: agentId,
              trip_id: tripId || null,
              invoice_id: invoiceId || null,
              entry_type: 'client_payment',
              entry_source: 'stripe_webhook',
              amount_cents: paymentIntent.amount,
              currency: paymentIntent.currency.toUpperCase(),
              description: `Payment received via Stripe`,
              stripe_payment_intent_id: paymentIntent.id,
              stripe_charge_id: typeof paymentIntent.latest_charge === 'string' ? paymentIntent.latest_charge : paymentIntent.latest_charge?.id,
              effective_date: new Date().toISOString().split('T')[0],
              metadata: { customer_email: metadata.customer_email, payment_method: paymentIntent.payment_method_types?.[0], stripe_event_id: event.id, activity_id: metadata.activity_id },
            });

            await supabaseAdmin.from("finance_ledger_entries").insert({
              agent_id: agentId,
              trip_id: tripId || null,
              invoice_id: invoiceId || null,
              entry_type: 'stripe_fee',
              entry_source: 'stripe_webhook',
              amount_cents: -stripeFee,
              currency: paymentIntent.currency.toUpperCase(),
              description: `Stripe processing fee`,
              stripe_payment_intent_id: paymentIntent.id,
              effective_date: new Date().toISOString().split('T')[0],
              metadata: { stripe_event_id: event.id },
            });

            if (invoiceId) {
              const { data: invoice } = await supabaseAdmin.from("agency_invoices").select("amount_paid_cents, total_cents").eq("id", invoiceId).single();
              if (invoice) {
                const newPaid = (invoice.amount_paid_cents || 0) + paymentIntent.amount;
                const newBalance = (invoice.total_cents || 0) - newPaid;
                await supabaseAdmin.from("agency_invoices").update({
                  amount_paid_cents: newPaid,
                  balance_due_cents: Math.max(0, newBalance),
                  status: newBalance <= 0 ? 'paid' : 'partially_paid',
                  paid_date: newBalance <= 0 ? new Date().toISOString().split('T')[0] : null,
                }).eq("id", invoiceId);
              }
            }

            if (tripId) {
              const { data: trip } = await supabaseAdmin.from("agency_trips").select("total_paid_cents").eq("id", tripId).single();
              if (trip) {
                await supabaseAdmin.from("agency_trips").update({ total_paid_cents: (trip.total_paid_cents || 0) + paymentIntent.amount }).eq("id", tripId);
              }
            }
          }
        }
        break;
      }

      // ========================================
      // Checkout Session Completed
      // ========================================
      case "checkout.session.completed": {
        // ALWAYS retrieve full session from Stripe API — event.data.object may have
        // empty/partial metadata depending on webhook payload style (Thin vs Snapshot)
        const sessionFromEvent = event.data.object as Stripe.Checkout.Session;
        log("Checkout event received, retrieving full session", { sessionId: sessionFromEvent.id });

        let session: Stripe.Checkout.Session;
        try {
          session = await stripe.checkout.sessions.retrieve(sessionFromEvent.id, {
            expand: ['line_items'],
          });
        } catch (retrieveErr) {
          log("CRITICAL: Failed to retrieve full session from Stripe", {
            sessionId: sessionFromEvent.id,
            error: retrieveErr instanceof Error ? retrieveErr.message : String(retrieveErr),
          });
          // Fall back to event data
          session = sessionFromEvent;
        }

        log("Full session retrieved", {
          sessionId: session.id,
          metadata: session.metadata,
          payment_status: session.payment_status,
          amount_total: session.amount_total,
          customer: session.customer,
        });

        const metadata = session.metadata || {};

        if (!metadata || Object.keys(metadata).length === 0) {
          logError("CRITICAL: session.metadata is empty — cannot fulfil purchase. Aborting.", {
            sessionId: session.id,
            paymentStatus: session.payment_status,
            amountTotal: session.amount_total,
            customer: session.customer,
          });
          // Return 200 so Stripe doesn't retry, but log prominently for investigation
          return new Response(JSON.stringify({ received: true, warning: "empty_metadata" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Validate critical fields present for purchase types that need them
        if (metadata.type && !metadata.user_id) {
          logError("CRITICAL: metadata.type is set but user_id is missing — cannot fulfil.", {
            sessionId: session.id,
            type: metadata.type,
            metadata,
          });
          return new Response(JSON.stringify({ received: true, warning: "missing_user_id" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        if (metadata.type === "trip_pass" && !metadata.trip_id) {
          logError("CRITICAL: trip_pass purchase missing trip_id — cannot fulfil.", {
            sessionId: session.id,
            metadata,
          });
          return new Response(JSON.stringify({ received: true, warning: "missing_trip_id" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }

        // Trip Pass Fulfillment
        if (metadata.type === "trip_pass") {
          const userId = metadata.user_id;
          const tripId = metadata.trip_id;
          if (userId && tripId) {
            await supabaseAdmin.from("trip_purchases").upsert({
              user_id: userId, trip_id: tripId, purchase_type: "trip_pass",
              features_unlocked: { unlimited_rebuilds: true, unlimited_day_builds: true, route_optimization: true, weather_tracker: true, group_budgeting: true, co_edit: true },
              stripe_session_id: session.id, created_at: new Date().toISOString(),
            }, { onConflict: "user_id,trip_id" });
            log("Trip pass fulfilled", { userId, tripId });
          }
        }

        // Activity/Flight/Hotel Payment Fulfillment
        if (metadata.tripId && metadata.itemId && metadata.itemType) {
          const { data: payment, error: updateError } = await supabaseAdmin.from("trip_payments").update({
            status: 'paid', paid_at: new Date().toISOString(),
            stripe_payment_intent_id: typeof session.payment_intent === 'string' ? session.payment_intent : (session.payment_intent as any)?.id,
            updated_at: new Date().toISOString(),
          }).eq('stripe_checkout_session_id', session.id).select().single();

          if (!updateError && payment?.external_provider === 'viator' && metadata.itemType === 'activity') {
            await supabaseAdmin.rpc('transition_booking_state', {
              p_activity_id: metadata.itemId, p_new_state: 'payment_confirmed',
              p_trigger_source: 'stripe_webhook', p_trigger_reference: session.id,
              p_metadata: { payment_id: payment.id, stripe_session_id: session.id },
            });
          }
        }

        // Day Purchase Fulfillment (legacy)
        if (metadata.type === "day_purchase") {
          const userId = metadata.user_id;
          const daysToAdd = parseInt(metadata.days || "0", 10);
          const packageTier = metadata.package_tier as 'essential' | 'complete' | null;
          const amountCents = session.amount_total || 0;

          if (userId && daysToAdd > 0) {
            const { data: existingLedger } = await supabaseAdmin.from("day_ledger").select("id").eq("stripe_session_id", session.id).eq("transaction_type", "purchase").maybeSingle();
            if (existingLedger) { log("Duplicate day purchase, skipping"); break; }

            const { data: existingBalance } = await supabaseAdmin.from("day_balances").select("*").eq("user_id", userId).maybeSingle();
            const newPurchasedDays = (existingBalance?.purchased_days || 0) + daysToAdd;
            let swapsRemaining = existingBalance?.swaps_remaining;
            let regeneratesRemaining = existingBalance?.regenerates_remaining;
            let activeTier = existingBalance?.active_tier;
            if (packageTier === 'essential') { activeTier = packageTier; swapsRemaining = (swapsRemaining || 0) + 5; regeneratesRemaining = (regeneratesRemaining || 0) + 2; }
            else if (packageTier === 'complete') { activeTier = packageTier; swapsRemaining = -1; regeneratesRemaining = -1; }

            await supabaseAdmin.from("day_balances").upsert({
              user_id: userId, purchased_days: newPurchasedDays, free_days: existingBalance?.free_days || 0,
              free_days_expires_at: existingBalance?.free_days_expires_at || null, active_tier: activeTier,
              swaps_remaining: swapsRemaining, regenerates_remaining: regeneratesRemaining,
              monthly_swaps_used: existingBalance?.monthly_swaps_used || 0, monthly_regenerates_used: existingBalance?.monthly_regenerates_used || 0,
              monthly_reset_at: existingBalance?.monthly_reset_at || new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: "user_id" });

            await supabaseAdmin.from("day_ledger").insert({
              user_id: userId, transaction_type: 'purchase', days_delta: daysToAdd, is_free_day: false,
              stripe_session_id: session.id, stripe_product_id: metadata.product_id, price_id: metadata.price_id,
              amount_cents: amountCents, package_tier: packageTier, package_days: daysToAdd,
              notes: packageTier ? `${packageTier.charAt(0).toUpperCase() + packageTier.slice(1)} package - ${daysToAdd} days` : `${daysToAdd} day${daysToAdd > 1 ? 's' : ''} à la carte`,
            });
          }
        }

        // ========================================
        // Credit Pack Purchase Fulfillment (FIFO)
        // ========================================
        if (metadata.type === "credit_purchase") {
          const userId = metadata.user_id;
          const priceId = metadata.price_id;
          const productId = metadata.product_id;
          const creditsToAdd = parseInt(metadata.credits || "0", 10);
          const amountCents = session.amount_total || 0;

          // Defensive null checks
          if (!userId) {
            logError("CRITICAL: credit_purchase missing user_id", { metadata, sessionId: session.id });
            break;
          }
          if (!creditsToAdd || isNaN(creditsToAdd) || creditsToAdd <= 0) {
            logError("CRITICAL: credit_purchase missing or invalid credits", { credits: metadata.credits, metadata, sessionId: session.id });
            break;
          }

          log("Processing credit purchase", { userId, creditsToAdd, priceId, productId, amountCents });

          if (userId && creditsToAdd > 0) {
            // Idempotency is enforced by the unique index on credit_ledger(stripe_session_id, transaction_type)
            // inside the fulfill_credit_purchase RPC — no check-then-act needed here.

            const clubInfo = productId ? CLUB_PRODUCT_MAP[productId] : null;

            // Atomic fulfillment via single transactional RPC
            const { data: fulfillResult, error: fulfillErr } = await supabaseAdmin.rpc('fulfill_credit_purchase', {
              p_user_id: userId,
              p_credits: clubInfo ? clubInfo.baseCredits : creditsToAdd,
              p_bonus_credits: clubInfo ? clubInfo.bonusCredits : 0,
              p_credit_type: clubInfo ? 'club_base' : 'flex',
              p_stripe_session_id: session.id,
              p_amount_cents: amountCents,
              p_club_tier: clubInfo?.tier ?? null,
              p_product_id: productId ?? null,
              p_price_id: priceId ?? null,
            });

            if (fulfillErr) {
              logError("CRITICAL: fulfill_credit_purchase RPC FAILED — will retry via Stripe", JSON.stringify(fulfillErr));
              throw new Error(`fulfill_credit_purchase failed: ${fulfillErr.message}`);
            }

            const result = fulfillResult as { success: boolean; skipped?: boolean; reason?: string; credits?: number; type?: string };
            if (result?.skipped) {
              log("Duplicate credit purchase (idempotent skip)", { sessionId: session.id });
            } else {
              log("Credit fulfillment complete (atomic)", { credits: result?.credits, type: result?.type });
            }

            log("Credit fulfillment complete", {
              ledgerOk: true,
              creditsAdded: creditsToAdd,
              sessionId: session.id,
            });

            // ── Upsert user_tiers (only upgrade, never downgrade) ──
            const TIER_HIERARCHY: Record<string, number> = { free: 0, flex: 1, voyager: 2, explorer: 3, adventurer: 4 };
            const newTier = clubInfo ? clubInfo.tier : 'flex';
            const { data: currentTierData } = await supabaseAdmin
              .from('user_tiers')
              .select('tier')
              .eq('user_id', userId)
              .maybeSingle();
            const currentTierRank = TIER_HIERARCHY[currentTierData?.tier || 'free'] || 0;
            const newTierRank = TIER_HIERARCHY[newTier] || 0;

            if (newTierRank > currentTierRank) {
              await supabaseAdmin.from('user_tiers').upsert({
                user_id: userId,
                tier: newTier,
                first_purchase_at: currentTierData ? undefined : new Date().toISOString(),
                highest_purchase: newTier,
                updated_at: new Date().toISOString(),
              }, { onConflict: 'user_id' });
              log("User tier upgraded", { userId, from: currentTierData?.tier || 'free', to: newTier });
            } else if (!currentTierData) {
              await supabaseAdmin.from('user_tiers').insert({
                user_id: userId,
                tier: newTier,
                first_purchase_at: new Date().toISOString(),
                highest_purchase: newTier,
              });
              log("User tier created", { userId, tier: newTier });
            }
          }
        }

        // ========================================
        // Group Pool Credit Purchase Fulfillment
        //   User bought credits and routed them directly into a trip's group pool
        //   instead of their personal balance.
        // ========================================
        if (metadata.type === "group_pool_credit_purchase") {
          const userId = metadata.user_id;
          const tripId = metadata.trip_id;
          const creditsToAdd = parseInt(metadata.credits || "0", 10);
          const amountCents = session.amount_total || 0;

          if (!userId || !tripId || !creditsToAdd || creditsToAdd <= 0) {
            logError("CRITICAL: group_pool_credit_purchase missing required fields", { metadata, sessionId: session.id });
            break;
          }

          // IDEMPOTENCY — credit_ledger has unique(stripe_session_id, transaction_type)
          const { data: existingLedger } = await supabaseAdmin
            .from("credit_ledger")
            .select("id")
            .eq("stripe_session_id", session.id)
            .eq("transaction_type", "purchase")
            .maybeSingle();

          if (existingLedger) {
            log("Duplicate group_pool_credit_purchase, skipping", { sessionId: session.id });
            break;
          }

          // Find or fall back to personal balance if budget gone
          const { data: budget } = await supabaseAdmin
            .from('group_budgets')
            .select('id, owner_id, remaining_credits')
            .eq('trip_id', tripId)
            .maybeSingle();

          if (!budget || budget.owner_id !== userId) {
            // Fallback: trip deleted or ownership changed → credit personal balance so money isn't lost
            logError("group_pool_credit_purchase: no valid budget — falling back to personal balance", {
              tripId, userId, hasBudget: !!budget,
            });

            const expires = new Date();
            expires.setMonth(expires.getMonth() + 12);
            await supabaseAdmin.from('credit_purchases').insert({
              user_id: userId,
              credit_type: 'flex',
              amount: creditsToAdd,
              remaining: creditsToAdd,
              expires_at: expires.toISOString(),
              source: 'stripe',
              stripe_session_id: session.id,
            });
            await syncBalanceCache(supabaseAdmin, userId);
            await supabaseAdmin.from('credit_ledger').insert({
              user_id: userId,
              transaction_type: 'purchase',
              action_type: 'group_pool_fallback',
              credits_delta: creditsToAdd,
              is_free_credit: false,
              stripe_session_id: session.id,
              amount_cents: amountCents,
              trip_id: tripId,
              notes: `Group pool purchase fell back to personal balance (no valid budget) — ${creditsToAdd} credits`,
            });
            log("Group-pool fallback credited to personal balance", { userId, creditsToAdd });
            break;
          }

          // Add credits to the group pool
          const { error: updateErr } = await supabaseAdmin
            .from('group_budgets')
            .update({
              remaining_credits: budget.remaining_credits + creditsToAdd,
              updated_at: new Date().toISOString(),
            })
            .eq('id', budget.id);
          if (updateErr) {
            logError("CRITICAL: group_budgets update FAILED", JSON.stringify(updateErr));
            throw new Error(`group_budgets update failed: ${updateErr.message}`);
          }

          // Group transaction log (negative credits_spent = added to pool, matches topup-group-budget)
          await supabaseAdmin.from('group_budget_transactions').insert({
            group_budget_id: budget.id,
            user_id: userId,
            action_type: 'topup',
            credits_spent: -creditsToAdd,
            was_free: false,
          });

          // Credit ledger entry (idempotency anchor; no personal balance change)
          await supabaseAdmin.from('credit_ledger').insert({
            user_id: userId,
            transaction_type: 'purchase',
            action_type: 'group_pool_purchase',
            credits_delta: 0, // Personal balance unchanged
            is_free_credit: false,
            stripe_session_id: session.id,
            amount_cents: amountCents,
            trip_id: tripId,
            notes: `Group pool top-up via Stripe — ${creditsToAdd} credits ($${(amountCents / 100).toFixed(2)})`,
            metadata: { budget_id: budget.id, group_credits_added: creditsToAdd },
          });

          log("Group pool credit purchase fulfilled", {
            userId, tripId, creditsToAdd, newRemaining: budget.remaining_credits + creditsToAdd,
          });
        }

        // ========================================
        // Credit Top-Up Fulfillment (from add-credits function)
        // ========================================
        if (metadata.type === "credit_topup") {
          const userId = metadata.user_id;
          const amountCents = parseInt(metadata.amount_cents || "0", 10);

          if (!userId) {
            logError("CRITICAL: credit_topup missing user_id", { metadata, sessionId: session.id });
            break;
          }
          if (!amountCents || amountCents <= 0) {
            logError("CRITICAL: credit_topup missing or invalid amount_cents", { metadata, sessionId: session.id });
            break;
          }

          // Convert cents to credits (1 cent = 1 credit for top-ups)
          const creditsToAdd = amountCents;
          log("Processing credit top-up", { userId, creditsToAdd, amountCents });

          // IDEMPOTENCY CHECK
          const { data: existingLedger } = await supabaseAdmin
            .from("credit_ledger")
            .select("id")
            .eq("stripe_session_id", session.id)
            .eq("transaction_type", "purchase")
            .maybeSingle();

          if (existingLedger) {
            log("Duplicate credit top-up event, skipping", { sessionId: session.id });
            break;
          }

          // Insert credit_purchases row (12 month expiry like flex)
          const topupExpires = new Date();
          topupExpires.setMonth(topupExpires.getMonth() + 12);

          const { error: purchaseErr } = await supabaseAdmin.from('credit_purchases').insert({
            user_id: userId,
            credit_type: 'topup',
            amount: creditsToAdd,
            remaining: creditsToAdd,
            expires_at: topupExpires.toISOString(),
            source: 'stripe',
            stripe_session_id: session.id,
          });
          if (purchaseErr) logError("CRITICAL: topup credit_purchases INSERT FAILED", JSON.stringify(purchaseErr));

          // Sync balance cache
          try {
            await syncBalanceCache(supabaseAdmin, userId);
            log("Balance cache synced for topup", { userId });
          } catch (syncErr) {
            logError("CRITICAL: syncBalanceCache FAILED for topup", { error: syncErr instanceof Error ? syncErr.message : String(syncErr) });
          }

          // Ledger entry
          const { error: ledgerErr } = await supabaseAdmin.from("credit_ledger").insert({
            user_id: userId,
            transaction_type: 'purchase',
            action_type: 'topup',
            credits_delta: creditsToAdd,
            is_free_credit: false,
            stripe_session_id: session.id,
            amount_cents: amountCents,
            notes: `Quick Top-Up - ${creditsToAdd} credits ($${(amountCents / 100).toFixed(2)})`,
          });
          if (ledgerErr) logError("CRITICAL: topup credit_ledger INSERT FAILED", JSON.stringify(ledgerErr));

          log("Credit top-up fulfillment complete", {
            purchaseOk: !purchaseErr,
            ledgerOk: !ledgerErr,
            creditsAdded: creditsToAdd,
            sessionId: session.id,
          });

          // Upsert user_tiers to at least 'flex'
          const { data: currentTierData } = await supabaseAdmin
            .from('user_tiers')
            .select('tier')
            .eq('user_id', userId)
            .maybeSingle();
          if (!currentTierData) {
            await supabaseAdmin.from('user_tiers').insert({
              user_id: userId,
              tier: 'flex',
              first_purchase_at: new Date().toISOString(),
              highest_purchase: 'flex',
            });
          }
        }

        if (metadata.type === "group_unlock") {
          const userId = metadata.user_id;
          const tripId = metadata.trip_id;
          const productId = metadata.product_id;

          if (userId && tripId && productId) {
            log("Processing group unlock", { userId, tripId, productId });

            // OWNERSHIP CHECK: Verify the trip belongs to this user
            const { data: tripRow, error: tripErr } = await supabaseAdmin
              .from('trips')
              .select('user_id')
              .eq('id', tripId)
              .maybeSingle();

            if (tripErr || !tripRow) {
              logError("CRITICAL: Group unlock trip not found", { tripId, userId, error: tripErr?.message });
              break;
            }

            if (tripRow.user_id !== userId) {
              logError("CRITICAL: Group unlock ownership mismatch — user does not own trip", {
                tripId, metadataUserId: userId, actualOwner: tripRow.user_id,
              });
              break;
            }

            // IDEMPOTENCY
            const { data: existing } = await supabaseAdmin
              .from('group_unlocks')
              .select('id')
              .eq('trip_id', tripId)
              .maybeSingle();

            if (existing) {
              log("Group unlock already exists for trip, skipping", { tripId });
              break;
            }

            const groupInfo = GROUP_PRODUCT_MAP[productId];
            if (!groupInfo) {
              log("Unknown group unlock product", { productId });
              break;
            }

            await supabaseAdmin.from('group_unlocks').insert({
              trip_id: tripId,
              purchased_by: userId,
              tier: groupInfo.tier,
              stripe_session_id: session.id,
              caps: groupInfo.caps,
              usage: { swap_activity: 0, regenerate_day: 0, ai_message: 0, restaurant_rec: 0, add_activity: 0 },
            });

            // Create group budget (mirrors purchase-group-unlock behavior)
            const TIER_CREDITS: Record<string, number> = {
              small: 150,
              medium: 300,
              large: 500,
            };
            const budgetCredits = TIER_CREDITS[groupInfo.tier] || 150;

            const { error: budgetError } = await supabaseAdmin.from('group_budgets').insert({
              trip_id: tripId,
              owner_id: userId,
              tier: groupInfo.tier,
              initial_credits: budgetCredits,
              remaining_credits: budgetCredits,
            });

            if (budgetError) {
              logError("Failed to create group_budgets row", { tripId, tier: groupInfo.tier, error: budgetError.message });
            }

            log("Group unlock fulfilled", { tripId, tier: groupInfo.tier });
          }
        }

        // Catch-all: log if metadata.type was set but didn't match any handler
        if (metadata.type && !['trip_pass', 'day_purchase', 'credit_purchase', 'credit_topup', 'group_unlock'].includes(metadata.type)) {
          logError("WARNING: Unhandled metadata.type in checkout.session.completed", {
            type: metadata.type,
            metadata,
            sessionId: session.id,
          });
        }

        // Also warn if no type was set but there IS a user_id (possible missing handler)
        if (!metadata.type && metadata.user_id && !metadata.tripId) {
          logError("WARNING: checkout.session.completed with user_id but no type", {
            metadata,
            sessionId: session.id,
            amount_total: session.amount_total,
          });
        }

        break;
      }

      // ========================================
      // Charge Refunded
      // ========================================
      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const refunds = charge.refunds?.data || [];
        const latestRefund = refunds[0];

        if (latestRefund?.id) {
          const { data: existingRefund } = await supabaseAdmin.from("finance_ledger_entries").select("id").eq("stripe_refund_id", latestRefund.id).eq("entry_type", "client_refund").maybeSingle();
          if (existingRefund) { log("Duplicate refund, skipping"); break; }
        }

        const { data: originalEntry } = await supabaseAdmin.from("finance_ledger_entries").select("*").eq("stripe_charge_id", charge.id).eq("entry_type", "client_payment").single();

        if (originalEntry) {
          await supabaseAdmin.from("finance_ledger_entries").insert({
            agent_id: originalEntry.agent_id, trip_id: originalEntry.trip_id, invoice_id: originalEntry.invoice_id,
            entry_type: 'client_refund', entry_source: 'stripe_webhook', amount_cents: -charge.amount_refunded,
            currency: charge.currency.toUpperCase(), description: `Refund processed`,
            stripe_charge_id: charge.id, stripe_refund_id: latestRefund?.id,
            effective_date: new Date().toISOString().split('T')[0],
            metadata: { refund_reason: latestRefund?.reason, stripe_event_id: event.id, activity_id: originalEntry.metadata?.activity_id },
          });

          const activityId = originalEntry.metadata?.activity_id;
          if (activityId) {
            await supabaseAdmin.rpc('transition_booking_state', {
              p_activity_id: activityId, p_new_state: 'refunded',
              p_trigger_source: 'stripe_webhook', p_trigger_reference: latestRefund?.id,
              p_metadata: { refund_amount: charge.amount_refunded },
            });
          }
        }

        // ── Consumer credit pack refund clawback ──
        // If this charge came from a credit pack purchase, zero out the credits
        const paymentIntentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
        if (paymentIntentId) {
          // Retrieve the checkout session that created this payment intent
          const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntentId, limit: 1 });
          const checkoutSession = sessions.data[0];

          if (checkoutSession?.id) {
            // Check if credit_purchases rows exist for this session
            const { data: creditRows } = await supabaseAdmin
              .from('credit_purchases')
              .select('id, user_id, remaining, credit_type, amount')
              .eq('stripe_session_id', checkoutSession.id)
              .gt('remaining', 0);

            if (creditRows && creditRows.length > 0) {
              const refundUserId = creditRows[0].user_id;
              let totalClawed = 0;

              // Idempotency: check if we already processed this refund
              const refundRef = latestRefund?.id || `refund-${charge.id}`;
              const { data: existingClawback } = await supabaseAdmin
                .from('credit_ledger')
                .select('id')
                .eq('stripe_session_id', checkoutSession.id)
                .eq('transaction_type', 'refund')
                .maybeSingle();

              if (!existingClawback) {
                // Zero out all credit_purchases rows for this session
                for (const row of creditRows) {
                  totalClawed += row.remaining;
                  await supabaseAdmin
                    .from('credit_purchases')
                    .update({ remaining: 0, updated_at: new Date().toISOString() })
                    .eq('id', row.id);
                }

                // Audit trail
                await supabaseAdmin.from('credit_ledger').insert({
                  user_id: refundUserId,
                  transaction_type: 'refund',
                  action_type: 'stripe_refund',
                  credits_delta: -totalClawed,
                  is_free_credit: false,
                  stripe_session_id: checkoutSession.id,
                  notes: `Stripe refund clawback: ${totalClawed} credits (refund ${refundRef})`,
                });

                // Sync balance cache
                await syncBalanceCache(supabaseAdmin, refundUserId);
                log("Consumer credit clawback complete", { userId: refundUserId, creditsClawed: totalClawed, refundId: refundRef });
              } else {
                log("Duplicate consumer credit clawback, skipping", { sessionId: checkoutSession.id });
              }
            }
          }
        }

        break;
      }

      // ========================================
      // Dispute Events
      // ========================================
      case "charge.dispute.created":
      case "charge.dispute.updated": {
        const dispute = event.data.object as Stripe.Dispute;
        const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
        
        const { data: originalEntry } = await supabaseAdmin.from("finance_ledger_entries").select("*").eq("stripe_charge_id", chargeId).eq("entry_type", "client_payment").single();

        if (originalEntry) {
          const { data: existingDispute } = await supabaseAdmin.from("finance_ledger_entries").select("id").eq("stripe_dispute_id", dispute.id).single();
          if (!existingDispute && (dispute.status === 'lost' || dispute.status === 'warning_needs_response')) {
            await supabaseAdmin.from("finance_ledger_entries").insert({
              agent_id: originalEntry.agent_id, trip_id: originalEntry.trip_id, invoice_id: originalEntry.invoice_id,
              entry_type: 'client_credit', entry_source: 'stripe_webhook', amount_cents: -dispute.amount,
              currency: dispute.currency.toUpperCase(), description: `Dispute ${dispute.status === 'lost' ? 'lost' : 'pending'}: ${dispute.reason}`,
              stripe_charge_id: chargeId, stripe_dispute_id: dispute.id,
              effective_date: new Date().toISOString().split('T')[0],
              metadata: { dispute_reason: dispute.reason, dispute_status: dispute.status, stripe_event_id: event.id },
            });
          }
        }
        break;
      }

      // ========================================
      // Transfer Created
      // ========================================
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer;
        const metadata = transfer.metadata || {};
        const agentId = metadata.agent_id;

        if (agentId) {
          await supabaseAdmin.from("finance_ledger_entries").insert({
            agent_id: agentId, trip_id: metadata.trip_id || null,
            entry_type: 'agent_payout', entry_source: 'stripe_webhook',
            amount_cents: -transfer.amount, currency: transfer.currency.toUpperCase(),
            description: `Payout to agent (Stripe Connect)`, stripe_transfer_id: transfer.id,
            effective_date: new Date().toISOString().split('T')[0],
            metadata: { destination_account: transfer.destination, stripe_event_id: event.id },
          });

          if (metadata.payout_run_id) {
            await supabaseAdmin.from("finance_payout_runs").update({
              stripe_transfer_id: transfer.id, status: 'processing', initiated_at: new Date().toISOString(),
            }).eq("id", metadata.payout_run_id);
          }
        }
        break;
      }

      // ========================================
      // Payout Paid
      // ========================================
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        await supabaseAdmin.from("finance_payout_runs").update({
          stripe_payout_id: payout.id, status: 'completed', completed_at: new Date().toISOString(),
        }).eq("status", "processing");
        break;
      }

      // Subscription events (existing)
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        log("Subscription event", { type: event.type });
        break;

      default:
        log("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    log("CRITICAL ERROR", { message, stack });
    // Return 500 so Stripe retries automatically (up to 3 days, exponential backoff).
    // Idempotency guards (credit_ledger, group_unlocks, trip_purchases) prevent duplicate fulfillment on retry.
    return new Response(JSON.stringify({ received: false, error: 'fulfillment_failed', details: message }), {
      headers: { "Content-Type": "application/json" }, status: 500,
    });
  }
});
