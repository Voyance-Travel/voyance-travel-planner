/**
 * Spend Group Credits — Deducts from the shared group budget pool.
 * Checks shared free caps (10/5/20/5) first, then deducts from pool.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Shared free caps for all group budget collaborators
const GROUP_FREE_CAPS: Record<string, number> = {
  swap_activity: 10,
  regenerate_day: 5,
  ai_message: 20,
  restaurant_rec: 5,
};

// Per-action credit costs
const ACTION_COSTS: Record<string, number> = {
  swap_activity: 5,
  regenerate_day: 10,
  ai_message: 5,
  restaurant_rec: 5,
  transport_mode_change: 5,
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

    const { action, tripId, activityId, dayIndex, metadata } = await req.json();

    if (!action || !tripId) {
      return new Response(JSON.stringify({ error: 'action and tripId required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get group budget
    const { data: budget } = await supabaseAdmin
      .from('group_budgets')
      .select('id, remaining_credits, owner_id')
      .eq('trip_id', tripId)
      .maybeSingle();

    if (!budget) {
      return new Response(JSON.stringify({ error: 'No group budget for this trip' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check shared free cap (aggregated across all users on this trip)
    const freeCap = GROUP_FREE_CAPS[action];
    if (freeCap !== undefined) {
      // Sum all usage for this action on this trip (all collaborators combined)
      const { data: usageRows } = await supabaseAdmin
        .from('group_budget_transactions')
        .select('credits_spent, was_free')
        .eq('group_budget_id', budget.id)
        .eq('action_type', action);

      const freeUsed = (usageRows || []).filter(r => r.was_free).length;

      if (freeUsed < freeCap) {
        // Still within free cap
        await supabaseAdmin.from('group_budget_transactions').insert({
          group_budget_id: budget.id,
          user_id: user.id,
          action_type: action,
          credits_spent: 0,
          was_free: true,
        });

        return new Response(JSON.stringify({
          success: true,
          spent: 0,
          action,
          freeCapUsed: true,
          usageCount: freeUsed + 1,
          freeCap,
          budgetRemaining: budget.remaining_credits,
        }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Beyond free cap — deduct from pool
    const cost = ACTION_COSTS[action];
    if (!cost) {
      return new Response(JSON.stringify({ error: `Unknown action: ${action}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (budget.remaining_credits < cost) {
      return new Response(JSON.stringify({
        error: 'GROUP_BUDGET_DEPLETED',
        required: cost,
        available: budget.remaining_credits,
        budgetId: budget.id,
      }), { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Deduct from pool
    const newRemaining = budget.remaining_credits - cost;
    await supabaseAdmin.from('group_budgets').update({
      remaining_credits: newRemaining,
      updated_at: new Date().toISOString(),
    }).eq('id', budget.id);

    // Log transaction
    await supabaseAdmin.from('group_budget_transactions').insert({
      group_budget_id: budget.id,
      user_id: user.id,
      action_type: action,
      credits_spent: cost,
      was_free: false,
    });

    return new Response(JSON.stringify({
      success: true,
      spent: cost,
      action,
      freeCapUsed: false,
      budgetRemaining: newRemaining,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err: unknown) {
    console.error('[spend-group-credits] Error:', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return new Response(JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
