/**
 * Generation Canary — Pipeline Health Check
 *
 * Creates a 2-day test trip, triggers generation, polls until complete or timeout,
 * logs the result, and cleans up. Invoke manually or on a cron schedule.
 *
 * POST /functions/v1/generation-canary
 * Body: {} (no params needed)
 *
 * Returns: { success: boolean, durationMs: number, error?: string }
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIMEOUT_MS = 180_000; // 3 minutes
const POLL_INTERVAL_MS = 5_000; // 5 seconds

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Use a deterministic canary user ID (service role bypasses auth)
  const CANARY_USER_ID = "00000000-0000-0000-0000-canary000001";
  let tripId: string | null = null;

  try {
    // 1. Create a minimal test trip
    const startDate = new Date();
    startDate.setDate(startDate.getDate() + 60);
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 1);

    const { data: trip, error: createError } = await supabase
      .from("trips")
      .insert({
        user_id: CANARY_USER_ID,
        name: `🐤 Canary Test — ${new Date().toISOString()}`,
        destination: "Lisbon, Portugal",
        destination_country: "Portugal",
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate.toISOString().split("T")[0],
        travelers: 1,
        trip_type: "vacation",
        budget_tier: "moderate",
        itinerary_status: "not_started",
        metadata: { is_canary: true },
      })
      .select("id")
      .single();

    if (createError || !trip) {
      throw new Error(`Failed to create canary trip: ${createError?.message}`);
    }
    tripId = trip.id;
    console.log(`[canary] Created trip ${tripId}`);

    // 2. Trigger generation
    const genUrl = `${supabaseUrl}/functions/v1/generate-itinerary`;
    const genRes = await fetch(genUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        action: "generate-trip",
        tripId,
        destination: "Lisbon, Portugal",
        destinationCountry: "Portugal",
        startDate: startDate.toISOString().split("T")[0],
        endDate: endDate.toISOString().split("T")[0],
        travelers: 1,
        tripType: "vacation",
        budgetTier: "moderate",
        creditsCharged: 0,
      }),
    });
    const genBody = await genRes.text();

    if (!genRes.ok) {
      throw new Error(`Generation invoke failed (${genRes.status}): ${genBody}`);
    }
    console.log(`[canary] Generation invoked — status ${genRes.status}`);

    // 3. Poll until ready, failed, or timeout
    let status = "generating";
    const deadline = Date.now() + TIMEOUT_MS;

    while (Date.now() < deadline && status === "generating") {
      await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

      const { data: polled } = await supabase
        .from("trips")
        .select("itinerary_status, itinerary_data")
        .eq("id", tripId)
        .single();

      status = polled?.itinerary_status || "generating";
      const dayCount = Array.isArray(polled?.itinerary_data?.days)
        ? polled.itinerary_data.days.length
        : 0;
      console.log(`[canary] Poll: status=${status}, days=${dayCount}`);

      if (status === "ready" || status === "failed") break;
    }

    const durationMs = Date.now() - startTime;
    const success = status === "ready";

    // 4. Log result
    await supabase.from("canary_runs").insert({
      trip_id: tripId,
      success,
      status,
      duration_ms: durationMs,
      error_message: success ? null : `Final status: ${status}`,
    }).then(() => {}, () => {
      // canary_runs table may not exist yet — that's fine
      console.log("[canary] canary_runs table not found, skipping log insert");
    });

    // 5. Clean up — delete the canary trip
    await supabase.from("trips").delete().eq("id", tripId);
    console.log(`[canary] Cleaned up trip ${tripId}`);

    return new Response(
      JSON.stringify({ success, status, durationMs }),
      {
        status: success ? 200 : 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[canary] FAILED:`, message);

    // Attempt cleanup
    if (tripId) {
      await supabase.from("trips").delete().eq("id", tripId).then(() => {}, () => {});
    }

    // Log failure
    await supabase.from("canary_runs").insert({
      trip_id: tripId,
      success: false,
      status: "error",
      duration_ms: durationMs,
      error_message: message,
    }).then(() => {}, () => {});

    return new Response(
      JSON.stringify({ success: false, error: message, durationMs }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
