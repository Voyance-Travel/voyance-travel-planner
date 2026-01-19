import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONSUME-CREDITS] ${step}${detailsStr}`);
};

// Credit costs in cents - must match src/config/pricing.ts
const CREDIT_COSTS: Record<string, number> = {
  build_day: 399,          // $3.99
  build_full_trip: 999,    // $9.99
  route_optimize: 199,     // $1.99
  group_budget_setup: 299, // $2.99
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const { action_key, trip_id } = await req.json();
    if (!action_key) throw new Error("action_key is required");
    
    const cost = CREDIT_COSTS[action_key];
    if (!cost) throw new Error(`Unknown action_key: ${action_key}`);
    
    logStep("Action requested", { action_key, cost, trip_id });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Get current balance
    const { data: credits, error: creditsError } = await supabaseClient
      .from('user_credits')
      .select('balance_cents')
      .eq('user_id', user.id)
      .single();

    const currentBalance = credits?.balance_cents || 0;
    logStep("Current balance", { currentBalance });

    // Check if user can afford
    if (currentBalance < cost) {
      logStep("Insufficient credits", { required: cost, balance: currentBalance });
      return new Response(JSON.stringify({
        success: false,
        error: "insufficient_credits",
        required: cost,
        balance: currentBalance,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 402, // Payment Required
      });
    }

    // Deduct credits atomically
    const newBalance = currentBalance - cost;
    
    const { error: updateError } = await supabaseClient
      .from('user_credits')
      .update({ 
        balance_cents: newBalance, 
        updated_at: new Date().toISOString() 
      })
      .eq('user_id', user.id);

    if (updateError) {
      throw new Error(`Failed to deduct credits: ${updateError.message}`);
    }

    // Record the transaction in audit trail
    const { error: txError } = await supabaseClient
      .from('credit_transactions')
      .insert({
        user_id: user.id,
        type: 'spend',
        amount_cents: -cost,
        action_key,
        metadata: trip_id ? { trip_id } : null,
      });

    if (txError) {
      logStep("Warning: Failed to record transaction", { error: txError.message });
      // Don't fail the request, the deduction already happened
    }

    logStep("Credits consumed successfully", { 
      action_key, 
      amount_spent: cost, 
      new_balance: newBalance 
    });

    return new Response(JSON.stringify({
      success: true,
      action_key,
      amount_spent: cost,
      new_balance: newBalance,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
