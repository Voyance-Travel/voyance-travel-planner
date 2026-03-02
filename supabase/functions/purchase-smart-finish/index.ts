/**
 * Purchase Smart Finish — $6.99 one-time payment per trip
 * 
 * Creates a Stripe checkout session for the Smart Finish product.
 * Tied to a specific trip_id via metadata.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SMART_FINISH_PRICE_ID = "price_1SyZCrJytioXyqq9iDYMxJyN";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user?.email) throw new Error("Not authenticated");

    const { tripId } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // Verify trip exists and belongs to user
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, smart_finish_purchased, user_id")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");
    if (trip.user_id !== user.id) throw new Error("Not your trip");
    if (trip.smart_finish_purchased) {
      return new Response(JSON.stringify({ error: "already_purchased", message: "Smart Finish already purchased for this trip" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or reference existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    }

    const origin = req.headers.get("origin") || "https://voyance-travel-planner.lovable.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: SMART_FINISH_PRICE_ID, quantity: 1 }],
      mode: "payment",
      metadata: {
        trip_id: tripId,
        user_id: user.id,
        type: "smart_finish",
      },
      success_url: `${origin}/trip/${tripId}?smart_finish=success`,
      cancel_url: `${origin}/trip/${tripId}?smart_finish=cancelled`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[purchase-smart-finish] Error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
