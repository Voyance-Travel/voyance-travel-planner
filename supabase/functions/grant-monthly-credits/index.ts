/**
 * Grant Monthly Credits Edge Function
 * Grants 150 free credits monthly to ALL users, expiring in 2 months.
 * Now creates a credit_purchases row for FIFO tracking.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MONTHLY_GRANT_AMOUNT = 150;
const EXPIRATION_MONTHS = 2;
const MAX_FREE_CREDITS = 300;

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

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current balance record
    const { data: balance, error: balanceError } = await supabaseAdmin
      .from('credit_balances')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (balanceError) {
      console.error('[grant-monthly-credits] Error fetching balance:', balanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // C-CRED-6: atomically CLAIM this month's grant instead of check-then-act.
    // Two concurrent invocations used to both read a stale last_free_credit_at,
    // both pass the check, and both insert a 150-credit row (double grant).
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Ensure a balance row exists so the conditional UPDATE below can match it
    // (UPDATE no-ops on a missing row). ON CONFLICT DO NOTHING preserves any
    // existing last_free_credit_at.
    await supabaseAdmin
      .from('credit_balances')
      .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });

    // Flip last_free_credit_at to now ONLY if it is still null or < start-of-month.
    // Exactly one concurrent request matches a row; the loser matches zero rows.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from('credit_balances')
      .update({ last_free_credit_at: now.toISOString(), updated_at: now.toISOString() })
      .eq('user_id', user.id)
      .or(`last_free_credit_at.is.null,last_free_credit_at.lt.${startOfMonth.toISOString()}`)
      .select('user_id');

    if (claimErr) {
      console.error('[grant-monthly-credits] atomic claim failed:', claimErr);
      return new Response(
        JSON.stringify({ error: 'Failed to claim monthly grant' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!claimed || claimed.length === 0) {
      // Lost the race (or already granted this month).
      return new Response(
        JSON.stringify({
          granted: false,
          reason: 'Already received monthly credits',
          nextEligible: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
          currentBalance: { free: balance?.free_credits || 0, purchased: balance?.purchased_credits || 0 },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate current MONTHLY-GRANT-ONLY free credits from credit_purchases
    // Only count rows from actual monthly grants toward the cap.
    // Bonus credits (welcome, quiz, referral) should NOT reduce the monthly grant.
    const { data: freeRows } = await supabaseAdmin
      .from('credit_purchases')
      .select('remaining, expires_at')
      .eq('user_id', user.id)
      .eq('credit_type', 'free_monthly')
      .eq('source', 'monthly_grant')
      .gt('remaining', 0);

    let currentFreeCredits = 0;
    for (const row of freeRows || []) {
      if (row.expires_at && new Date(row.expires_at) < now) continue;
      currentFreeCredits += row.remaining;
    }

    const actualGranted = Math.min(MONTHLY_GRANT_AMOUNT, MAX_FREE_CREDITS - currentFreeCredits);
    
    if (actualGranted <= 0) {
      // Update last_free_credit_at to prevent re-checking
      await supabaseAdmin.from('credit_balances').upsert({
        user_id: user.id,
        last_free_credit_at: now.toISOString(),
        purchased_credits: balance?.purchased_credits || 0,
        free_credits: currentFreeCredits,
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });

      return new Response(
        JSON.stringify({ granted: false, reason: 'At free credit cap', currentBalance: { free: currentFreeCredits, purchased: balance?.purchased_credits || 0 } }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate expiration
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + EXPIRATION_MONTHS);

    // Create credit_purchases row for FIFO tracking
    await supabaseAdmin.from('credit_purchases').insert({
      user_id: user.id,
      credit_type: 'free_monthly',
      amount: actualGranted,
      remaining: actualGranted,
      expires_at: expiresAt.toISOString(),
      source: 'monthly_grant',
    });

    // Update balance cache
    const newFreeCredits = currentFreeCredits + actualGranted;
    await supabaseAdmin.from('credit_balances').upsert({
      user_id: user.id,
      free_credits: newFreeCredits,
      purchased_credits: balance?.purchased_credits || 0,
      free_credits_expires_at: expiresAt.toISOString(),
      last_free_credit_at: now.toISOString(),
      updated_at: now.toISOString(),
    }, { onConflict: 'user_id' });

    // Ledger entry
    if (actualGranted > 0) {
      await supabaseAdmin.from('credit_ledger').insert({
        user_id: user.id,
        transaction_type: 'credit',
        credits_delta: actualGranted,
        is_free_credit: true,
        action_type: 'monthly_grant',
        notes: `Monthly free credits - ${actualGranted} credits`,
      });
    }

    return new Response(
      JSON.stringify({
        granted: true,
        amount: actualGranted,
        newBalance: { free: newFreeCredits, purchased: balance?.purchased_credits || 0, total: newFreeCredits + (balance?.purchased_credits || 0) },
        expiresAt: expiresAt.toISOString(),
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[grant-monthly-credits] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
