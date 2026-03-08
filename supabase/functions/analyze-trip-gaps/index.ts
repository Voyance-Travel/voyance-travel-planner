/**
 * Analyze Trip Gaps — AI-powered quality enrichment analysis
 * 
 * Compares a user's manually-built itinerary against their Travel DNA
 * and destination knowledge to surface quality-focused opportunities:
 * hidden gems, better alternatives, insider timing hacks, local favorites.
 * 
 * Returns gap count + teaser hints (FREE), detailed fixes gated behind Smart Finish.
 * Cost: ~$0.005-0.01/call (Gemini 2.5 Flash Lite)
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

  try {
    // Auth — pass the user's token so RLS works on data queries
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { tripId } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // 1. Load trip data
    const { data: trip, error: tripError } = await supabase
      .from("trips")
      .select("itinerary_data, destination, start_date, end_date, trip_type, budget_tier, gap_analysis_result")
      .eq("id", tripId)
      .single();

    if (tripError || !trip) throw new Error("Trip not found");

    // Return cached result if available and less than 4 hours old
    if (trip.gap_analysis_result) {
      const cached = trip.gap_analysis_result as any;
      if (cached.analyzedAt) {
        const age = Date.now() - new Date(cached.analyzedAt).getTime();
        if (age < 14400000) { // 4 hours
          return new Response(JSON.stringify(cached), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // 2. Load user's Travel DNA
    const { data: profile } = await supabase
      .from("profiles")
      .select("travel_dna, travel_dna_overrides")
      .eq("id", user.id)
      .single();

    const dna = profile?.travel_dna as any;
    const itinerary = trip.itinerary_data as any;

    if (!itinerary?.days || !dna) {
      return new Response(JSON.stringify({
        gapCount: 0,
        gaps: [],
        message: "We need your Travel DNA and itinerary to analyze gaps.",
        analyzedAt: new Date().toISOString(),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. AI-powered quality gap analysis
    const days = itinerary.days || [];

    // Build a compact summary of the user's current itinerary
    const itinerarySummary = days.map((day: any) => {
      const activities = (day.activities || []).map((a: any) => {
        const parts = [a.title || a.name || "Unknown"];
        if (a.startTime || a.start_time) parts.push(`at ${a.startTime || a.start_time}`);
        if (a.category) parts.push(`(${a.category})`);
        return parts.join(" ");
      });
      return `Day ${day.dayNumber || day.day}: ${activities.join(", ") || "No activities"}`;
    }).join("\n");

    // Extract DNA traits for context
    const traits = dna.traits || dna.traitScores || {};
    const archetype = dna.primaryArchetype || dna.archetype || "";
    const overrides = profile?.travel_dna_overrides || {};

    // Build DNA context string
    const dnaContext = [
      archetype ? `Travel archetype: ${archetype}` : "",
      traits.pace ? `Pace preference: ${traits.pace}/10` : "",
      traits.comfort ? `Comfort level: ${traits.comfort}/10` : "",
      traits.spontaneity ? `Spontaneity: ${traits.spontaneity}/10` : "",
      traits.social ? `Social preference: ${traits.social}/10` : "",
      traits.culture ? `Cultural interest: ${traits.culture}/10` : "",
      traits.adventure ? `Adventure level: ${traits.adventure}/10` : "",
      (overrides as any)?.dietaryPreferences ? `Dietary: ${(overrides as any).dietaryPreferences}` : "",
      (overrides as any)?.budgetPreference ? `Budget: ${(overrides as any).budgetPreference}` : "",
    ].filter(Boolean).join("\n");

    const destination = trip.destination || "Unknown destination";
    const startDate = trip.start_date || "";
    const endDate = trip.end_date || "";
    const tripType = trip.trip_type || "";
    const budgetTier = trip.budget_tier || "";

    const prompt = `You are a luxury travel concierge analyzing a trip itinerary for quality enrichment opportunities. Your job is to identify what's MISSING in terms of experience quality — not structural issues like "no lunch break."

DESTINATION: ${destination}
TRIP DATES: ${startDate} to ${endDate}
TRIP TYPE: ${tripType}
BUDGET: ${budgetTier}

TRAVELER DNA:
${dnaContext}

CURRENT ITINERARY:
${itinerarySummary}

Analyze this itinerary and identify 3-5 quality enrichment opportunities. Focus ONLY on these categories:

1. **hidden_gem**: Local spots, neighborhood secrets, or off-the-beaten-path experiences near their planned activities that most tourists miss. Be specific — name actual places, streets, or neighborhoods.

2. **better_alternative**: A venue or experience on their itinerary that has a clearly better local-favorite alternative nearby. Name the specific alternative.

3. **insider_timing**: Timing hacks — visiting at a specific hour to avoid crowds, free admission days, golden hour views, weekly markets that align with their dates, seasonal events happening during their trip.

4. **experience_upgrade**: Ways to elevate an existing activity — a rooftop bar with the same view as their planned viewpoint, a cooking class version of a restaurant they picked, a guided experience that transforms a self-guided plan.

5. **local_favorite**: Dining, drinks, or cultural spots that locals actually go to, especially near areas they're already visiting. Contrast with tourist-oriented options on their itinerary if applicable.

DO NOT suggest:
- Adding meals or breaks (structural)
- Changing the number of activities (pacing)
- Adding wellness/downtime (structural)
- Generic advice like "book in advance" or "bring comfortable shoes"
- Anything that sounds like a guidebook tip

Each suggestion should feel like insider knowledge from a friend who lives there. Be specific with names, neighborhoods, and concrete details.

Respond in this exact JSON format:
{
  "gaps": [
    {
      "hint": "One sentence teaser — specific, enticing, names a real place or experience. Max 120 characters.",
      "severity": "info",
      "category": "hidden_gem|better_alternative|insider_timing|experience_upgrade|local_favorite"
    }
  ]
}

Return ONLY the JSON object, no other text. Return 3-5 gaps maximum. Use severity "info" for nice-to-know opportunities, "warning" for strong recommendations where they're clearly missing something great.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a luxury travel concierge with deep local knowledge. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 800,
      }),
    });

    if (!response.ok) {
      console.error(`[analyze-trip-gaps] AI call failed: ${response.status}`);
      throw new Error(`AI analysis failed: ${response.status}`);
    }

    const aiResult = await response.json();
    const responseText = aiResult.choices?.[0]?.message?.content || "";

    // Parse AI response
    let aiGaps: Array<{ hint: string; severity: "warning" | "info"; category: string }> = [];
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        aiGaps = (parsed.gaps || []).slice(0, 5).map((g: any) => ({
          hint: String(g.hint || "").slice(0, 150),
          severity: g.severity === "warning" ? "warning" : "info",
          category: String(g.category || "hidden_gem"),
        }));
      }
    } catch (parseErr) {
      console.error("[analyze-trip-gaps] Failed to parse AI response:", parseErr);
    }

    // Fallback: if AI returned nothing, provide minimal insight
    if (aiGaps.length === 0) {
      aiGaps.push({
        hint: `We found insider recommendations for ${destination} that could elevate your trip`,
        severity: "info",
        category: "hidden_gem",
      });
    }

    const uniqueGaps = aiGaps;

    const result = {
      gapCount: uniqueGaps.length,
      gaps: uniqueGaps,
      dnaArchetype: archetype,
      analyzedAt: new Date().toISOString(),
      detailedFixes: null, // Unlocked after Smart Finish purchase
    };

    // Cache the result
    await supabase
      .from("trips")
      .update({ gap_analysis_result: result as any })
      .eq("id", tripId);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[analyze-trip-gaps] Error:", msg);
    const status = msg.includes("Not authenticated") ? 401
      : msg.includes("required") || msg.includes("not found") ? 400
      : 500;
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status,
    });
  }
});
