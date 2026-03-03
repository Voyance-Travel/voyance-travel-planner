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

    // Upsert usage record
    const { data: existing } = await supabaseClient
      .from('user_usage')
      .select('id, count')
      .eq('user_id', user.id)
      .eq('metric_key', metric_key)
      .eq('period', currentPeriod)
      .single();

    let newCount: number;

    if (existing) {
      newCount = existing.count + amount;
      await supabaseClient
        .from('user_usage')
        .update({ count: newCount, updated_at: new Date().toISOString() })
        .eq('id', existing.id);
    } else {
      newCount = amount;
      await supabaseClient
        .from('user_usage')
        .insert({
          user_id: user.id,
          metric_key,
          period: currentPeriod,
          count: newCount,
        });
    }

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
