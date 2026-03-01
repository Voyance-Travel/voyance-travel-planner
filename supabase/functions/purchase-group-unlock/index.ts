/**
 * Purchase Group Unlock — Deducts credits from owner's balance to create a group budget pool.
 * Validates balance, creates group_budgets row, logs to credit_ledger.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TIER_CONFIG: Record<string, { credits: number; maxTravelers: number; caps: Record<string, number> }> = {
  small:  { credits: 150, maxTravelers: 3, caps: { swap_activity: 15, regenerate_day: 8, ai_message: 30, restaurant_rec: 10, add_activity: 10 } },
  medium: { credits: 300, maxTravelers: 8, caps: { swap_activity: 25, regenerate_day: 12, ai_message: 50, restaurant_rec: 15, add_activity: 15 } },
  large:  { credits: 500, maxTravelers: 99, caps: { swap_activity: 50, regenerate_day: 20, ai_message: 100, restaurant_rec: 25, add_activity: 30 } },
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { tripId, tier } = await req.json();

    if (!tripId || !tier || !TIER_CONFIG[tier]) {
      return new Response(JSON.stringify({ error: 'Invalid tripId or tier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user owns this trip
    const { data: trip } = await supabaseAdmin.from('trips').select('user_id').eq('id', tripId).maybeSingle();
    if (!trip || trip.user_id !== user.id) {
      return new Response(JSON.stringify({ error: 'You must own this trip' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for existing budget
    const { data: existing } = await supabaseAdmin.from('group_budgets').select('id').eq('trip_id', tripId).maybeSingle();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Group budget already exists for this trip' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const config = TIER_CONFIG[tier];

    // Check balance via credit_purchases FIFO
    const now = new Date();
    const { data: rows } = await supabaseAdmin
      .from('credit_purchases')
      .select('id, remaining, expires_at, credit_type')
      .eq('user_id', user.id)
      .gt('remaining', 0)
      .order('expires_at', { ascending: true, nullsFirst: false });

    const activeRows = (rows || []).filter(r => !r.expires_at || new Date(r.expires_at) > now);
    const totalAvailable = activeRows.reduce((sum, r) => sum + r.remaining, 0);

    if (totalAvailable < config.credits) {
      return new Response(JSON.stringify({
        error: 'Insufficient credits',
        required: config.credits,
        available: totalAvailable,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deduct FIFO
    let remaining = config.credits;
    for (const row of activeRows) {
      if (remaining <= 0) break;
      const take = Math.min(row.remaining, remaining);
      await supabaseAdmin.from('credit_purchases').update({
        remaining: row.remaining - take,
        updated_at: now.toISOString(),
      }).eq('id', row.id);
      remaining -= take;
    }

    // Create group budget
    const { data: budget, error: budgetError } = await supabaseAdmin.from('group_budgets').insert({
      trip_id: tripId,
      owner_id: user.id,
      tier,
      initial_credits: config.credits,
      remaining_credits: config.credits,
    }).select('id').single();

    if (budgetError) throw budgetError;

    // Create group_unlocks row (used by spend-credits for collaborator free caps)
    const emptyUsage: Record<string, number> = {};
    for (const key of Object.keys(config.caps)) {
      emptyUsage[key] = 0;
    }
    const { error: unlockError } = await supabaseAdmin.from('group_unlocks').insert({
      trip_id: tripId,
      purchased_by: user.id,
      tier,
      caps: config.caps,
      usage: emptyUsage,
    });
    if (unlockError) {
      console.error('[purchase-group-unlock] Failed to create group_unlocks row:', unlockError);
      // Non-fatal — budget was already created
    }

    // Log to credit_ledger
    await supabaseAdmin.from('credit_ledger').insert({
      user_id: user.id,
      transaction_type: 'spend',
      credits_delta: -config.credits,
      is_free_credit: false,
      action_type: 'group_unlock_purchase',
      trip_id: tripId,
      notes: `Group unlock (${tier}) — ${config.credits} credits`,
      metadata: { tier, budget_id: budget.id },
    });

    // Sync balance cache
    const { data: balanceRows } = await supabaseAdmin
      .from('credit_purchases')
      .select('remaining, expires_at, credit_type')
      .eq('user_id', user.id)
      .gt('remaining', 0);

    let purchased = 0, free = 0;
    for (const r of balanceRows || []) {
      if (r.expires_at && new Date(r.expires_at) < now) continue;
      if (['free_monthly', 'signup_bonus', 'referral_bonus'].includes(r.credit_type)) {
        free += r.remaining;
      } else {
        purchased += r.remaining;
      }
    }

    await supabaseAdmin.from('credit_balances').upsert({
      user_id: user.id,
      purchased_credits: purchased,
      free_credits: free,
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' });

    return new Response(JSON.stringify({
      success: true,
      budgetId: budget.id,
      tier,
      credits: config.credits,
      newBalance: { total: purchased + free, purchased, free },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: unknown) {
    console.error('[purchase-group-unlock] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
