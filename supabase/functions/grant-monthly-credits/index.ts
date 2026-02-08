/**
 * Grant Monthly Credits Edge Function
 * Grants 150 free credits monthly to ALL users (free + paid), expiring in 2 months.
 * Purchased credits never expire — only the monthly grant has expiration.
 * Called on user login to check eligibility (once per calendar month).
 *
 * CONVERSION FUNNEL:
 *   1. First trip: bypasses credits entirely (full enriched trip, one-time)
 *   2. Subsequent trips: Day 1 preview always free (AI-only, no enrichment)
 *   3. This grant: 150cr/mo lets users taste unlocking (1-2 days)
 *   4. User runs out → buys credit pack (conversion!)
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const MONTHLY_GRANT_AMOUNT = 150;
const EXPIRATION_MONTHS = 2;
const MAX_FREE_CREDITS = 300; // Cap to prevent excessive stacking

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Create client WITH auth header for proper JWT validation on Lovable Cloud
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

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current balance
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

    // Check if user already received credits this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const lastGrantAt = balance?.last_free_credit_at ? new Date(balance.last_free_credit_at) : null;
    
    if (lastGrantAt && lastGrantAt >= startOfMonth) {
      // Already received this month's grant
      return new Response(
        JSON.stringify({ 
          granted: false,
          reason: 'Already received monthly credits',
          nextEligible: new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString(),
          currentBalance: {
            free: balance?.free_credits || 0,
            purchased: balance?.purchased_credits || 0,
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate new free credits (capped at MAX_FREE_CREDITS)
    let currentFreeCredits = balance?.free_credits || 0;
    
    // Check if existing free credits are expired
    if (balance?.free_credits_expires_at) {
      const expiresAt = new Date(balance.free_credits_expires_at);
      if (expiresAt < now) {
        currentFreeCredits = 0; // Expired credits don't count
      }
    }
    
    const newFreeCredits = Math.min(currentFreeCredits + MONTHLY_GRANT_AMOUNT, MAX_FREE_CREDITS);
    const actualGranted = newFreeCredits - currentFreeCredits;
    
    // Calculate new expiration (2 months from now)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + EXPIRATION_MONTHS);

    // Update or insert balance
    const { error: updateError } = await supabaseAdmin
      .from('credit_balances')
      .upsert({
        user_id: user.id,
        free_credits: newFreeCredits,
        purchased_credits: balance?.purchased_credits || 0,
        free_credits_expires_at: expiresAt.toISOString(),
        last_free_credit_at: now.toISOString(),
        updated_at: now.toISOString(),
      }, { onConflict: 'user_id' });

    if (updateError) {
      console.error('[grant-monthly-credits] Error updating balance:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log in credit ledger
    if (actualGranted > 0) {
      await supabaseAdmin
        .from('credit_ledger')
        .insert({
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
        newBalance: {
          free: newFreeCredits,
          purchased: balance?.purchased_credits || 0,
          total: newFreeCredits + (balance?.purchased_credits || 0),
        },
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
