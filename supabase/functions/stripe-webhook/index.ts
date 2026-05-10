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

const TIER_HIERARCHY: Record<string, number> = { free: 0, flex: 1, voyager: 2, explorer: 3, adventurer: 4 };

/**
 * Upsert user_tiers. By default, never downgrades (matches credit-purchase semantics).
 * Pass { allowDowngrade: true } for cancellation flows that must force a downgrade.
 */
async function upsertUserTier(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  newTier: string,
  opts: { allowDowngrade?: boolean } = {},
) {
  const { data: currentTierData } = await supabaseAdmin
    .from('user_tiers')
    .select('tier')
    .eq('user_id', userId)
    .maybeSingle();
  const currentTier = currentTierData?.tier || 'free';
  const currentRank = TIER_HIERARCHY[currentTier] ?? 0;
  const newRank = TIER_HIERARCHY[newTier] ?? 0;

  if (opts.allowDowngrade) {
    await supabaseAdmin.from('user_tiers').upsert({
      user_id: userId,
      tier: newTier,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    console.log(`[STRIPE-WEBHOOK] User tier set (downgrade allowed)`, JSON.stringify({ userId, from: currentTier, to: newTier }));
    return;
  }

  if (newRank > currentRank) {
    await supabaseAdmin.from('user_tiers').upsert({
      user_id: userId,
      tier: newTier,
      first_purchase_at: currentTierData ? undefined : new Date().toISOString(),
      highest_purchase: newTier,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    console.log(`[STRIPE-WEBHOOK] User tier upgraded`, JSON.stringify({ userId, from: currentTier, to: newTier }));
  } else if (!currentTierData) {
    await supabaseAdmin.from('user_tiers').insert({
      user_id: userId,
      tier: newTier,
      first_purchase_at: new Date().toISOString(),
      highest_purchase: newTier,
    });
    console.log(`[STRIPE-WEBHOOK] User tier created`, JSON.stringify({ userId, tier: newTier }));
  }
}

/**
 * Resolve a Supabase auth user_id from a Stripe customer id, via email match.
 * Used as a fallback when subscription metadata is missing.
 */
async function resolveUserIdFromCustomer(
  supabaseAdmin: ReturnType<typeof createClient>,
  stripe: Stripe,
  customerId: string | null,
): Promise<string | null> {
  if (!customerId) return null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer || (customer as Stripe.DeletedCustomer).deleted) return null;
    const email = (customer as Stripe.Customer).email;
    if (!email) return null;
    const { data } = await supabaseAdmin.auth.admin.listUsers();
    const match = data?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    return match?.id ?? null;
  } catch (err) {
    console.warn(`[STRIPE-WEBHOOK] resolveUserIdFromCustomer failed`, err instanceof Error ? err.message : String(err));
    return null;
  }
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  // Hoisted so the outer catch can record errors against the event row.
  let event: Stripe.Event | null = null;
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;
  let webhookResult: 'handled' | 'unhandled' = 'handled';

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

    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      log("Signature verification failed", err);
      return new Response(`Webhook signature verification failed`, { status: 400 });
    }

    log("Event type", { type: event.type, id: event.id });

    supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // RS.L4 — observability: log every event before processing.
    // UNIQUE(event_id) means a duplicate insert (Stripe retry of a previously
    // processed event) returns 23505, in which case we short-circuit 200.
    const { error: logErr } = await supabaseAdmin.from('stripe_webhook_log').insert({
      event_id: event.id,
      event_type: event.type,
      payload: { id: (event.data.object as any)?.id, type: event.type },
      result: 'received',
    });
    if (logErr && (logErr as any).code === '23505') {
      log('Duplicate event ID — already processed', { eventId: event.id });
      return new Response('OK', { status: 200 });
    }
    if (logErr) {
      // Non-fatal: still process the event so fulfillment isn't blocked by logging.
      log('stripe_webhook_log insert failed (non-fatal)', logErr);
    }

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
            const { error: stateError } = await supabaseAdmin.rpc('transition_booking_state', {
              p_activity_id: metadata.itemId, p_new_state: 'booked_confirmed',
              p_trigger_source: 'stripe_webhook', p_trigger_reference: session.id,
              p_metadata: { payment_id: payment.id, stripe_session_id: session.id },
            });
            if (stateError) {
              console.error('[stripe-webhook] transition_booking_state failed:', stateError, { activityId: metadata.itemId });
            }
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
            const newTier = clubInfo ? clubInfo.tier : 'flex';
            await upsertUserTier(supabaseAdmin, userId, newTier);
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

          // Atomic add — single SQL UPDATE prevents lost-update under concurrent webhooks
          const { data: newRemaining, error: updateErr } = await supabaseAdmin.rpc('add_to_group_budget', {
            p_budget_id: budget.id,
            p_credits: creditsToAdd,
          });
          if (updateErr) {
            logError("CRITICAL: add_to_group_budget FAILED", JSON.stringify(updateErr));
            throw new Error(`add_to_group_budget failed: ${updateErr.message}`);
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
            userId, tripId, creditsToAdd, newRemaining,
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
      // Checkout Session Expired / Async Payment Failed
      // Finalize any pending trip_payments rows so the UI doesn't get stuck.
      // ========================================
      case "checkout.session.expired":
      case "checkout.session.async_payment_failed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const newStatus = event.type === "checkout.session.expired" ? 'cancelled' : 'failed';
        const { data: rows, error } = await supabaseAdmin
          .from("trip_payments")
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('stripe_checkout_session_id', session.id)
          .in('status', ['pending', 'processing'])
          .select('id');
        if (error) logError("Failed to finalize trip_payments on session expiry/failure", { error: error.message, sessionId: session.id });
        else log("Finalized trip_payments rows", { count: rows?.length || 0, sessionId: session.id, newStatus });
        break;
      }

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

          let activityId = originalEntry.metadata?.activity_id as string | undefined;

          // Fallback: if metadata didn't carry activity_id, look it up by charge id.
          if (!activityId) {
            const { data: paymentRow } = await supabaseAdmin
              .from('trip_payments')
              .select('metadata')
              .eq('stripe_charge_id', charge.id)
              .maybeSingle();
            const payMeta = (paymentRow?.metadata ?? {}) as Record<string, any>;
            activityId = payMeta.activity_id || payMeta.itemId;
            if (!activityId) {
              logError('charge.refunded with no activity_id — manual review needed', {
                chargeId: charge.id,
                refundId: latestRefund?.id,
              });
            }
          }

          if (activityId) {
            await supabaseAdmin.rpc('transition_booking_state', {
              p_activity_id: activityId, p_new_state: 'refunded',
              p_trigger_source: 'stripe_webhook', p_trigger_reference: latestRefund?.id,
              p_metadata: { refund_amount: charge.amount_refunded },
            });

            // Zero the activity cost so the budget summary reflects the refund.
            // Without this, trip budgets show the cost as still-spent forever.
            const { error: costErr } = await supabaseAdmin
              .from('activity_costs')
              .update({
                is_paid: false,
                paid_amount_usd: 0,
                paid_amount_local: 0,
                currency: charge.currency.toUpperCase(),  // capture the actual refund currency (RS.M.B3)
                refunded_at: new Date().toISOString(),
                refund_amount_cents: charge.amount_refunded,
                updated_at: new Date().toISOString(),
              })
              .eq('activity_id', activityId);
            if (costErr) {
              logError('Failed to zero activity_costs on refund', { activityId, error: costErr });
            } else {
              log('activity_costs zeroed for refund', { activityId, refundAmount: charge.amount_refunded });
            }

            // ── Vendor-side Viator cancellation ──
            try {
              const { data: activityRow } = await supabaseAdmin
                .from('trip_activities')
                .select('id, metadata, vendor_booking_id')
                .eq('id', activityId)
                .maybeSingle();

              const meta = (activityRow?.metadata ?? {}) as Record<string, any>;
              const viatorBookingRef: string | undefined =
                meta.bookingRef || meta.viator_booking_ref || activityRow?.vendor_booking_id || undefined;

              if (viatorBookingRef && !meta.vendor_cancelled_at) {
                const apiKey = Deno.env.get('VIATOR_API_KEY');
                if (!apiKey) {
                  logError('VIATOR_API_KEY not set; cannot cancel vendor booking', { activityId, viatorBookingRef });
                } else {
                  const resp = await fetch(
                    `https://api.viator.com/partner/bookings/${encodeURIComponent(viatorBookingRef)}/cancel`,
                    {
                      method: 'POST',
                      headers: {
                        'Accept': 'application/json;version=2.0',
                        'Content-Type': 'application/json',
                        'exp-api-key': apiKey,
                      },
                      body: JSON.stringify({ reason: 'CUSTOMER_REQUESTED' }),
                    },
                  );
                  const bodyText = await resp.text();
                  const nextMeta = {
                    ...meta,
                    ...(resp.ok
                      ? { vendor_cancelled_at: new Date().toISOString(), vendor_cancel_response: bodyText.slice(0, 500) }
                      : {
                          vendor_cancel_failed: true,
                          vendor_cancel_status: resp.status,
                          vendor_cancel_error: bodyText.slice(0, 500),
                          vendor_cancel_attempted_at: new Date().toISOString(),
                        }),
                  };
                  await supabaseAdmin.from('trip_activities').update({ metadata: nextMeta }).eq('id', activityId);
                  if (resp.ok) log('Viator vendor cancellation succeeded', { activityId, viatorBookingRef });
                  else logError('Viator vendor cancellation failed', { activityId, viatorBookingRef, status: resp.status });
                }
              } else if (!viatorBookingRef) {
                log('charge.refunded: no Viator booking ref on activity, skipping vendor cancel', { activityId });
              } else {
                log('charge.refunded: vendor already cancelled, skipping', { activityId, vendor_cancelled_at: meta.vendor_cancelled_at });
              }
            } catch (cancelErr) {
              logError('Viator cancel exception', { activityId, error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr) });
              // Never throw — webhook must still 200 to Stripe.
            }
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
                // 1) Compute already-spent credits from this pack via the ledger
                const { data: spentForSession } = await supabaseAdmin
                  .from('credit_ledger')
                  .select('credits_delta')
                  .eq('stripe_session_id', checkoutSession.id)
                  .eq('transaction_type', 'spend');
                const totalSpentFromThisPack = (spentForSession || [])
                  .reduce((sum, row) => sum + Math.abs(Number(row.credits_delta) || 0), 0);

                // 2) Pack totals (granted vs remaining) for audit
                const { data: purchaseRows } = await supabaseAdmin
                  .from('credit_purchases')
                  .select('id, remaining, amount')
                  .eq('stripe_session_id', checkoutSession.id);
                const totalGranted   = (purchaseRows || []).reduce((s, r) => s + Number(r.amount    || 0), 0);
                const totalRemaining = (purchaseRows || []).reduce((s, r) => s + Number(r.remaining || 0), 0);

                // 3) Zero remaining on every credit_purchases row for this session
                for (const row of creditRows) {
                  totalClawed += row.remaining;
                  await supabaseAdmin
                    .from('credit_purchases')
                    .update({ remaining: 0, updated_at: new Date().toISOString() })
                    .eq('id', row.id);
                }

                // 4) Single ledger audit row — branch on partial-spend
                if (totalSpentFromThisPack > 0) {
                  // Policy (a): forgive already-spent credits; only the unspent portion is clawed.
                  // Already-spent credits are not reversed — we eat the loss rather than push the
                  // user's free-tier balance negative.
                  console.warn('[stripe-webhook] Refund on partially-spent pack — clawing back unspent only', {
                    userId: refundUserId,
                    sessionId: checkoutSession.id,
                    totalGranted,
                    totalRemaining,
                    totalSpent: totalSpentFromThisPack,
                  });
                  await supabaseAdmin.from('credit_ledger').insert({
                    user_id: refundUserId,
                    transaction_type: 'refund',
                    action_type: 'stripe_refund_partial_spent',
                    credits_delta: -totalRemaining,
                    is_free_credit: false,
                    stripe_session_id: checkoutSession.id,
                    notes: `Stripe refund on partially-spent pack. Clawed: ${totalRemaining}, already spent: ${totalSpentFromThisPack}, total granted: ${totalGranted}`,
                    metadata: {
                      total_granted: totalGranted,
                      total_spent: totalSpentFromThisPack,
                      total_clawed: totalRemaining,
                      refund_id: refundRef,
                    },
                  });
                } else {
                  // Full claw-back, original ledger shape
                  await supabaseAdmin.from('credit_ledger').insert({
                    user_id: refundUserId,
                    transaction_type: 'refund',
                    action_type: 'stripe_refund',
                    credits_delta: -totalClawed,
                    is_free_credit: false,
                    stripe_session_id: checkoutSession.id,
                    notes: `Stripe refund clawback: ${totalClawed} credits (refund ${refundRef})`,
                  });
                }

                // 5) Sync balance cache
                await syncBalanceCache(supabaseAdmin, refundUserId);
                log("Consumer credit clawback complete", {
                  userId: refundUserId,
                  creditsClawed: totalClawed,
                  alreadySpent: totalSpentFromThisPack,
                  refundId: refundRef,
                });
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

      // ========================================
      // Subscription Renewals — invoice.payment_succeeded
      //   Fires monthly/yearly when Stripe auto-charges an active subscription.
      //   Initial-purchase grants are handled via checkout.session.completed; this
      //   handler is renewals only. Idempotent on invoice.id.
      // ========================================
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        // deno-lint-ignore no-explicit-any
        const subscriptionRef = (invoice as any).subscription as string | null;
        if (!subscriptionRef) {
          log("invoice.payment_succeeded: not a subscription invoice — skipping", { invoiceId: invoice.id });
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionRef);
        let userId = (sub.metadata?.user_id || sub.metadata?.userId) as string | undefined;
        if (!userId) {
          const fallbackId = await resolveUserIdFromCustomer(supabaseAdmin, stripe, sub.customer as string);
          if (fallbackId) {
            console.warn(`[STRIPE-WEBHOOK] invoice.payment_succeeded: resolved userId via customer.email fallback`, JSON.stringify({ subId: sub.id, userId: fallbackId }));
            userId = fallbackId;
          }
        }

        // Resolve product/tier — prefer metadata, fall back to subscription line item product
        const productId = (sub.items.data[0]?.price?.product as string | undefined) ?? undefined;
        const metaTier = (sub.metadata?.tier || sub.metadata?.club_tier) as string | undefined;
        const clubInfo = productId ? CLUB_PRODUCT_MAP[productId] : undefined;
        const tier = (metaTier && ['voyager', 'explorer', 'adventurer'].includes(metaTier))
          ? metaTier
          : clubInfo?.tier;

        if (!userId || !tier || !clubInfo) {
          console.warn(`[STRIPE-WEBHOOK] invoice.payment_succeeded: cannot resolve user/tier — skipping`, JSON.stringify({
            subId: sub.id, invoiceId: invoice.id, hasUserId: !!userId, hasTier: !!tier, productId,
          }));
          break;
        }

        const renewalSessionId = `subscription_renewal_${invoice.id}`;
        // deno-lint-ignore no-explicit-any
        const priceId = ((invoice as any).lines?.data?.[0]?.price?.id as string | undefined) ?? null;

        const { error: fulfillErr } = await supabaseAdmin.rpc('fulfill_credit_purchase', {
          p_user_id: userId,
          p_credits: clubInfo.baseCredits,
          p_bonus_credits: clubInfo.bonusCredits,
          p_credit_type: 'club_base',
          p_stripe_session_id: renewalSessionId,
          p_amount_cents: invoice.amount_paid || 0,
          p_club_tier: tier,
          p_product_id: productId ?? null,
          p_price_id: priceId,
        });

        if (fulfillErr) {
          logError("CRITICAL: subscription renewal fulfill_credit_purchase RPC FAILED — will retry via Stripe", JSON.stringify(fulfillErr));
          throw new Error(`subscription renewal fulfill failed: ${fulfillErr.message}`);
        }

        await upsertUserTier(supabaseAdmin, userId, tier);
        await syncBalanceCache(supabaseAdmin, userId);
        log("Subscription renewed", { userId, tier, invoiceId: invoice.id, subId: sub.id });
        break;
      }

      // ========================================
      // Subscription Cancellation — customer.subscription.deleted
      //   Revoke club-tier credits and downgrade tier to 'free'.
      // ========================================
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        let userId = (sub.metadata?.user_id || sub.metadata?.userId) as string | undefined;
        if (!userId) {
          const fallbackId = await resolveUserIdFromCustomer(supabaseAdmin, stripe, sub.customer as string);
          if (fallbackId) {
            console.warn(`[STRIPE-WEBHOOK] subscription.deleted: resolved userId via customer.email fallback`, JSON.stringify({ subId: sub.id, userId: fallbackId }));
            userId = fallbackId;
          }
        }
        if (!userId) {
          console.warn(`[STRIPE-WEBHOOK] subscription.deleted: cannot resolve userId — skipping`, JSON.stringify({ subId: sub.id }));
          break;
        }

        // Zero out remaining club credits (base + bonus)
        const { error: zeroErr } = await supabaseAdmin
          .from('credit_purchases')
          .update({ remaining: 0, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .in('credit_type', ['club_base', 'club_bonus']);
        if (zeroErr) logError("subscription.deleted: failed to zero club credits", JSON.stringify(zeroErr));

        // Audit row
        const cancelledAt = sub.canceled_at ? new Date(sub.canceled_at * 1000).toISOString() : new Date().toISOString();
        await supabaseAdmin.from('credit_ledger').insert({
          user_id: userId,
          transaction_type: 'subscription_cancel',
          credits_delta: 0,
          is_free_credit: false,
          action_type: 'subscription_deleted',
          notes: `Club subscription ${sub.id} cancelled — credits revoked`,
          metadata: { stripe_subscription_id: sub.id, cancelled_at: cancelledAt },
        });

        // Force downgrade to free
        await upsertUserTier(supabaseAdmin, userId, 'free', { allowDowngrade: true });
        await syncBalanceCache(supabaseAdmin, userId);
        log("Subscription cancelled", { userId, subId: sub.id, cancelledAt });
        break;
      }

      // ========================================
      // Subscription created/updated — RS.M.P5
      //   - active/trialing → upsert tier (no-downgrade) + stamp status columns
      //   - past_due / incomplete* → status-only stamp (Stripe retries ~3 weeks)
      //   - canceled / unpaid → mirror subscription.deleted: revoke club credits,
      //     force-downgrade tier to free, sync balance cache.
      //   Initial credit grants stay owned by checkout.session.completed.
      // ========================================
      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;

        // Resolve user_id (metadata first, customer-email fallback — same pattern as deleted)
        let userId = (sub.metadata?.user_id || sub.metadata?.userId) as string | undefined;
        if (!userId) {
          const fb = await resolveUserIdFromCustomer(supabaseAdmin, stripe, sub.customer as string);
          if (fb) {
            console.warn(`[STRIPE-WEBHOOK] ${event.type}: resolved userId via customer.email fallback`, JSON.stringify({ subId: sub.id, userId: fb }));
            userId = fb;
          }
        }
        if (!userId) {
          log(`${event.type}: cannot resolve userId — skipping`, { subId: sub.id });
          break;
        }

        const status = sub.status;
        const tier = (sub.metadata?.tier || sub.metadata?.club_tier || 'voyager') as string;
        const periodEndIso = sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : null;

        if (status === 'active' || status === 'trialing') {
          // Upgrade-only path; checkout.session.completed already handled the grant.
          await upsertUserTier(supabaseAdmin, userId, tier);

          await supabaseAdmin.from('user_tiers').update({
            stripe_subscription_id: sub.id,
            subscription_status: status,
            current_period_end: periodEndIso,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);

          log("Subscription active/trialing — tier + status updated", { userId, tier, status, subId: sub.id });

        } else if (status === 'past_due' || status === 'incomplete' || status === 'incomplete_expired') {
          // Don't revoke benefits — Stripe retries renewals for ~3 weeks. UI shows "needs attention".
          await supabaseAdmin.from('user_tiers').update({
            subscription_status: status,
            current_period_end: periodEndIso,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);

          log("Subscription needs attention — flagged for UI notice", { userId, status, subId: sub.id });

        } else if (status === 'canceled' || status === 'unpaid') {
          // Treat like deleted: revoke club credits, force-downgrade, sync balance.
          const { error: zeroErr } = await supabaseAdmin
            .from('credit_purchases')
            .update({ remaining: 0, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .in('credit_type', ['club_base', 'club_bonus']);
          if (zeroErr) logError(`${event.type}: failed to zero club credits`, JSON.stringify(zeroErr));

          await supabaseAdmin.from('credit_ledger').insert({
            user_id: userId,
            transaction_type: 'subscription_cancel',
            credits_delta: 0,
            is_free_credit: false,
            action_type: 'subscription_updated_canceled',
            notes: `Subscription ${sub.id} transitioned to ${status} — credits revoked`,
            metadata: { stripe_subscription_id: sub.id, status },
          });

          await upsertUserTier(supabaseAdmin, userId, 'free', { allowDowngrade: true });
          await supabaseAdmin.from('user_tiers').update({
            subscription_status: status,
            current_period_end: periodEndIso,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);

          await syncBalanceCache(supabaseAdmin, userId);
          log("Subscription canceled/unpaid — credits revoked", { userId, status, subId: sub.id });

        } else {
          // paused, etc. — observe only
          log("Subscription event — observed (no action)", { userId, status, subId: sub.id });
        }

        break;
      }

      // ========================================
      // Recurring invoice failed — RS.1
      //   Mark tier as past_due during retry window; downgrade to free on final attempt.
      // ========================================
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subscriptionId = typeof (invoice as any).subscription === 'string'
          ? (invoice as any).subscription as string
          : ((invoice as any).subscription?.id as string | undefined);
        if (!subscriptionId) {
          log('invoice.payment_failed: no subscription on invoice — skipping', { invoiceId: invoice.id });
          break;
        }

        const sub = await stripe.subscriptions.retrieve(subscriptionId);
        let userId = (sub.metadata?.user_id || sub.metadata?.userId) as string | undefined;
        if (!userId) {
          const fb = await resolveUserIdFromCustomer(supabaseAdmin, stripe, sub.customer as string);
          if (fb) {
            console.warn(`[STRIPE-WEBHOOK] invoice.payment_failed: resolved userId via customer.email fallback`, JSON.stringify({ subId: sub.id, userId: fb }));
            userId = fb;
          }
        }
        if (!userId) {
          logError('invoice.payment_failed missing user_id', { subscriptionId, invoiceId: invoice.id });
          break;
        }

        const attemptCount = (invoice as any).attempt_count ?? 0;
        const nextAttemptTs = (invoice as any).next_payment_attempt as number | null | undefined;
        const isFinalAttempt = attemptCount >= 4 || sub.status === 'canceled' || sub.status === 'unpaid';

        const metadata = {
          payment_failed_at: new Date().toISOString(),
          attempt_count: attemptCount,
          next_retry_at: nextAttemptTs ? new Date(nextAttemptTs * 1000).toISOString() : null,
          stripe_subscription_id: sub.id,
          stripe_invoice_id: invoice.id,
        };

        if (isFinalAttempt) {
          // Revoke club credits + force-downgrade to free (mirror cancellation flow).
          const { error: zeroErr } = await supabaseAdmin
            .from('credit_purchases')
            .update({ remaining: 0, updated_at: new Date().toISOString() })
            .eq('user_id', userId)
            .in('credit_type', ['club_base', 'club_bonus']);
          if (zeroErr) logError('invoice.payment_failed: failed to zero club credits', JSON.stringify(zeroErr));

          await upsertUserTier(supabaseAdmin, userId, 'free', { allowDowngrade: true });
          await supabaseAdmin.from('user_tiers').update({
            subscription_status: 'past_due',
            metadata,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);
          await syncBalanceCache(supabaseAdmin, userId);
          log('invoice.payment_failed — final attempt, downgraded to free', { userId, subId: sub.id, attemptCount });
        } else {
          await supabaseAdmin.from('user_tiers').update({
            subscription_status: 'past_due',
            metadata,
            updated_at: new Date().toISOString(),
          }).eq('user_id', userId);
          log('invoice.payment_failed — flagged past_due, awaiting retry', { userId, subId: sub.id, attemptCount, nextRetryAt: metadata.next_retry_at });
        }

        // TODO: trigger email notification once template is ready.
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        const lastErr = pi.last_payment_error;
        log('payment_intent.payment_failed', {
          paymentIntentId: pi.id,
          code: lastErr?.code,
          declineCode: lastErr?.decline_code,
          message: lastErr?.message,
        });

        // Mark trip_payments as failed if we have a record
        const { data: payment } = await supabaseAdmin
          .from('trip_payments')
          .select('id, metadata')
          .eq('stripe_payment_intent_id', pi.id)
          .maybeSingle();

        if (payment) {
          await supabaseAdmin.from('trip_payments').update({
            status: 'failed',
            metadata: {
              ...(payment.metadata || {}),
              stripe_failure_code: lastErr?.code,
              stripe_failure_decline_code: lastErr?.decline_code,
              stripe_failure_message: lastErr?.message,
              failed_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          }).eq('id', payment.id);
        }

        // Mark any pending credit charges as failed
        const userId = (pi.metadata?.user_id || pi.metadata?.userId) as string | undefined;
        if (userId) {
          await supabaseAdmin.from('pending_credit_charges')
            .update({
              status: 'failed',
              resolved_at: new Date().toISOString(),
              resolution_note: `Stripe payment failed: ${lastErr?.code || 'unknown'}`,
            })
            .eq('user_id', userId)
            .eq('status', 'pending')
            .filter('metadata->>stripe_payment_intent_id', 'eq', pi.id);
        }
        break;
      }

      case "payment_intent.canceled": {
        const pi = event.data.object as Stripe.PaymentIntent;
        log('payment_intent.canceled', { paymentIntentId: pi.id, reason: pi.cancellation_reason });
        await supabaseAdmin.from('trip_payments').update({
          status: 'cancelled',
          metadata: {
            cancellation_reason: pi.cancellation_reason,
            cancelled_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }).eq('stripe_payment_intent_id', pi.id);
        break;
      }

      default:
        webhookResult = 'unhandled';
        log("Unhandled event type", { type: event.type });
    }

    // RS.L4 — record final outcome of the event.
    try {
      await supabaseAdmin.from('stripe_webhook_log')
        .update({ result: webhookResult })
        .eq('event_id', event.id);
    } catch (updateErr) {
      log('stripe_webhook_log result update failed (non-fatal)', updateErr);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" }, status: 200,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    log("CRITICAL ERROR", { message, stack });
    // Best-effort: record the error against the event row if we got that far.
    try {
      if (supabaseAdmin && event?.id) {
        await supabaseAdmin.from('stripe_webhook_log')
          .update({ result: 'error', error_message: message })
          .eq('event_id', event.id);
      }
    } catch { /* swallow — never mask the real error */ }
    // Return 500 so Stripe retries automatically (up to 3 days, exponential backoff).
    // Idempotency guards (credit_ledger, group_unlocks, trip_purchases) prevent duplicate fulfillment on retry.
    return new Response(JSON.stringify({ received: false, error: 'fulfillment_failed', details: message }), {
      headers: { "Content-Type": "application/json" }, status: 500,
    });
  }
});

