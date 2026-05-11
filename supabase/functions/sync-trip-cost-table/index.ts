// Sync activity_costs for a trip from cost_reference (table-driven).
// Thin wrapper over shared writeActivityCostsFromItinerary so legacy trips
// with empty activity_costs get backfilled on first view.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { writeActivityCostsFromItinerary } from "../_shared/write-activity-costs.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );

    // Validate the user via JWT
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const tripId = String(body?.tripId || "");
    if (!tripId) {
      return new Response(JSON.stringify({ error: "tripId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load trip + verify caller owns it (or is collaborator); RLS will enforce.
    const { data: trip, error: tripErr } = await supabase
      .from("trips")
      .select("id, user_id, destination, travelers, budget_tier, itinerary_data")
      .eq("id", tripId)
      .single();

    if (tripErr || !trip) {
      return new Response(JSON.stringify({ error: "trip not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const days = (trip as any)?.itinerary_data?.days || [];
    const result = await writeActivityCostsFromItinerary(supabase, tripId, days, {
      destination: String(body?.destination || trip.destination || ""),
      travelers: Number(body?.travelers || trip.travelers) || 1,
      budgetTier: body?.budgetTier || (trip as any).budget_tier || null,
    });

    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[sync-trip-cost-table] error", e);
    return new Response(JSON.stringify({ error: String((e as any)?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
