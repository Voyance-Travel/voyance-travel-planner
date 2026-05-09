import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CONSUME-USAGE] ${step}${detailsStr}`);
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

    const { metric_key, amount = 1 } = await req.json();
    if (!metric_key) throw new Error("metric_key is required");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const currentPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM

    // Atomic upsert+increment via RPC (prevents lost updates under concurrent calls)
    const { data: rpcCount, error: rpcError } = await supabaseClient.rpc('increment_user_usage', {
      p_user_id: user.id,
      p_metric_key: metric_key,
      p_period: currentPeriod,
      p_amount: amount,
    });
    if (rpcError) throw new Error(`increment_user_usage failed: ${rpcError.message}`);
    const newCount: number = typeof rpcCount === 'number' ? rpcCount : Number(rpcCount ?? amount);

    logStep("Usage consumed", { metric_key, amount, newCount });

    return new Response(JSON.stringify({ 
      success: true, 
      metric_key, 
      count: newCount,
      period: currentPeriod,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ success: false, error: "Usage processing failed", code: "USAGE_ERROR" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
