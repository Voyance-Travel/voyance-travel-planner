/**
 * Spend Credits Edge Function
 * Deducts credits for actions with per-trip free cap support.
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

// Per-trip free action caps
const FREE_CAPS: Record<string, number> = {
  swap_activity: 10,
  regenerate_day: 5,
  ai_message: 20,
  restaurant_rec: 5,
};

// Variable-cost actions (cost passed from client, validated server-side)
const VARIABLE_COST_ACTIONS = ['trip_generation', 'hotel_search'];

// Hotel search rate
const HOTEL_SEARCH_PER_CITY = 40;
const BASE_RATE_PER_DAY = 60;

interface SpendRequest {
  action: string;
  tripId?: string;
  activityId?: string;
  dayIndex?: number;
  creditsAmount?: number;
  metadata?: Record<string, unknown>;
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

    // ── Free cap check ──
    const freeCap = FREE_CAPS[action];
    if (freeCap !== undefined && tripId) {
      // Check current usage for this action on this trip
      const { data: usageRow } = await supabaseAdmin
        .from('trip_action_usage')
        .select('usage_count')
        .eq('user_id', user.id)
        .eq('trip_id', tripId)
        .eq('action_type', action)
        .maybeSingle();

      const currentUsage = usageRow?.usage_count ?? 0;

      if (currentUsage < freeCap) {
        // Still free — increment usage and return success with 0 cost
        await supabaseAdmin
          .from('trip_action_usage')
          .upsert({
            user_id: user.id,
            trip_id: tripId,
            action_type: action,
            usage_count: currentUsage + 1,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id,trip_id,action_type' });

        // Create a zero-cost ledger entry for tracking
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

        // Get current balance to return
        const { data: balance } = await supabaseAdmin
          .from('credit_balances')
          .select('purchased_credits, free_credits, free_credits_expires_at')
          .eq('user_id', user.id)
          .maybeSingle();

        const purchasedCredits = balance?.purchased_credits || 0;
        let freeCredits = balance?.free_credits || 0;
        if (balance?.free_credits_expires_at && new Date(balance.free_credits_expires_at) < new Date()) {
          freeCredits = 0;
        }

        return new Response(
          JSON.stringify({
            success: true,
            spent: 0,
            action,
            freeCapUsed: true,
            usageCount: currentUsage + 1,
            freeCap,
            newBalance: { total: purchasedCredits + freeCredits, purchased: purchasedCredits, free: freeCredits },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // At/over cap — increment usage count and proceed to charge credits
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

    // ── Get current balance ──
    const { data: balance, error: balanceError } = await supabaseAdmin
      .from('credit_balances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (balanceError) {
      console.error('[spend-credits] Error fetching balance:', balanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const purchasedCredits = balance?.purchased_credits || 0;
    let freeCredits = balance?.free_credits || 0;
    const expiresAt = balance?.free_credits_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      freeCredits = 0;
    }
    const totalCredits = purchasedCredits + freeCredits;

    // ── Round-up logic ──
    const canCoverHalf = totalCredits >= cost / 2;

    if (totalCredits < cost && !canCoverHalf) {
      return new Response(
        JSON.stringify({ error: 'Insufficient credits', required: cost, available: totalCredits, action }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const effectiveCost = totalCredits < cost ? totalCredits : cost;

    // Deduct: free credits first, then purchased
    let remainingCost = effectiveCost;
    let newFreeCredits = freeCredits;
    let newPurchasedCredits = purchasedCredits;
    let usedFreeCredits = 0;
    let usedPurchasedCredits = 0;

    if (freeCredits > 0) {
      const fromFree = Math.min(freeCredits, remainingCost);
      newFreeCredits = freeCredits - fromFree;
      remainingCost -= fromFree;
      usedFreeCredits = fromFree;
    }
    if (remainingCost > 0) {
      newPurchasedCredits = purchasedCredits - remainingCost;
      usedPurchasedCredits = remainingCost;
    }

    const { error: updateError } = await supabaseAdmin
      .from('credit_balances')
      .upsert({
        user_id: user.id,
        purchased_credits: newPurchasedCredits,
        free_credits: newFreeCredits,
        free_credits_expires_at: balance?.free_credits_expires_at || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('[spend-credits] Error updating balance:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const wasRoundedUp = effectiveCost < cost;

    // Create ledger entry
    const { error: ledgerError } = await supabaseAdmin
      .from('credit_ledger')
      .insert({
        user_id: user.id,
        transaction_type: 'spend',
        credits_delta: -effectiveCost,
        is_free_credit: usedFreeCredits > 0 && usedPurchasedCredits === 0,
        action_type: action,
        trip_id: tripId || null,
        activity_id: activityId || null,
        notes: `${action.replace(/_/g, ' ')} - ${effectiveCost} credits${wasRoundedUp ? ` (rounded up from ${totalCredits}/${cost})` : ''}`,
        metadata: {
          ...metadata,
          day_index: dayIndex,
          used_free_credits: usedFreeCredits,
          used_purchased_credits: usedPurchasedCredits,
          is_variable_cost: isVariable,
          original_cost: cost,
          rounded_up: wasRoundedUp,
        },
      });

    if (ledgerError) {
      console.error('[spend-credits] Error creating ledger entry:', ledgerError);
    }

    const newTotal = newPurchasedCredits + newFreeCredits;

    return new Response(
      JSON.stringify({
        success: true,
        spent: effectiveCost,
        action,
        roundedUp: wasRoundedUp,
        originalCost: wasRoundedUp ? cost : undefined,
        newBalance: { total: newTotal, purchased: newPurchasedCredits, free: newFreeCredits },
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
