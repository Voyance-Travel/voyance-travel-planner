/**
 * Claim Referral Edge Function (C-REFERRAL-1)
 *
 * Called by a newly-signed-up REFEREE who arrived via a `?ref=<code>` link.
 * Attributes the referral and grants 150 credits to BOTH the referee and the
 * referrer. Pays out the promise the ReferralShareModal makes.
 *
 * Security / anti-abuse (this MINTS credits — treated with the same care as the
 * Stripe webhook):
 *   1. Authenticated referee only (JWT).
 *   2. Referee email MUST be verified (email_confirmed_at) — blocks fake-email
 *      farming; matches the existing 'welcome' bonus gate.
 *   3. Self-referral blocked (referrer_id !== referee_id), enforced again by a
 *      DB CHECK constraint.
 *   4. One-per-referee: the `referrals` table has UNIQUE(referee_id); the insert
 *      uses ignoreDuplicates so repeat calls are idempotent and a referee can
 *      never collect more than one referral bonus.
 *   5. The grant runs ONLY when this call is the one that created the referrals
 *      row — so the dual payout happens exactly once.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const REFERRAL_CREDITS = 150;
const EXPIRATION_MONTHS = 2;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Grant REFERRAL_CREDITS free credits to one user: bump credit_balances, add a
 * FIFO credit_purchases row (what get-entitlements reads), and an audit ledger
 * entry. Mirrors grant-bonus-credits.
 */
// deno-lint-ignore no-explicit-any
async function grantReferralCredits(admin: any, userId: string, role: 'referrer' | 'referee') {
  const now = new Date();
  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + EXPIRATION_MONTHS);

  const { data: balance } = await admin
    .from('credit_balances')
    .select('free_credits, purchased_credits, free_credits_expires_at')
    .eq('user_id', userId)
    .maybeSingle();

  const currentFree = balance?.free_credits || 0;
  const currentPurchased = balance?.purchased_credits || 0;
  let newExpiresAt = expiresAt;
  if (balance?.free_credits_expires_at) {
    const existing = new Date(balance.free_credits_expires_at);
    if (existing > expiresAt) newExpiresAt = existing;
  }

  await admin.from('credit_balances').upsert({
    user_id: userId,
    free_credits: currentFree + REFERRAL_CREDITS,
    purchased_credits: currentPurchased,
    free_credits_expires_at: newExpiresAt.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'user_id' });

  await admin.from('credit_purchases').insert({
    user_id: userId,
    credit_type: 'referral_bonus',
    amount: REFERRAL_CREDITS,
    remaining: REFERRAL_CREDITS,
    expires_at: expiresAt.toISOString(),
    source: `referral_${role}`,
  });

  await admin.from('credit_ledger').insert({
    user_id: userId,
    transaction_type: 'credit',
    credits_delta: REFERRAL_CREDITS,
    is_free_credit: true,
    action_type: 'referral_bonus',
    notes: role === 'referrer'
      ? 'Referral bonus — a friend you invited joined Voyance'
      : 'Referral bonus — welcome! You joined via a friend\'s invite',
  });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing authorization header' }, 401);
    const token = authHeader.replace('Bearer ', '');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const code = typeof body?.code === 'string' ? body.code.trim() : '';
    if (!code) return json({ granted: false, reason: 'NO_CODE' });

    const admin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // (2) Referee email must be verified.
    const { data: refereeAuth, error: refereeErr } = await admin.auth.admin.getUserById(user.id);
    if (refereeErr || !refereeAuth?.user?.email_confirmed_at) {
      return json({ granted: false, reason: 'EMAIL_NOT_VERIFIED' }, 403);
    }

    // Resolve the code → referrer.
    const { data: codeRow } = await admin
      .from('referral_codes')
      .select('user_id')
      .eq('code', code)
      .maybeSingle();
    if (!codeRow?.user_id) return json({ granted: false, reason: 'INVALID_CODE' });

    const referrerId = codeRow.user_id as string;

    // (3) Self-referral block.
    if (referrerId === user.id) return json({ granted: false, reason: 'SELF_REFERRAL' });

    // (4) Idempotent one-per-referee insert. ignoreDuplicates → a conflicting
    // referee_id returns no row, so we know NOT to grant again.
    const { data: inserted, error: insertErr } = await admin
      .from('referrals')
      .upsert(
        { referrer_id: referrerId, referee_id: user.id, code },
        { onConflict: 'referee_id', ignoreDuplicates: true },
      )
      .select('id')
      .maybeSingle();

    if (insertErr) {
      console.error('[claim-referral] insert error:', insertErr.message);
      return json({ error: 'Failed to record referral' }, 500);
    }
    if (!inserted) {
      // Referee was already referred (by this or another code) — never double-pay.
      return json({ granted: false, reason: 'ALREADY_REFERRED' });
    }

    // (5) This call created the row → grant both sides exactly once.
    await grantReferralCredits(admin, user.id, 'referee');
    await grantReferralCredits(admin, referrerId, 'referrer');

    await admin
      .from('referrals')
      .update({ referrer_credited: true, referee_credited: true })
      .eq('id', inserted.id);

    console.log(`[claim-referral] granted ${REFERRAL_CREDITS} each: referrer=${referrerId} referee=${user.id}`);
    return json({
      granted: true,
      credits: REFERRAL_CREDITS,
      message: `You and your friend each earned ${REFERRAL_CREDITS} credits!`,
    });
  } catch (error) {
    console.error('[claim-referral] unexpected error:', error instanceof Error ? error.message : error);
    return json({ error: 'Internal server error' }, 500);
  }
});
