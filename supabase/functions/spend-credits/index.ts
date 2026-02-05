/**
 * Spend Credits Edge Function
 * Deducts credits for actions: unlock_day, swap_activity, regenerate_day, restaurant_rec, ai_message
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Credit costs - must match frontend config
const CREDIT_COSTS: Record<string, number> = {
  unlock_day: 150,
  swap_activity: 5,
  regenerate_day: 15,
  restaurant_rec: 10,
  ai_message: 2,
};

interface SpendRequest {
  action: keyof typeof CREDIT_COSTS;
  tripId?: string;
  activityId?: string;
  dayIndex?: number;
  metadata?: Record<string, unknown>;
}

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

    // Parse request
    const body: SpendRequest = await req.json();
    const { action, tripId, activityId, dayIndex, metadata } = body;

    // Validate action
    if (!action || !(action in CREDIT_COSTS)) {
      return new Response(
        JSON.stringify({ error: 'Invalid action', validActions: Object.keys(CREDIT_COSTS) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cost = CREDIT_COSTS[action];

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
      console.error('[spend-credits] Error fetching balance:', balanceError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch balance' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate available credits (purchased + non-expired free)
    const purchasedCredits = balance?.purchased_credits || 0;
    let freeCredits = balance?.free_credits || 0;
    
    // Check if free credits are expired
    const expiresAt = balance?.free_credits_expires_at;
    if (expiresAt && new Date(expiresAt) < new Date()) {
      freeCredits = 0;
    }

    const totalCredits = purchasedCredits + freeCredits;

    // Check if user can afford
    if (totalCredits < cost) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient credits',
          required: cost,
          available: totalCredits,
          action,
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct credits - use free credits first, then purchased
    let remainingCost = cost;
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

    // Update balance
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

    // Create ledger entry
    const { error: ledgerError } = await supabaseAdmin
      .from('credit_ledger')
      .insert({
        user_id: user.id,
        transaction_type: 'spend',
        credits_delta: -cost,
        is_free_credit: usedFreeCredits > 0 && usedPurchasedCredits === 0,
        action_type: action,
        trip_id: tripId || null,
        activity_id: activityId || null,
        notes: `${action.replace('_', ' ')} - ${cost} credits`,
        metadata: {
          ...metadata,
          day_index: dayIndex,
          used_free_credits: usedFreeCredits,
          used_purchased_credits: usedPurchasedCredits,
        },
      });

    if (ledgerError) {
      console.error('[spend-credits] Error creating ledger entry:', ledgerError);
      // Don't fail the request - balance was already updated
    }

    // Return success with new balance
    const newTotal = newPurchasedCredits + newFreeCredits;

    return new Response(
      JSON.stringify({
        success: true,
        spent: cost,
        action,
        newBalance: {
          total: newTotal,
          purchased: newPurchasedCredits,
          free: newFreeCredits,
        },
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
