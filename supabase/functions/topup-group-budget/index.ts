/**
 * Top-Up Group Budget — Owner deducts from personal balance to add credits to the group pool.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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

    const { tripId, credits } = await req.json();

    if (!tripId || !credits || credits <= 0) {
      return new Response(JSON.stringify({ error: 'Invalid tripId or credits amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify budget exists and user is owner
    const { data: budget } = await supabaseAdmin
      .from('group_budgets')
      .select('id, owner_id, remaining_credits')
      .eq('trip_id', tripId)
      .maybeSingle();

    if (!budget) {
      return new Response(JSON.stringify({ error: 'No group budget found for this trip' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    if (budget.owner_id !== user.id) {
      return new Response(JSON.stringify({ error: 'Only the trip owner can top up the budget' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check balance
    const now = new Date();
    // Atomic FIFO deduction via RPC (row-level locking prevents double-spend)
    const { data: deductResult, error: deductErr } = await supabaseAdmin.rpc('deduct_credits_fifo', {
      p_user_id: user.id,
      p_cost: credits,
    });

    if (deductErr) {
      const msg = deductErr.message || '';
      if (msg.includes('INSUFFICIENT_CREDITS')) {
        const match = msg.match(/available=(\d+)/);
        return new Response(JSON.stringify({
          error: 'Insufficient credits',
          code: 'INSUFFICIENT_CREDITS',
          required: credits,
          available: match ? parseInt(match[1], 10) : 0,
        }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      throw new Error(`deduct_credits_fifo failed: ${msg}`);
    }

    // Add to budget
    await supabaseAdmin.from('group_budgets').update({
      remaining_credits: budget.remaining_credits + credits,
      updated_at: now.toISOString(),
    }).eq('id', budget.id);

    // Log transaction
    await supabaseAdmin.from('group_budget_transactions').insert({
      group_budget_id: budget.id,
      user_id: user.id,
      action_type: 'topup',
      credits_spent: -credits, // negative = added
      was_free: false,
    });

    // Log to credit_ledger
    await supabaseAdmin.from('credit_ledger').insert({
      user_id: user.id,
      transaction_type: 'spend',
      credits_delta: -credits,
      is_free_credit: false,
      action_type: 'group_topup',
      trip_id: tripId,
      notes: `Group budget top-up — ${credits} credits`,
      metadata: { budget_id: budget.id },
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
      budgetRemaining: budget.remaining_credits + credits,
      newBalance: { total: purchased + free, purchased, free },
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: unknown) {
    console.error('[topup-group-budget] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
