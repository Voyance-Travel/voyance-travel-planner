import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-EMBEDDED-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const { 
      priceId, 
      mode = "subscription", 
      returnPath = "/profile",
      // Credit purchase fields
      productId,
      credits,
      // Legacy day purchase fields (deprecated)
      days,
      packageTier,
    } = await req.json();
    logStep("Request body parsed", { priceId, mode, returnPath, credits, days, packageTier });

    if (!priceId) {
      throw new Error("priceId is required");
    }

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logStep("No valid authorization header");
      return new Response(JSON.stringify({ error: "No authorization header provided" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const token = authHeader.replace("Bearer ", "");
    
    // Create Supabase client with the user's token
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { 
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false } 
      }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user) {
      logStep("Invalid JWT token", { error: userError?.message });
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 401,
      });
    }

    const userId = userData.user.id;
    const email = userData.user.email;
    
    if (!email) {
      logStep("No user email");
      return new Response(JSON.stringify({ error: "User email not available" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    logStep("User authenticated", { userId, email });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    }

    const origin = req.headers.get("origin") || "https://voyance-travel-planner.lovable.app";

    // Build metadata based on purchase type
    const sessionMetadata: Record<string, string> = {
      user_id: userId,
    };

    // Credit purchase metadata (new system)
    if (credits && Number(credits) > 0) {
      sessionMetadata.type = "credit_purchase";
      sessionMetadata.credits = String(credits);
      sessionMetadata.price_id = priceId;
      if (productId) sessionMetadata.product_id = productId;
    }
    // Legacy day purchase metadata (deprecated, kept for existing purchases)
    else if (days && Number(days) > 0) {
      sessionMetadata.type = "day_purchase";
      sessionMetadata.days = String(days);
      sessionMetadata.price_id = priceId;
      if (productId) sessionMetadata.product_id = productId;
      if (packageTier) sessionMetadata.package_tier = packageTier;
    }

    // Create embedded checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: mode as "subscription" | "payment",
      ui_mode: "embedded",
      return_url: `${origin}${returnPath}?session_id={CHECKOUT_SESSION_ID}&payment=success`,
      metadata: sessionMetadata,
    });

    logStep("Embedded checkout session created", { sessionId: session.id });

    return new Response(JSON.stringify({ 
      clientSecret: session.client_secret,
      sessionId: session.id,
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
