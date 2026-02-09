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
  restaurant_rec: 5,
  ai_message: 5,
  hotel_optimization: 100,
  mystery_getaway: 15,
  mystery_logistics: 5,
  transport_mode_change: 5,
};

// Tier-based free action caps
const TIER_CAPS: Record<string, Record<string, number>> = {
  free:       { swap_activity: 3,  regenerate_day: 1, ai_message: 5,  restaurant_rec: 1 },
  flex:       { swap_activity: 3,  regenerate_day: 1, ai_message: 5,  restaurant_rec: 1 },
  voyager:    { swap_activity: 6,  regenerate_day: 2, ai_message: 10, restaurant_rec: 2 },
  explorer:   { swap_activity: 9,  regenerate_day: 3, ai_message: 15, restaurant_rec: 3 },
  adventurer: { swap_activity: 15, regenerate_day: 5, ai_message: 25, restaurant_rec: 5 },
};

// Trip length scaling for Free/Flex only
const FLEX_CAPS_BY_DAYS: Record<number, Record<string, number>> = {
  2:  { swap_activity: 3,  regenerate_day: 1, ai_message: 5,  restaurant_rec: 1 },
  4:  { swap_activity: 5,  regenerate_day: 2, ai_message: 10, restaurant_rec: 2 },
  6:  { swap_activity: 7,  regenerate_day: 3, ai_message: 15, restaurant_rec: 3 },
  8:  { swap_activity: 10, regenerate_day: 4, ai_message: 20, restaurant_rec: 4 },
};

function getScaledCaps(unlockedDays: number): Record<string, number> {
  if (unlockedDays >= 7) return FLEX_CAPS_BY_DAYS[8];
  if (unlockedDays >= 5) return FLEX_CAPS_BY_DAYS[6];
  if (unlockedDays >= 3) return FLEX_CAPS_BY_DAYS[4];
  return FLEX_CAPS_BY_DAYS[2];
}

// Variable-cost actions
const VARIABLE_COST_ACTIONS = ['trip_generation', 'hotel_search'];
const HOTEL_SEARCH_PER_CITY = 40;
const BASE_RATE_PER_DAY = 60;

// Actions eligible for group cap
const GROUP_CAP_ACTIONS = ['swap_activity', 'regenerate_day', 'ai_message', 'restaurant_rec'];

interface SpendRequest {
  action: string;
  tripId?: string;
  activityId?: string;
  dayIndex?: number;
  creditsAmount?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Deduct credits FIFO from credit_purchases.
 * Returns the total deducted or throws on insufficient credits.
 */
async function deductFIFO(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  cost: number
): Promise<{ deducted: number; purchases: Array<{ id: string; deducted: number }> }> {
  // Get all active credit rows, ordered by expiration (earliest first, NULL = never = last)
  const { data: rows, error } = await supabaseAdmin
    .from('credit_purchases')
    .select('id, remaining, expires_at, credit_type')
    .eq('user_id', userId)
    .gt('remaining', 0)
    .order('expires_at', { ascending: true, nullsFirst: false });

  if (error) throw new Error('Failed to fetch credit purchases');

  // Filter out expired rows
  const now = new Date();
  const activeRows = (rows || []).filter(r => !r.expires_at || new Date(r.expires_at) > now);

  const totalAvailable = activeRows.reduce((sum, r) => sum + r.remaining, 0);

  // Simple rule: must have full cost or BLOCKED
  if (totalAvailable < cost) {
    throw Object.assign(new Error('Insufficient credits'), {
      code: 'INSUFFICIENT_CREDITS',
      required: cost,
      available: totalAvailable,
    });
  }

  let remaining = cost;
  const deductions: Array<{ id: string; deducted: number }> = [];

  for (const row of activeRows) {
    if (remaining <= 0) break;
    const take = Math.min(row.remaining, remaining);
    deductions.push({ id: row.id, deducted: take });
    remaining -= take;
  }

  // Apply deductions
  for (const d of deductions) {
    const { error: updateError } = await supabaseAdmin
      .from('credit_purchases')
      .update({
        remaining: (activeRows.find(r => r.id === d.id)!.remaining) - d.deducted,
        updated_at: new Date().toISOString(),
      })
      .eq('id', d.id);

    if (updateError) {
      console.error('[spend-credits] Error updating purchase row:', updateError);
    }
  }

  return { deducted: cost, purchases: deductions };
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
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SpendRequest = await req.json();
    const { action, tripId, activityId, dayIndex, creditsAmount, metadata } = body;

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
          await supabaseAdmin
            .from('credit_ledger')
            .insert({
              user_id: user.id,
              transaction_type: 'spend',
              credits_delta: 0,
              is_free_credit: true,
              action_type: action,
              trip_id: tripId,
              activity_id: activityId || null,
              notes: `${action.replace(/_/g, ' ')} - group cap (${used + 1}/${cap})`,
              metadata: { ...metadata, day_index: dayIndex, group_cap_used: true },
            });

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

        await supabaseAdmin
          .from('credit_ledger')
          .insert({
            user_id: user.id,
            transaction_type: 'spend',
            credits_delta: 0,
            is_free_credit: true,
            action_type: action,
            trip_id: tripId,
            activity_id: activityId || null,
            notes: `${action.replace(/_/g, ' ')} - free (${currentUsage + 1}/${freeCap})`,
            metadata: { ...metadata, day_index: dayIndex, free_cap_used: true, usage: currentUsage + 1, cap: freeCap },
          });

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
    } else if (action in FIXED_COSTS) {
      cost = FIXED_COSTS[action];
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid action', validActions: [...Object.keys(FIXED_COSTS), ...VARIABLE_COST_ACTIONS] }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── FIFO deduction ──
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

    // ── Sync balance cache ──
    const balance = await syncBalanceCache(supabaseAdmin, user.id);

    // ── Ledger entry ──
    await supabaseAdmin
      .from('credit_ledger')
      .insert({
        user_id: user.id,
        transaction_type: 'spend',
        credits_delta: -deductResult.deducted,
        is_free_credit: false,
        action_type: action,
        trip_id: tripId || null,
        activity_id: activityId || null,
        notes: `${action.replace(/_/g, ' ')} - ${deductResult.deducted} credits`,
        metadata: {
          ...metadata,
          day_index: dayIndex,
          is_variable_cost: isVariable,
          original_cost: cost,
          fifo_deductions: deductResult.purchases,
        },
      });

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
