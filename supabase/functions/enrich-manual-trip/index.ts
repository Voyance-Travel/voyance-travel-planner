/**
 * Enrich Manual Trip — Smart Finish via Full Generation
 *
 * When a user purchases Smart Finish on a manually-built itinerary, this function:
 * 1. Reads the user's parsed research/activities from the existing itinerary_data
 * 2. Converts them into a "mustDoActivities" research context string
 * 3. Writes that context into trips.metadata so generate-itinerary can use it
 * 4. Calls generate-itinerary with action: 'generate-full' to produce a complete,
 *    polished Voyance itinerary — identical in quality to the standard flow
 *
 * This approach ensures Smart Finish produces the SAME output format as normal
 * Voyance-generated trips, not a weird "enrichment" hybrid.
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

  // Extract preferences/notes if present
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

  lines.push("USER'S RESEARCHED PLACES & ACTIVITIES (incorporate these into the itinerary where they fit the traveler's DNA):");

  // Deduplicate activities
  const seen = new Set<string>();
  for (const day of itinerary.days) {
    const dayActivities = day.activities || [];
    for (const activity of dayActivities) {
      const name = activity.title || activity.name || "";
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());

      const parts: string[] = [`- ${name}`];
      if (activity.category) parts.push(`(${activity.category})`);
      if (activity.location?.name || activity.location?.address) {
        const loc = activity.location?.name || activity.location?.address;
        parts.push(`at ${loc}`);
      }
      if (activity.notes || activity.description) {
        const note = activity.notes || activity.description;
        if (note.length < 200) parts.push(`— ${note}`);
      }
      lines.push(parts.join(" "));
    }
  }

  // Add practical tips if present
  if (itinerary.practicalTips?.length) {
    lines.push(`\nPRACTICAL TIPS FROM USER'S RESEARCH:\n${itinerary.practicalTips.slice(0, 5).map((t: string) => `- ${t}`).join("\n")}`);
  }

  return lines.join("\n");
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
      .select("id, itinerary_data, destination, user_id, start_date, end_date, metadata, smart_finish_purchased")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");
    if (trip.user_id !== user.id) throw new Error("Not your trip");

    const itinerary = trip.itinerary_data as any;
    if (!itinerary?.days) throw new Error("No itinerary data to base generation on");

    console.log(`[enrich-manual-trip] Starting Smart Finish for trip ${tripId} (${trip.destination})`);

    // --- Build user research context from parsed activities ---
    const researchContext = buildResearchContext(itinerary);
    console.log(`[enrich-manual-trip] Research context built: ${researchContext.length} chars, ${itinerary.days.length} days`);

    // --- Write research context into trip metadata so generate-itinerary picks it up ---
    const existingMetadata = (trip.metadata as any) || {};
    const updatedMetadata = {
      ...existingMetadata,
      mustDoActivities: researchContext,
      smartFinishSource: "manual_builder",
      smartFinishRequestedAt: new Date().toISOString(),
    };

    const { error: metaUpdateError } = await supabase
      .from("trips")
      .update({
        metadata: updatedMetadata,
        smart_finish_purchased: true,
        smart_finish_purchased_at: new Date().toISOString(),
        // Clear creation_source so the trip is treated as a normal AI-generated trip after Smart Finish
        creation_source: "smart_finish",
      })
      .eq("id", tripId);

    if (metaUpdateError) {
      throw new Error(`Failed to write research context: ${metaUpdateError.message}`);
    }

    console.log(`[enrich-manual-trip] Metadata written, calling generate-itinerary...`);

    // --- Call generate-itinerary with generate-full action ---
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
      console.error(`[enrich-manual-trip] generate-itinerary returned ${generateResponse.status}: ${errText}`);
      throw new Error(`Generation failed: ${generateResponse.status}`);
    }

    const generateData = await generateResponse.json();

    if (!generateData.success) {
      const errMsg = generateData.error || "Generation returned failure status";
      console.error(`[enrich-manual-trip] generate-itinerary failed:`, errMsg);
      throw new Error(errMsg);
    }

    console.log(`[enrich-manual-trip] ✓ Smart Finish complete: ${generateData.totalDays} days, ${generateData.totalActivities} activities`);

    return new Response(JSON.stringify({
      success: true,
      totalDays: generateData.totalDays,
      totalActivities: generateData.totalActivities,
      tipsAdded: generateData.totalActivities || 0,
      gapFixes: [],
      routeHints: [],
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
