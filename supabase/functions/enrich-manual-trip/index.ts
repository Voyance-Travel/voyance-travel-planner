/**
 * Enrich Manual Trip — Smart Finish via Full Generation (ASYNC)
 *
 * When a user purchases Smart Finish on a manually-built itinerary, this function:
 * 1. Reads the user's parsed research/activities from the existing itinerary_data
 * 2. Converts them into a "mustDoActivities" research context string
 * 3. Writes that context into trips.metadata so generate-itinerary can use it
 * 4. Kicks off generate-itinerary in the BACKGROUND (fire-and-forget)
 * 5. Returns immediately so the client never times out
 *
 * The client polls trips.metadata.smartFinishCompleted to know when it's done.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Convert parsed itinerary activities into a compact research string
 * that can be injected as mustDoActivities into generate-itinerary's prompt
 */
function buildResearchContext(itinerary: any): string {
  if (!itinerary?.days?.length) return "";

  const lines: string[] = [];

  if (itinerary.preferences) {
    const prefs = itinerary.preferences;
    if (prefs.rawPreferenceText) {
      lines.push(`USER'S ORIGINAL PREFERENCES:\n"${prefs.rawPreferenceText}"\n`);
    } else {
      const parts: string[] = [];
      if (prefs.focus?.length) parts.push(`Focus: ${prefs.focus.join(", ")}`);
      if (prefs.avoid?.length) parts.push(`Avoid: ${prefs.avoid.join(", ")}`);
      if (prefs.dietary?.length) parts.push(`Dietary: ${prefs.dietary.join(", ")}`);
      if (prefs.pace) parts.push(`Pace: ${prefs.pace}`);
      if (prefs.budget) parts.push(`Budget: ${prefs.budget}`);
      if (parts.length) lines.push(`USER PREFERENCES: ${parts.join(" | ")}\n`);
    }
  }

  if (itinerary.tripVibe) {
    lines.push(`TRIP VIBE/INTENT: ${itinerary.tripVibe}`);
  }
  if (itinerary.tripPriorities?.length) {
    lines.push(`TRIP PRIORITIES: ${itinerary.tripPriorities.join(", ")}`);
  }

  lines.push("");
  lines.push("SMART_FINISH_SOURCE_NOTES:");
  lines.push("Use the user's researched venues below as hard anchors.");
  lines.push("Keep all user-provided anchors, then expand with DNA-matched additions, transit, meals, and exact HH:MM times.");
  lines.push("");

  lines.push("USER'S RESEARCHED PLACES & ACTIVITIES (incorporate ALL of these, then EXPAND with additional DNA-matched activities):");

  for (const day of itinerary.days) {
    const dayNum = day.dayNumber || day.day;
    if (dayNum) lines.push(`\n  Day ${dayNum}:`);

    const dayActivities = day.activities || [];
    const daySeen = new Set<string>();

    for (const activity of dayActivities) {
      const name = activity.title || activity.name || "";
      if (!name) continue;

      const normalizedName = name.toLowerCase().trim();
      if (daySeen.has(normalizedName)) continue;
      daySeen.add(normalizedName);

      const parts: string[] = [`  - ${name}`];
      if (activity.category) parts.push(`(${activity.category})`);
      if (activity.startTime || activity.start_time) {
        parts.push(`at ${activity.startTime || activity.start_time}`);
      }
      if (activity.location?.name || activity.location?.address || activity.address) {
        const loc = activity.location?.name || activity.location?.address || activity.address;
        parts.push(`@ ${loc}`);
      }
      if (activity.notes || activity.description) {
        const note = activity.notes || activity.description;
        if (note.length < 200) parts.push(`— ${note}`);
      }
      if (activity.bookingUrl || activity.booking_url) {
        parts.push(`[link: ${activity.bookingUrl || activity.booking_url}]`);
      }
      lines.push(parts.join(" "));
    }
  }

  if (itinerary.practicalTips?.length) {
    lines.push(`\nPRACTICAL TIPS FROM USER'S RESEARCH:\n${itinerary.practicalTips.slice(0, 5).map((t: string) => `- ${t}`).join("\n")}`);
  }

  if (itinerary.accommodationNotes?.length || itinerary.metadata?.accommodationNotes?.length) {
    const notes = itinerary.accommodationNotes || itinerary.metadata?.accommodationNotes;
    lines.push(`\nACCOMMODATION NOTES:\n${notes.slice(0, 5).map((n: string) => `- ${n}`).join("\n")}`);
  }

  return lines.join("\n");
}

/**
 * Background generation task.
 * Runs AFTER the HTTP response has been sent to the client.
 */
async function runGenerationInBackground(
  supabaseUrl: string,
  supabaseServiceKey: string,
  authHeader: string,
  tripId: string,
  userId: string,
  updatedMetadata: any,
  pendingChargeId: string | null,
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log(`[enrich-manual-trip:bg] Starting generate-itinerary for trip ${tripId}`);

    const generateResponse = await fetch(`${supabaseUrl}/functions/v1/generate-itinerary`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
        "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      },
      body: JSON.stringify({
        action: "generate-full",
        tripId,
      }),
    });

    if (!generateResponse.ok) {
      const errText = await generateResponse.text();
      console.error(`[enrich-manual-trip:bg] generate-itinerary returned ${generateResponse.status}: ${errText}`);
      throw new Error(`Generation failed: ${generateResponse.status}`);
    }

    const generateData = await generateResponse.json();

    if (!generateData.success) {
      const errMsg = generateData.error || "Generation returned failure status";
      console.error(`[enrich-manual-trip:bg] generate-itinerary failed:`, errMsg);
      throw new Error(errMsg);
    }

    console.log(`[enrich-manual-trip:bg] ✓ Smart Finish complete: ${generateData.totalDays} days, ${generateData.totalActivities} activities`);

    // Mark completion in metadata
    const completedMeta = {
      ...updatedMetadata,
      smartFinishCompleted: true,
      smartFinishCompletedAt: new Date().toISOString(),
      smartFinishTotalActivities: generateData.totalActivities || 0,
    };
    await supabase
      .from("trips")
      .update({
        metadata: completedMeta,
        smart_finish_purchased: true,
        creation_source: "smart_finish",
      })
      .eq("id", tripId);

    // Mark pending charge as completed
    if (pendingChargeId) {
      await supabase
        .from("pending_credit_charges")
        .update({ status: "completed", resolved_at: new Date().toISOString(), resolution_note: "Smart Finish succeeded" })
        .eq("id", pendingChargeId);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[enrich-manual-trip:bg] Background generation FAILED:`, msg);

    // Mark failure in metadata so client can detect it
    const failedMeta = {
      ...updatedMetadata,
      smartFinishCompleted: false,
      smartFinishFailed: true,
      smartFinishFailedAt: new Date().toISOString(),
      smartFinishError: msg,
    };
    await supabase
      .from("trips")
      .update({ metadata: failedMeta })
      .eq("id", tripId);

    // Mark pending charge as failed
    if (pendingChargeId) {
      await supabase
        .from("pending_credit_charges")
        .update({ status: "failed", resolved_at: new Date().toISOString(), resolution_note: `Smart Finish failed: ${msg}` })
        .eq("id", pendingChargeId);
    }
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // --- Auth ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");

    const anonClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { tripId } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // --- Load trip ---
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, itinerary_data, destination, user_id, start_date, end_date, metadata, smart_finish_purchased, creation_source")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");
    if (trip.user_id !== user.id) throw new Error("Not your trip");

    // Guard: if Smart Finish already successfully completed, do not re-run generation.
    const meta = (trip.metadata as any) || {};
    if (meta.smartFinishCompleted === true) {
      console.log(`[enrich-manual-trip] Smart Finish already completed for trip ${tripId} — skipping.`);
      return new Response(JSON.stringify({
        success: true,
        alreadyCompleted: true,
        status: "completed",
        totalDays: 0,
        totalActivities: 0,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const itinerary = trip.itinerary_data as any;
    if (!itinerary?.days) throw new Error("No itinerary data to base generation on");

    // --- Record pending charge for server-side safety net ---
    let pendingChargeId: string | null = null;
    try {
      const { data: pendingRow } = await supabase
        .from("pending_credit_charges")
        .insert({
          user_id: user.id,
          trip_id: tripId,
          action: "SMART_FINISH",
          credits_amount: 50,
          status: "pending",
        })
        .select("id")
        .single();
      pendingChargeId = pendingRow?.id ?? null;
      console.log(`[enrich-manual-trip] Pending charge recorded: ${pendingChargeId}`);
    } catch (pcErr) {
      console.warn("[enrich-manual-trip] Failed to record pending charge (non-fatal):", pcErr);
    }

    console.log(`[enrich-manual-trip] Starting Smart Finish for trip ${tripId} (${trip.destination})`);

    // --- Ensure Travel DNA traits are non-zero before generation ---
    try {
      const { data: dnaRow } = await supabase
        .from("travel_dna_profiles")
        .select("trait_scores")
        .eq("user_id", user.id)
        .maybeSingle();

      const traits = (dnaRow?.trait_scores as Record<string, number>) || {};
      const allZero = Object.values(traits).every(v => v === 0);

      if (!dnaRow || allZero) {
        console.log(`[enrich-manual-trip] DNA traits missing or all zeros — triggering recalculation`);
        const recalcResp = await fetch(`${supabaseUrl}/functions/v1/calculate-travel-dna`, {
          method: "POST",
          headers: {
            "Authorization": authHeader!,
            "Content-Type": "application/json",
            "apikey": Deno.env.get("SUPABASE_ANON_KEY") ?? "",
          },
          body: JSON.stringify({ userId: user.id }),
        });
        if (recalcResp.ok) {
          console.log(`[enrich-manual-trip] ✓ DNA recalculated successfully`);
        } else {
          console.warn(`[enrich-manual-trip] DNA recalc returned ${recalcResp.status} (non-fatal)`);
        }
      } else {
        console.log(`[enrich-manual-trip] DNA traits look healthy, skipping recalc`);
      }
    } catch (dnaErr) {
      console.warn("[enrich-manual-trip] DNA pre-check failed (non-fatal):", dnaErr);
    }

    // --- Build user research context from parsed activities ---
    const researchContext = buildResearchContext(itinerary);
    console.log(`[enrich-manual-trip] Research context built: ${researchContext.length} chars, ${itinerary.days.length} days`);

    // --- Write research context into trip metadata so generate-itinerary picks it up ---
    const existingMetadata = (trip.metadata as any) || {};
    const updatedMetadata = {
      ...existingMetadata,
      mustDoActivities: researchContext,
      smartFinishSource: "manual_builder_standard",
      smartFinishRequestedAt: new Date().toISOString(),
      smartFinishStatus: "generating", // <-- client polls this
      smartFinishFailed: false,
      smartFinishError: null,
      accommodationNotes: itinerary.metadata?.accommodationNotes || itinerary.accommodationNotes || existingMetadata.accommodationNotes || [],
      practicalTips: itinerary.metadata?.practicalTips || itinerary.practicalTips || existingMetadata.practicalTips || [],
      tripVibe: itinerary.tripVibe || existingMetadata.tripVibe || null,
      tripPriorities: itinerary.tripPriorities || existingMetadata.tripPriorities || [],
    };

    const { error: metaUpdateError } = await supabase
      .from("trips")
      .update({
        metadata: updatedMetadata,
        smart_finish_purchased: true,
        smart_finish_purchased_at: new Date().toISOString(),
      })
      .eq("id", tripId);

    if (metaUpdateError) {
      throw new Error(`Failed to write research context: ${metaUpdateError.message}`);
    }

    console.log(`[enrich-manual-trip] Metadata written. Kicking off background generation and returning immediately.`);

    // --- Fire-and-forget: run generation in background ---
    // EdgeRuntime.waitUntil keeps the isolate alive after we return the response.
    const bgPromise = runGenerationInBackground(
      supabaseUrl,
      supabaseServiceKey,
      authHeader,
      tripId,
      user.id,
      updatedMetadata,
      pendingChargeId,
    );

    // Use waitUntil if available (Supabase Edge Runtime), otherwise just fire-and-forget
    if (typeof (globalThis as any).EdgeRuntime !== "undefined" && (globalThis as any).EdgeRuntime.waitUntil) {
      (globalThis as any).EdgeRuntime.waitUntil(bgPromise);
    } else {
      // Fallback: just let the promise run (function stays alive until it completes or times out)
      bgPromise.catch(err => console.error("[enrich-manual-trip] bg fallback error:", err));
    }

    // --- Return immediately ---
    return new Response(JSON.stringify({
      success: true,
      status: "generating",
      message: "Smart Finish is generating your itinerary. This may take a minute or two.",
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[enrich-manual-trip] Error:", msg);
    const status = msg.includes("Not authenticated") ? 401
      : msg.includes("required") || msg.includes("not found") || msg.includes("Not your trip") ? 400
      : 500;
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
