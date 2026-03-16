import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: unknown) => {
  console.log(`[ENRICH-DEST] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { destinationId } = await req.json();
    if (!destinationId) {
      return new Response(JSON.stringify({ success: false, error: "destinationId required", code: "MISSING_PARAM" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Starting enrichment", { destinationId });

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Fetch destination
    const { data: dest, error: destErr } = await supabaseClient
      .from("destinations")
      .select("*")
      .eq("id", destinationId)
      .single();

    if (destErr || !dest) {
      log("Destination not found", { destinationId, error: destErr?.message });
      return new Response(JSON.stringify({ success: false, error: "Destination not found", code: "NOT_FOUND" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already enriched
    if (dest.enriched_at) {
      log("Already enriched", { destinationId, enriched_at: dest.enriched_at });
      return new Response(JSON.stringify({ success: true, skipped: true, reason: "already_enriched" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ success: false, error: "AI key not configured", code: "CONFIG_ERROR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are a world-class travel writer creating destination content for a premium travel planning platform called Voyance.

City: ${dest.city}
Country: ${dest.country || 'Unknown'}
Region: ${dest.region || 'Unknown'}
Current description: ${dest.description || 'None'}

Generate rich, specific content for this destination. Be evocative and specific — mention actual place names, neighborhoods, dishes, and customs. Avoid generic travel advice.

Return a JSON object with these exact fields:
{
  "description": "A compelling 2-3 sentence description that captures what makes this city special. Be specific and evocative, not guidebook-generic.",
  "local_tips": ["4-6 specific, actionable local tips — mention actual places, customs, or insider knowledge"],
  "food_scene": "A paragraph about the city's food culture — mention specific dishes, neighborhoods for eating, and dining customs.",
  "tipping_custom": "One sentence about tipping norms in this city/country.",
  "dress_code": "One sentence about dress expectations for tourists.",
  "safety_tips": ["2-3 specific safety tips relevant to this destination"],
  "common_scams": ["1-3 common tourist scams specific to this area, or empty array if none notable"],
  "best_neighborhoods": ["3-5 neighborhoods worth exploring with one-line descriptions"],
  "activities": [
    {
      "name": "Specific activity or attraction name",
      "category": "one of: culture, food, nature, adventure, nightlife, shopping, relaxation",
      "description": "2-3 sentence description",
      "duration_minutes": 90,
      "price_tier": "one of: free, budget, moderate, premium, luxury"
    }
  ]
}

Generate 8-12 activities covering diverse categories. Use real venue names and attractions, not generic descriptions like "Visit a museum" — instead say "Explore the [Actual Museum Name]".

IMPORTANT: Return ONLY valid JSON, no markdown, no code fences.`;

    log("Calling AI gateway");

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: prompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "enrich_destination",
              description: "Return enriched destination content",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string" },
                  local_tips: { type: "array", items: { type: "string" } },
                  food_scene: { type: "string" },
                  tipping_custom: { type: "string" },
                  dress_code: { type: "string" },
                  safety_tips: { type: "array", items: { type: "string" } },
                  common_scams: { type: "array", items: { type: "string" } },
                  best_neighborhoods: { type: "array", items: { type: "string" } },
                  activities: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string" },
                        category: { type: "string" },
                        description: { type: "string" },
                        duration_minutes: { type: "number" },
                        price_tier: { type: "string" },
                      },
                      required: ["name", "category", "description", "duration_minutes"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["description", "local_tips", "food_scene", "activities"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "enrich_destination" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      log("AI gateway error", { status: aiResponse.status, body: errText });

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ success: false, error: "Rate limited, try again later", code: "RATE_LIMITED" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ success: false, error: "AI credits exhausted", code: "PAYMENT_REQUIRED" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ success: false, error: "AI generation failed", code: "AI_ERROR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    log("AI response received");

    // Extract tool call result
    let enriched: Record<string, unknown>;
    try {
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      if (toolCall?.function?.arguments) {
        enriched = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } else {
        // Fallback: try parsing content directly
        const content = aiData.choices?.[0]?.message?.content || "";
        const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        enriched = JSON.parse(cleaned);
      }
    } catch (parseErr) {
      log("Failed to parse AI response", { error: String(parseErr) });
      return new Response(JSON.stringify({ success: false, error: "Failed to parse AI response", code: "PARSE_ERROR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    log("Parsed enrichment data", { 
      tipCount: (enriched.local_tips as string[])?.length,
      activityCount: (enriched.activities as unknown[])?.length,
    });

    // Update destination with enriched content
    const updatePayload: Record<string, unknown> = {
      enriched_at: new Date().toISOString(),
    };

    if (enriched.description) updatePayload.description = enriched.description;
    if (enriched.local_tips) updatePayload.local_tips = enriched.local_tips;
    if (enriched.food_scene) updatePayload.food_scene = enriched.food_scene;
    if (enriched.tipping_custom) updatePayload.tipping_custom = enriched.tipping_custom;
    if (enriched.dress_code) updatePayload.dress_code = enriched.dress_code;
    if (enriched.safety_tips) updatePayload.safety_tips = enriched.safety_tips;
    if (enriched.common_scams) updatePayload.common_scams = enriched.common_scams;
    if (enriched.best_neighborhoods) updatePayload.best_neighborhoods = enriched.best_neighborhoods;

    const { error: updateErr } = await supabaseClient
      .from("destinations")
      .update(updatePayload)
      .eq("id", destinationId);

    if (updateErr) {
      log("Failed to update destination", { error: updateErr.message });
      return new Response(JSON.stringify({ success: false, error: "Failed to save enrichment", code: "DB_ERROR" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert activities
    const aiActivities = (enriched.activities as Array<{
      name: string;
      category: string;
      description: string;
      duration_minutes: number;
      price_tier?: string;
    }>) || [];

    if (aiActivities.length > 0) {
      const activityRows = aiActivities.map((act) => ({
        destination_id: destinationId,
        name: act.name,
        category: act.category || "culture",
        description: act.description || "",
        duration_minutes: act.duration_minutes || 90,
        tags: act.price_tier || "moderate",
      }));

      const { error: actErr } = await supabaseClient
        .from("activities")
        .insert(activityRows);

      if (actErr) {
        log("Failed to insert activities (non-fatal)", { error: actErr.message });
        // Non-fatal — destination was already enriched
      } else {
        log("Activities inserted", { count: activityRows.length });
      }
    }

    log("Enrichment complete", { destinationId });

    return new Response(JSON.stringify({ 
      success: true, 
      enriched: true,
      activitiesAdded: aiActivities.length,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    log("Unhandled error", { error: String(err) });
    return new Response(JSON.stringify({ success: false, error: "Internal error", code: "INTERNAL_ERROR" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
