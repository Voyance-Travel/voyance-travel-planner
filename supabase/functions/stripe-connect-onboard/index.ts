/**
 * Stripe Connect Onboarding Edge Function
 * 
 * Creates Express connected accounts for agents and generates onboarding links.
 * Supports: account creation, onboarding links, status checks, dashboard links
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[STRIPE-CONNECT] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY not configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const user = userData.user;
    log("User authenticated", { userId: user.id, email: user.email });

    // Get request action
    const { action, return_url } = await req.json();
    log("Action requested", { action });

    // Get current agent settings
    const { data: preferences, error: prefError } = await supabaseClient
      .from("user_preferences")
      .select("stripe_connect_account_id, stripe_connect_status, agent_business_name, agent_business_email")
      .eq("user_id", user.id)
      .single();

    if (prefError && prefError.code !== "PGRST116") {
      log("Error fetching preferences", prefError);
    }

    const origin = req.headers.get("origin") || "https://voyance-travel-planner.lovable.app";

    switch (action) {
      // ========================================
      // Create new Connect Express account
      // ========================================
      case "create_account": {
        if (preferences?.stripe_connect_account_id) {
          throw new Error("Connect account already exists");
        }

        log("Creating Express account");

        const account = await stripe.accounts.create({
          type: "express",
          email: preferences?.agent_business_email || user.email,
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
          business_type: "individual",
          metadata: {
            user_id: user.id,
            platform: "voyance",
          },
        });

        log("Account created", { accountId: account.id });

        // Save to database
        const { error: updateError } = await supabaseClient
          .from("user_preferences")
          .upsert({
            user_id: user.id,
            stripe_connect_account_id: account.id,
            stripe_connect_status: "pending",
          }, { onConflict: "user_id" });

        if (updateError) {
          log("Error saving account ID", updateError);
          throw updateError;
        }

        // Generate onboarding link
        const accountLink = await stripe.accountLinks.create({
          account: account.id,
          refresh_url: `${origin}/agent/settings?stripe_refresh=true`,
          return_url: return_url || `${origin}/agent/settings?stripe_success=true`,
          type: "account_onboarding",
        });

        log("Onboarding link created");

        return new Response(JSON.stringify({
          success: true,
          account_id: account.id,
          onboarding_url: accountLink.url,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Get new onboarding link for existing account
      // ========================================
      case "get_onboarding_link": {
        const accountId = preferences?.stripe_connect_account_id;
        if (!accountId) {
          throw new Error("No Connect account found. Create one first.");
        }

        const accountLink = await stripe.accountLinks.create({
          account: accountId,
          refresh_url: `${origin}/agent/settings?stripe_refresh=true`,
          return_url: return_url || `${origin}/agent/settings?stripe_success=true`,
          type: "account_onboarding",
        });

        return new Response(JSON.stringify({
          success: true,
          onboarding_url: accountLink.url,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Check account status
      // ========================================
      case "check_status": {
        const accountId = preferences?.stripe_connect_account_id;
        if (!accountId) {
          return new Response(JSON.stringify({
            success: true,
            status: "not_started",
            onboarding_complete: false,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const account = await stripe.accounts.retrieve(accountId);
        
        const status = account.details_submitted 
          ? (account.charges_enabled && account.payouts_enabled ? "complete" : "restricted")
          : "pending";

        const onboardingComplete = account.details_submitted && 
          account.charges_enabled && 
          account.payouts_enabled;

        // Update database if status changed
        if (status !== preferences?.stripe_connect_status) {
          await supabaseClient
            .from("user_preferences")
            .update({
              stripe_connect_status: status,
              stripe_connect_onboarding_complete: onboardingComplete,
            })
            .eq("user_id", user.id);
        }

        return new Response(JSON.stringify({
          success: true,
          status,
          onboarding_complete: onboardingComplete,
          details_submitted: account.details_submitted,
          charges_enabled: account.charges_enabled,
          payouts_enabled: account.payouts_enabled,
          requirements: account.requirements,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Get Express Dashboard login link
      // ========================================
      case "get_dashboard_link": {
        const accountId = preferences?.stripe_connect_account_id;
        if (!accountId) {
          throw new Error("No Connect account found");
        }

        const loginLink = await stripe.accounts.createLoginLink(accountId);

        return new Response(JSON.stringify({
          success: true,
          dashboard_url: loginLink.url,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log("ERROR", { message });
    return new Response(JSON.stringify({ success: false, error: message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
