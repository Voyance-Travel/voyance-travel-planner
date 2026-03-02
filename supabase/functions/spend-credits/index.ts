// SYNC CHECK: Run 'npx ts-node scripts/check-edge-constants.ts' after any
// pricing or cost constant change. See src/config/pricing.ts for source of truth.
/**
 * Spend Credits Edge Function
 * Deducts credits using FIFO (earliest-expiring first) from credit_purchases table.
 * Also supports group unlock caps for collaborators.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Fixed credit costs
const FIXED_COSTS: Record<string, number> = {
  unlock_day: 60,
  smart_finish: 50,
  regenerate_day: 10,
  swap_activity: 5,
  add_activity: 5,
  restaurant_rec: 5,
  ai_message: 5,
  hotel_optimization: 100,
  mystery_getaway: 15,
  mystery_logistics: 5,
  transport_mode_change: 5,
  route_optimization: 20,
};

// Route optimization sliding discount schedules
const ROUTE_OPT_STANDARD_SCHEDULE = [20, 15, 10, 5];
const ROUTE_OPT_CLUB_SCHEDULE = [10, 8, 6, 3];

// Tier-based free action caps
const TIER_CAPS: Record<string, Record<string, number>> = {
  free:       { swap_activity: 3,  add_activity: 2, regenerate_day: 1, ai_message: 5,  restaurant_rec: 1 },
  flex:       { swap_activity: 3,  add_activity: 2, regenerate_day: 1, ai_message: 5,  restaurant_rec: 1 },
  voyager:    { swap_activity: 6,  add_activity: 4, regenerate_day: 2, ai_message: 10, restaurant_rec: 2 },
  explorer:   { swap_activity: 9,  add_activity: 6, regenerate_day: 3, ai_message: 15, restaurant_rec: 3 },
  adventurer: { swap_activity: 15, add_activity: 10, regenerate_day: 5, ai_message: 25, restaurant_rec: 5 },
};

// Trip length scaling for Free/Flex only
const FLEX_CAPS_BY_DAYS: Record<number, Record<string, number>> = {
  2:  { swap_activity: 3,  add_activity: 2, regenerate_day: 1, ai_message: 5,  restaurant_rec: 1 },
  4:  { swap_activity: 5,  add_activity: 3, regenerate_day: 2, ai_message: 10, restaurant_rec: 2 },
  6:  { swap_activity: 7,  add_activity: 4, regenerate_day: 3, ai_message: 15, restaurant_rec: 3 },
  8:  { swap_activity: 10, add_activity: 6, regenerate_day: 4, ai_message: 20, restaurant_rec: 4 },
};

function getScaledCaps(unlockedDays: number): Record<string, number> {
  if (unlockedDays >= 7) return FLEX_CAPS_BY_DAYS[8];
  if (unlockedDays >= 5) return FLEX_CAPS_BY_DAYS[6];
  if (unlockedDays >= 3) return FLEX_CAPS_BY_DAYS[4];
  return FLEX_CAPS_BY_DAYS[2];
}

// Variable-cost actions
const VARIABLE_COST_ACTIONS = ['trip_generation', 'hotel_search', 'group_unlock', 'regenerate_trip'];
const HOTEL_SEARCH_PER_CITY = 40;
const BASE_RATE_PER_DAY = 60;

// Actions eligible for group cap
const GROUP_CAP_ACTIONS = ['swap_activity', 'add_activity', 'regenerate_day', 'ai_message', 'restaurant_rec'];

interface SpendRequest {
  action: string;
  tripId?: string;
  activityId?: string;
  dayIndex?: number;
  creditsAmount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Deduct credits FIFO from credit_purchases using an atomic database function.
 * The RPC runs in a single transaction with row-level locks to prevent
 * partial deductions and concurrent double-spend.
 */
async function deductFIFO(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  cost: number
): Promise<{ deducted: number; purchases: Array<{ id: string; deducted: number }> }> {
  const { data, error } = await supabaseAdmin.rpc('deduct_credits_fifo', {
    p_user_id: userId,
    p_cost: cost,
  });

  if (error) {
    const msg = error.message || '';
    if (msg.includes('INSUFFICIENT_CREDITS')) {
      // Parse required/available from the error message
      const match = msg.match(/required=(\d+), available=(\d+)/);
      throw Object.assign(new Error('Insufficient credits'), {
        code: 'INSUFFICIENT_CREDITS',
        required: match ? parseInt(match[1]) : cost,
        available: match ? parseInt(match[2]) : 0,
      });
    }
    console.error('[SPEND-CREDITS] deduct_credits_fifo RPC failed:', JSON.stringify(error));
    throw new Error('Failed to deduct credits');
  }

  const result = data as { success: boolean; deducted: number; purchases: Array<{ id: string; deducted: number }> };
  return { deducted: result.deducted, purchases: result.purchases };
}

/**
 * Sync credit_balances cache from credit_purchases source of truth.
 */
async function syncBalanceCache(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string
) {
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

    if (row.credit_type === 'free_monthly' || row.credit_type === 'signup_bonus' || row.credit_type === 'referral_bonus') {
      free += row.remaining;
      // Track the latest expiration for free credits
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

  return { purchased, free, total: purchased + free };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      console.error('[SPEND-CREDITS] Auth failed:', authError?.message || 'No user');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log('[SPEND-CREDITS] User authenticated:', { userId: user.id });

    const body: SpendRequest = await req.json();
    const { action, tripId, activityId, dayIndex, creditsAmount, metadata } = body;
    console.log('[SPEND-CREDITS] Request:', { action, tripId, dayIndex, creditsAmount });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Check if user is a collaborator (not owner) on this trip ──
    let isCollaborator = false;
    if (tripId) {
      const { data: trip } = await supabaseAdmin
        .from('trips')
        .select('user_id')
        .eq('id', tripId)
        .maybeSingle();

      if (trip && trip.user_id !== user.id) {
        isCollaborator = true;
      }
    }

    // ── Group cap check for collaborators ──
    if (isCollaborator && tripId && GROUP_CAP_ACTIONS.includes(action)) {
      const { data: groupUnlock } = await supabaseAdmin
        .from('group_unlocks')
        .select('caps, usage')
        .eq('trip_id', tripId)
        .maybeSingle();

      if (groupUnlock) {
        const caps = groupUnlock.caps as Record<string, number>;
        const usage = groupUnlock.usage as Record<string, number>;
        const cap = caps[action] || 0;
        const used = usage[action] || 0;

        if (used < cap) {
          // Free under group cap — increment usage atomically
          const newUsage = { ...usage, [action]: used + 1 };
          await supabaseAdmin
            .from('group_unlocks')
            .update({ usage: newUsage })
            .eq('trip_id', tripId);

          // Log zero-cost entry
          const { error: groupLedgerErr } = await supabaseAdmin
            .from('credit_ledger')
            .insert({
              user_id: user.id,
              transaction_type: 'spend',
              credits_delta: 0,
              is_free_credit: true,
              action_type: action,
              trip_id: tripId,
              activity_id: null,
              notes: `${action.replace(/_/g, ' ')} - group cap (${used + 1}/${cap})`,
              metadata: { ...metadata, day_index: dayIndex, group_cap_used: true, activityId: activityId || null },
            });
          if (groupLedgerErr) console.error('[spend-credits] Group cap ledger insert failed:', groupLedgerErr);

          const balance = await syncBalanceCache(supabaseAdmin, user.id);

          return new Response(
            JSON.stringify({
              success: true,
              spent: 0,
              action,
              groupCapUsed: true,
              usageCount: used + 1,
              groupCap: cap,
              newBalance: { total: balance.total, purchased: balance.purchased, free: balance.free },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        // Over group cap — fall through to charge credits
      } else {
        // No group unlock — collaborators can't perform these actions without one
        return new Response(
          JSON.stringify({ error: 'Group unlock required for collaborator actions', action }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── Tier-aware free cap check (owner only) ──
    // Look up user tier and compute the correct free cap
    let freeCap: number | undefined;
    if (!isCollaborator && tripId && GROUP_CAP_ACTIONS.includes(action)) {
      const { data: tierData } = await supabaseAdmin
        .from('user_tiers')
        .select('tier')
        .eq('user_id', user.id)
        .maybeSingle();
      const userTier = tierData?.tier || 'free';
      const isClubMember = ['voyager', 'explorer', 'adventurer'].includes(userTier);

      let caps = TIER_CAPS[userTier] || TIER_CAPS.free;

      // For free/flex, scale with trip length
      if (!isClubMember) {
        const { data: tripInfo } = await supabaseAdmin
          .from('trips')
          .select('unlocked_day_count')
          .eq('id', tripId)
          .maybeSingle();
        const days = tripInfo?.unlocked_day_count || 0;
        if (days > 0) {
          caps = getScaledCaps(days);
        }
      }

      freeCap = caps[action];
    }
    if (!isCollaborator && freeCap !== undefined && tripId) {
      const { data: usageRow } = await supabaseAdmin
        .from('trip_action_usage')
        .select('usage_count')
        .eq('user_id', user.id)
        .eq('trip_id', tripId)
        .eq('action_type', action)
        .maybeSingle();

      const currentUsage = usageRow?.usage_count ?? 0;

      if (currentUsage < freeCap) {
        await supabaseAdmin
          .from('trip_action_usage')
          .upsert({
            user_id: user.id,
            trip_id: tripId,
            action_type: action,
            usage_count: currentUsage + 1,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,trip_id,action_type' });

        const { error: freeCapLedgerErr } = await supabaseAdmin
          .from('credit_ledger')
          .insert({
            user_id: user.id,
            transaction_type: 'spend',
            credits_delta: 0,
            is_free_credit: true,
            action_type: action,
            trip_id: tripId,
            activity_id: null,
            notes: `${action.replace(/_/g, ' ')} - free (${currentUsage + 1}/${freeCap})`,
            metadata: { ...metadata, day_index: dayIndex, free_cap_used: true, usage: currentUsage + 1, cap: freeCap, activityId: activityId || null },
          });
        if (freeCapLedgerErr) console.error('[spend-credits] Free cap ledger insert failed:', freeCapLedgerErr);

        const balance = await syncBalanceCache(supabaseAdmin, user.id);

        return new Response(
          JSON.stringify({
            success: true,
            spent: 0,
            action,
            freeCapUsed: true,
            usageCount: currentUsage + 1,
            freeCap,
            newBalance: { total: balance.total, purchased: balance.purchased, free: balance.free },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Over cap — increment and proceed to charge
      await supabaseAdmin
        .from('trip_action_usage')
        .upsert({
          user_id: user.id,
          trip_id: tripId,
          action_type: action,
          usage_count: currentUsage + 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id,trip_id,action_type' });
    }

    // ── REFUND handler ──
    // Reverses a previous credit spend. Called when Smart Finish enrichment fails.
    // Adds credits back by creating a new credit_purchases row (immediate, no expiry).
    if (action === 'REFUND') {
      const REFUNDABLE_COSTS: Record<string, number> = {
        SMART_FINISH: 50,
        smart_finish: 50,
        UNLOCK_DAY: 60,
        unlock_day: 60,
        HOTEL_OPTIMIZATION: 100,
        hotel_optimization: 100,
      };

      const originalAction = metadata?.originalAction as string | undefined;
      const pendingChargeId = metadata?.pendingChargeId as string | undefined;
      // Support dynamic refund amounts (e.g. trip_generation) via creditsAmount param
      const fixedRefund = originalAction ? (REFUNDABLE_COSTS[originalAction] ?? 0) : 0;
      const dynamicRefund = (typeof creditsAmount === 'number' && creditsAmount > 0) ? creditsAmount : 0;
      const refundAmount = dynamicRefund || fixedRefund;

      if (refundAmount <= 0) {
        console.error('[spend-credits] REFUND: unknown or zero refund amount for action:', originalAction);
        return new Response(
          JSON.stringify({ error: 'No refund amount recognized for originalAction', originalAction }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ── Idempotency check: prevent double refunds for the same pending charge ──
      if (pendingChargeId) {
        const { data: existingRefund } = await supabaseAdmin
          .from('credit_ledger')
          .select('id')
          .eq('user_id', user.id)
          .eq('transaction_type', 'refund')
          .contains('metadata', { pendingChargeId })
          .limit(1);

        if (existingRefund && existingRefund.length > 0) {
          console.log(`[spend-credits] REFUND: Idempotent hit — refund already issued for pendingChargeId ${pendingChargeId}`);
          const balance = await syncBalanceCache(supabaseAdmin, user.id);
          return new Response(
            JSON.stringify({
              success: true,
              refunded: refundAmount,
              action: 'REFUND',
              idempotent: true,
              newBalance: { total: balance.total, purchased: balance.purchased, free: balance.free },
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Add credits back via a new credit_purchases row (simplest safe approach — no expiry)
      const { error: purchaseErr } = await supabaseAdmin
        .from('credit_purchases')
        .insert({
          user_id: user.id,
          amount: refundAmount,
          remaining: refundAmount,
          credit_type: 'refund',
          source: 'refund',
          expires_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (purchaseErr) {
        console.error('[spend-credits] REFUND: failed to create credit_purchases row:', purchaseErr);
        return new Response(
          JSON.stringify({ error: 'Refund failed — could not restore credits' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Log the refund in the credit ledger for audit trail
      await supabaseAdmin.from('credit_ledger').insert({
        user_id: user.id,
        transaction_type: 'refund',
        credits_delta: refundAmount,
        is_free_credit: false,
        action_type: 'refund',
        trip_id: tripId || null,
        activity_id: null,
        notes: `Refund for failed ${originalAction} — +${refundAmount} credits restored`,
        metadata: {
          reason: metadata?.reason || 'enrichment_failed',
          originalAction,
          tripId: tripId || null,
          pendingChargeId: pendingChargeId || null,
        },
      });

      // Atomically mark the pending charge as refunded
      if (pendingChargeId) {
        const { error: pcRefundErr } = await supabaseAdmin
          .from('pending_credit_charges')
          .update({
            status: 'refunded',
            resolved_at: new Date().toISOString(),
            resolution_note: `Refunded via spend-credits REFUND path`,
          })
          .eq('id', pendingChargeId);

        if (pcRefundErr) {
          console.error(`[spend-credits] REFUND: Failed to mark pending charge ${pendingChargeId} as refunded:`, pcRefundErr);
        }
      }

      // Sync the balance cache so the UI immediately reflects the restored credits
      const balance = await syncBalanceCache(supabaseAdmin, user.id);

      console.log(`[spend-credits] REFUND: +${refundAmount} credits restored for user ${user.id} (originalAction: ${originalAction})`);

      return new Response(
        JSON.stringify({
          success: true,
          refunded: refundAmount,
          action: 'REFUND',
          newBalance: { total: balance.total, purchased: balance.purchased, free: balance.free },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Determine cost ──
    let cost: number;
    const isVariable = VARIABLE_COST_ACTIONS.includes(action);

    if (isVariable) {
      if (!creditsAmount || creditsAmount <= 0) {
        return new Response(
          JSON.stringify({ error: 'creditsAmount required for variable-cost actions' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (action === 'hotel_search') {
        const cityCount = (metadata?.cityCount as number) || 1;
        const expected = cityCount * HOTEL_SEARCH_PER_CITY;
        if (creditsAmount !== expected) {
          console.warn(`[spend-credits] Hotel search mismatch: got ${creditsAmount}, expected ${expected}`);
        }
      }
      if (action === 'trip_generation') {
        const days = (metadata?.days as number) || 1;
        const minCost = days * BASE_RATE_PER_DAY;
        if (creditsAmount < minCost * 0.9) {
          return new Response(
            JSON.stringify({ error: 'Trip cost too low for given parameters' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      cost = creditsAmount;
    } else if (action === 'route_optimization') {
      // Sliding discount based on per-trip optimization count + tier
      let optCount = 0;
      if (tripId) {
        const { data: optUsage } = await supabaseAdmin
          .from('trip_action_usage')
          .select('usage_count')
          .eq('user_id', user.id)
          .eq('trip_id', tripId)
          .eq('action_type', 'route_optimization')
          .maybeSingle();
        optCount = optUsage?.usage_count ?? 0;
      }

      // Check user tier for Club discount
      const { data: tierRow } = await supabaseAdmin
        .from('user_tiers')
        .select('tier')
        .eq('user_id', user.id)
        .maybeSingle();
      const uTier = tierRow?.tier || 'free';
      const isClubMember = ['voyager', 'explorer', 'adventurer'].includes(uTier);
      const schedule = isClubMember ? ROUTE_OPT_CLUB_SCHEDULE : ROUTE_OPT_STANDARD_SCHEDULE;
      const floor = schedule[schedule.length - 1];
      cost = optCount >= schedule.length ? floor : schedule[optCount];

      console.log(`[spend-credits] route_optimization: tier=${uTier}, optCount=${optCount}, cost=${cost}`);

      // Increment usage count after cost calculation
      if (tripId) {
        await supabaseAdmin
          .from('trip_action_usage')
          .upsert({
            user_id: user.id,
            trip_id: tripId,
            action_type: 'route_optimization',
            usage_count: optCount + 1,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,trip_id,action_type' });
      }
    } else if (action in FIXED_COSTS) {
      cost = FIXED_COSTS[action];
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action', validActions: [...Object.keys(FIXED_COSTS), ...VARIABLE_COST_ACTIONS] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Idempotency check: skip duplicate charges ──
    const idempotencyKey = metadata?.idempotencyKey as string | undefined;
    if (idempotencyKey && tripId) {
      const { data: existing } = await supabaseAdmin
        .from('credit_ledger')
        .select('id, credits_delta')
        .eq('user_id', user.id)
        .eq('action_type', action)
        .eq('trip_id', tripId)
        .contains('metadata', { idempotencyKey })
        .limit(1);
      if (existing && existing.length > 0) {
        console.log('[spend-credits] Idempotent hit — returning cached result for key:', idempotencyKey);
        const balance = await syncBalanceCache(supabaseAdmin, user.id);
        return new Response(
          JSON.stringify({
            success: true,
            spent: Math.abs(existing[0].credits_delta),
            action,
            idempotent: true,
            newBalance: { total: balance.total, purchased: balance.purchased, free: balance.free },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── FIFO deduction with write-ahead ledger ──
    let deductResult;
    try {
      deductResult = await deductFIFO(supabaseAdmin, user.id, cost);
    } catch (err: unknown) {
      const error = err as Error & { code?: string; required?: number; available?: number };
      if (error.code === 'INSUFFICIENT_CREDITS') {
        // Return 200 so supabase.functions.invoke puts response in `data` (not `error`)
        // Frontend checks data.error === 'Insufficient credits' to trigger the modal
        return new Response(
          JSON.stringify({
            error: 'Insufficient credits',
            required: error.required,
            available: error.available,
            action,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw err;
    }

    // ── Ledger entry (write-ahead: BEFORE balance sync) ──
    const { error: paidLedgerErr } = await supabaseAdmin
      .from('credit_ledger')
      .insert({
        user_id: user.id,
        transaction_type: 'spend',
        credits_delta: -deductResult.deducted,
        is_free_credit: false,
        action_type: action,
        trip_id: tripId || null,
        activity_id: null,
        notes: `${action.replace(/_/g, ' ')} - ${deductResult.deducted} credits`,
        metadata: {
          ...metadata,
          day_index: dayIndex,
          is_variable_cost: isVariable,
          original_cost: cost,
          fifo_deductions: deductResult.purchases,
          activityId: activityId || null,
        },
      });
    if (paidLedgerErr) {
      console.error('[spend-credits] CRITICAL: Ledger insert failed after FIFO deduction.', paidLedgerErr);
      // FIFO deduction already committed atomically via RPC.
      // Log the inconsistency but don't attempt a broken rollback — 
      // the balance sync below will reconcile from credit_purchases source of truth.
      // A separate reconciliation job can detect ledger gaps.
    }

    // ── Cost tracking for hotel_search (for Unit Economics dashboard) ──
    if (action === 'hotel_search' && tripId) {
      const { error: costErr } = await supabaseAdmin
        .from('trip_cost_tracking')
        .insert({
          user_id: user.id,
          trip_id: tripId,
          action_type: 'hotel_search',
          cost_category: 'ai_generation',
          estimated_cost_usd: 0.03,
          input_tokens: 0,
          output_tokens: 0,
          model: 'credit-gated',
        });
      if (costErr) console.error('[spend-credits] Cost tracking insert failed:', costErr);
    }

    // ── Sync balance cache AFTER successful deduction + ledger ──
    const balance = await syncBalanceCache(supabaseAdmin, user.id);

    return new Response(
      JSON.stringify({
        success: true,
        spent: deductResult.deducted,
        action,
        newBalance: { total: balance.total, purchased: balance.purchased, free: balance.free },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[spend-credits] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
