/**
 * compare-transport Edge Function
 * 
 * Returns 3-4 inter-city transport comparison options for a city pair,
 * with costs, durations, pros/cons, and archetype-based recommendations.
 * Used pre-generation to let users select their preferred transport mode.
 */

import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface TransportRequest {
  fromCity: string;
  fromCountry?: string;
  toCity: string;
  toCountry?: string;
  travelers: number;
  archetype?: string;
  budgetTier?: string;
  travelDate?: string;
  currency?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: TransportRequest = await req.json();
    const {
      fromCity, fromCountry, toCity, toCountry,
      travelers = 2, archetype, budgetTier, travelDate, currency = "USD",
    } = body;

    if (!fromCity || !toCity) {
      return new Response(JSON.stringify({ error: "fromCity and toCity are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const fromLabel = fromCountry ? `${fromCity}, ${fromCountry}` : fromCity;
    const toLabel = toCountry ? `${toCity}, ${toCountry}` : toCity;
    const isSameCountry = fromCountry && toCountry && fromCountry.toLowerCase() === toCountry.toLowerCase();

    // Archetype-aware recommendation
    let recommendationGuidance = "Recommend the best BALANCED option considering door-to-door time, total cost, and comfort.";
    const arch = (archetype || "").toLowerCase();
    if (arch.includes("luxury") || arch.includes("comfort")) {
      recommendationGuidance = "Recommend the MOST COMFORTABLE option: city-center-to-city-center, premium seating, minimal transfers.";
    } else if (arch.includes("budget") || arch.includes("backpack") || arch.includes("value")) {
      recommendationGuidance = "Recommend the CHEAPEST total door-to-door option, including all hidden costs.";
    } else if (arch.includes("adventure") || arch.includes("explorer")) {
      recommendationGuidance = "Recommend the option with the BEST SCENIC/EXPERIENCE value.";
    }

    const dateContext = travelDate
      ? `The travel date is approximately ${travelDate}. Factor in seasonal pricing and availability.`
      : "Use typical/average pricing.";

    const prompt = `You are a travel logistics expert. Generate transport comparison options for traveling from ${fromLabel} to ${toLabel} for ${travelers} traveler(s).

${dateContext}
Budget tier: ${budgetTier || "moderate"}
${recommendationGuidance}

Return a JSON object with this exact structure:
{
  "options": [
    {
      "id": "unique_string",
      "mode": "train" | "flight" | "bus" | "car" | "ferry",
      "operator": "Real operator name (e.g. Eurostar, EasyJet, FlixBus)",
      "emoji": "🚂 or ✈️ or 🚌 or 🚗 or ⛴️",
      "inTransitDuration": "Just travel time (e.g. 2h 15m)",
      "doorToDoorDuration": "TOTAL including transfers (e.g. 4h 30m)",
      "cost": {
        "perPerson": number,
        "total": number_for_${travelers}_travelers,
        "currency": "${currency}",
        "includesTransfers": boolean
      },
      "departure": { "point": "Real station/airport name", "neighborhood": "Area" },
      "arrival": { "point": "Real station/airport name", "neighborhood": "Area" },
      "pros": ["2-4 genuine advantages"],
      "cons": ["2-3 genuine disadvantages"],
      "bookingTip": "Actionable booking tip",
      "bookingUrl": "https://real-booking-website.com (e.g. trenitalia.com, flixbus.com, easyjet.com, rentalcars.com)",
      "bookingWebsite": "Human-readable name (e.g. Trenitalia, FlixBus, EasyJet)",
      "scenicOpportunities": ["What you'll see en route"],
      "isRecommended": boolean,
      "recommendationReason": "1-2 sentences why (only for recommended option)"
    }
  ]
}

RULES:
- Return exactly 3-4 options covering different modes where viable
- ${isSameCountry ? "Prioritize train/bus options since both cities are in the same country" : "Include flight options since the cities are in different countries"}
- Costs must be realistic for this route. Include ALL hidden costs (baggage, transfers, parking, tolls, fuel).
- Door-to-door time MUST include transfers, check-in, security, boarding — a 1h15m flight is 4-5h door-to-door.
- Use REAL operator names, station names, and airport names.
- bookingUrl MUST be real, working booking websites relevant to the operator/route.
- Exactly ONE option should have isRecommended: true.
- ALL costs in ${currency}.
- Return ONLY valid JSON, no markdown, no explanation.`;

    // Call AI
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are a travel logistics expert. Return only valid JSON." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[compare-transport] AI call failed:", aiResponse.status, errText);
      throw new Error(`AI call failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const raw = aiData.choices?.[0]?.message?.content || "";

    // Parse JSON from response (strip markdown fences if present)
    let parsed: { options: unknown[] };
    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("[compare-transport] JSON parse failed:", parseErr, "Raw:", raw.slice(0, 500));
      throw new Error("Failed to parse transport comparison from AI");
    }

    if (!parsed.options || !Array.isArray(parsed.options) || parsed.options.length === 0) {
      throw new Error("AI returned no transport options");
    }

    return new Response(JSON.stringify({
      options: parsed.options,
      fromCity,
      toCity,
      disclaimer: "Prices are estimates based on typical fares. Book early for best rates.",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[compare-transport] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
