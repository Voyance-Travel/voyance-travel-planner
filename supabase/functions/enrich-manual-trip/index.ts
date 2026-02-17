/**
 * Enrich Manual Trip — Post Smart Finish purchase
 * 
 * Performs lightweight enrichment on manually-built itineraries:
 * - Route optimization hints
 * - Insider tips per activity (AI pass)
 * - DNA gap detailed fixes
 * - Marks trip as smart_finish_purchased
 * 
 * Cost: ~$0.10–0.22/call
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");

    // Use anon client for auth check
    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );
    const { data: { user }, error: authError } = await anonClient.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { tripId } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // Load trip
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("id, itinerary_data, destination, user_id, gap_analysis_result, start_date")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");
    if (trip.user_id !== user.id) throw new Error("Not your trip");

    const itinerary = trip.itinerary_data as any;
    if (!itinerary?.days) throw new Error("No itinerary data");

    // Load DNA for detailed gap fixes
    const { data: profile } = await supabase
      .from("profiles")
      .select("travel_dna")
      .eq("id", user.id)
      .single();

    const dna = profile?.travel_dna as any;
    const archetype = dna?.primaryArchetype || dna?.archetype || "Balanced Traveler";
    const traits = dna?.traits || dna?.traitScores || {};

    // Build activity list for AI enrichment
    const activitySummaries = itinerary.days.flatMap((day: any) =>
      (day.activities || []).map((a: any) => ({
        dayNumber: day.dayNumber,
        title: a.title,
        category: a.category || a.type || "activity",
        startTime: a.startTime || a.time,
        location: a.location?.name || a.location?.address || "",
      }))
    );

    // AI pass: Generate insider tips + detailed gap fixes
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("AI API key not configured");

    const prompt = `You are Voyance, a travel intelligence engine. Analyze this manually-built itinerary and provide:

1. INSIDER TIPS: For each activity, provide 1 specific insider tip (what to order, best entrance, when to arrive, what most tourists miss).
2. GAP FIXES: Based on the traveler's DNA (${archetype}, pace: ${traits.pace || 5}/10, comfort: ${traits.comfort || 5}/10), provide specific fixes for any pacing, meal, wellness, or timing issues.

Traveler DNA: ${archetype}
Destination: ${trip.destination}

Activities:
${activitySummaries.map((a: any) => `Day ${a.dayNumber}: ${a.title} (${a.category}) at ${a.startTime || 'unset'} - ${a.location}`).join('\n')}

Respond ONLY with valid JSON:
{
  "tips": [
    { "dayNumber": 1, "activityTitle": "...", "tip": "..." }
  ],
  "gapFixes": [
    { "issue": "...", "fix": "...", "dayNumber": 1, "severity": "warning" }
  ],
  "routeHints": [
    { "dayNumber": 1, "suggestion": "Consider starting at X which is closest to your hotel" }
  ]
}`;

    const aiResponse = await fetch("https://ai.lovable.dev/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        max_tokens: 3000,
      }),
    });

    let enrichment = { tips: [], gapFixes: [], routeHints: [] };
    
    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || "";
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          enrichment = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("[enrich-manual-trip] Failed to parse AI response:", e);
      }
    }

    // Merge tips into itinerary activities
    const enrichedDays = itinerary.days.map((day: any) => ({
      ...day,
      activities: (day.activities || []).map((activity: any) => {
        const tip = (enrichment.tips || []).find(
          (t: any) => t.dayNumber === day.dayNumber && 
            activity.title?.toLowerCase().includes(t.activityTitle?.toLowerCase()?.substring(0, 15))
        );
        return {
          ...activity,
          tips: tip?.tip || activity.tips,
          enrichedBySmartFinish: true,
        };
      }),
    }));

    // Update trip with enrichment
    const gapResult = trip.gap_analysis_result as any || {};
    const updatedGapResult = {
      ...gapResult,
      detailedFixes: enrichment.gapFixes || [],
      routeHints: enrichment.routeHints || [],
      enrichedAt: new Date().toISOString(),
    };

    const { error: updateError } = await supabase
      .from("trips")
      .update({
        itinerary_data: { ...itinerary, days: enrichedDays },
        smart_finish_purchased: true,
        smart_finish_purchased_at: new Date().toISOString(),
        gap_analysis_result: updatedGapResult as any,
      })
      .eq("id", tripId);

    if (updateError) throw new Error(`Failed to update trip: ${updateError.message}`);

    return new Response(JSON.stringify({
      success: true,
      gapFixes: enrichment.gapFixes,
      routeHints: enrichment.routeHints,
      tipsAdded: (enrichment.tips || []).length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[enrich-manual-trip] Error:", msg);
    const status = msg.includes("Not authenticated") ? 401
      : msg.includes("required") || msg.includes("not found") || msg.includes("Not your trip") ? 400
      : 500;
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
