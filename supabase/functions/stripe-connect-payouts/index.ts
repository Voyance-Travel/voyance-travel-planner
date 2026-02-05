/**
 * Stripe Connect Payouts Edge Function
 * 
 * Manages payout schedules, retrieves balance/transfer history,
 * and handles delayed payouts for the "pay after travel" model.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  console.log(`[STRIPE-PAYOUTS] ${step}`, details ? JSON.stringify(details) : '');
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

    const token = authHeader.replace("Bearer ", "");
    
    // Create client WITH auth header for proper JWT validation on Lovable Cloud
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Authentication failed");

    const user = userData.user;
    log("User authenticated", { userId: user.id });

    const { action, ...params } = await req.json();
    log("Action requested", { action });

    // Get agent's Connect account
    const { data: preferences } = await supabaseClient
      .from("user_preferences")
      .select("stripe_connect_account_id, stripe_payout_schedule")
      .eq("user_id", user.id)
      .single();

    const accountId = preferences?.stripe_connect_account_id;
    
    if (!accountId && action !== "get_payout_settings") {
      throw new Error("No Connect account found. Complete onboarding first.");
    }

    switch (action) {
      // ========================================
      // Get current payout settings
      // ========================================
      case "get_payout_settings": {
        if (!accountId) {
          return new Response(JSON.stringify({
            success: true,
            schedule: preferences?.stripe_payout_schedule || "manual",
            has_account: false,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const account = await stripe.accounts.retrieve(accountId);
        
        return new Response(JSON.stringify({
          success: true,
          has_account: true,
          schedule: account.settings?.payouts?.schedule?.interval || "manual",
          delay_days: account.settings?.payouts?.schedule?.delay_days,
          debit_negative_balances: account.settings?.payouts?.debit_negative_balances,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Update payout schedule
      // ========================================
      case "update_payout_schedule": {
        const { schedule, delay_days } = params;
        
        // Validate schedule
        const validSchedules = ["manual", "daily", "weekly", "monthly"];
        if (!validSchedules.includes(schedule)) {
          throw new Error(`Invalid schedule. Must be one of: ${validSchedules.join(", ")}`);
        }

        log("Updating payout schedule", { schedule, delay_days });

        // Update Stripe account settings
        const updateParams: Stripe.AccountUpdateParams = {
          settings: {
            payouts: {
              schedule: {
                interval: schedule as "manual" | "daily" | "weekly" | "monthly",
              },
            },
          },
        };

        // Add delay for "pay after travel" model
        if (delay_days && schedule === "daily") {
          updateParams.settings!.payouts!.schedule!.delay_days = Math.min(delay_days, 14);
        }

        // Weekly/monthly need anchor settings
        if (schedule === "weekly") {
          updateParams.settings!.payouts!.schedule!.weekly_anchor = "monday";
        } else if (schedule === "monthly") {
          updateParams.settings!.payouts!.schedule!.monthly_anchor = 1;
        }

        await stripe.accounts.update(accountId, updateParams);

        // Save preference to DB
        await supabaseClient
          .from("user_preferences")
          .update({ stripe_payout_schedule: schedule })
          .eq("user_id", user.id);

        return new Response(JSON.stringify({
          success: true,
          schedule,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Get account balance
      // ========================================
      case "get_balance": {
        const balance = await stripe.balance.retrieve({
          stripeAccount: accountId,
        });

        return new Response(JSON.stringify({
          success: true,
          available: balance.available,
          pending: balance.pending,
          instant_available: balance.instant_available,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Get payout history
      // ========================================
      case "get_payouts": {
        const { limit = 10, status } = params;

        const listParams: Stripe.PayoutListParams = {
          limit: Math.min(limit, 100),
        };
        if (status) listParams.status = status;

        const payouts = await stripe.payouts.list(listParams, {
          stripeAccount: accountId,
        });

        return new Response(JSON.stringify({
          success: true,
          payouts: payouts.data.map((p: Stripe.Payout) => ({
            id: p.id,
            amount: p.amount,
            currency: p.currency,
            status: p.status,
            arrival_date: p.arrival_date,
            created: p.created,
            method: p.method,
            type: p.type,
            description: p.description,
          })),
          has_more: payouts.has_more,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Get transfer history (from platform to agent)
      // ========================================
      case "get_transfers": {
        const { limit = 10 } = params;

        const transfers = await stripe.transfers.list({
          destination: accountId,
          limit: Math.min(limit, 100),
        });

        return new Response(JSON.stringify({
          success: true,
          transfers: transfers.data.map((t: Stripe.Transfer) => ({
            id: t.id,
            amount: t.amount,
            currency: t.currency,
            created: t.created,
            description: t.description,
            metadata: t.metadata,
            reversed: t.reversed,
          })),
          has_more: transfers.has_more,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Trigger manual payout (for manual schedule)
      // ========================================
      case "request_payout": {
        const { amount, currency = "usd" } = params;

        // Get available balance first
        const balance = await stripe.balance.retrieve({
          stripeAccount: accountId,
        });

        const availableBalance = balance.available.find((b: Stripe.Balance.Available) => b.currency === currency);
        if (!availableBalance || availableBalance.amount < amount) {
          throw new Error(`Insufficient balance. Available: ${availableBalance?.amount || 0} ${currency.toUpperCase()}`);
        }

        const payout = await stripe.payouts.create({
          amount,
          currency,
        }, {
          stripeAccount: accountId,
        });

        log("Payout created", { payoutId: payout.id, amount });

        return new Response(JSON.stringify({
          success: true,
          payout: {
            id: payout.id,
            amount: payout.amount,
            currency: payout.currency,
            status: payout.status,
            arrival_date: payout.arrival_date,
          },
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // ========================================
      // Get tax form (1099) status
      // ========================================
      case "get_tax_status": {
        // Retrieve the account to check tax info status
        const account = await stripe.accounts.retrieve(accountId);

        // Check for tax forms (only available in certain regions/thresholds)
        let taxForms: Stripe.Tax.Form[] = [];
        try {
          const forms = await stripe.tax.forms.list({
            limit: 5,
          }, {
            stripeAccount: accountId,
          });
          taxForms = forms.data;
        } catch (e) {
          // Tax forms API may not be available for all accounts
          log("Tax forms not available", e);
        }

        return new Response(JSON.stringify({
          success: true,
          tax_id_provided: !!account.individual?.ssn_last_4_provided || 
                          !!account.company?.tax_id_provided,
          tax_forms: taxForms.map(f => ({
            id: f.id,
            type: f.type,
            tax_year: f.filing_status,
            created: f.created,
          })),
          country: account.country,
          business_type: account.business_type,
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
