import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TravelDNA {
  primary_archetype_name: string | null;
  secondary_archetype_name: string | null;
  trait_scores: Record<string, number> | null;
  emotional_drivers: string[] | null;
}

interface UserPreferences {
  interests: string[] | null;
  budget_tier: string | null;
  travel_pace: string | null;
  travel_style: string | null;
  climate_preferences: string[] | null;
  preferred_regions: string[] | null;
  accommodation_style: string | null;
  dining_style: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[suggest-mystery-trips] Generating suggestions for user: ${user.id}`);

    // Fetch user data in parallel
    const [travelDnaResult, preferencesResult, pastTripsResult, destinationsResult] = await Promise.all([
      supabase
        .from('travel_dna_profiles')
        .select('primary_archetype_name, secondary_archetype_name, trait_scores, emotional_drivers')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_preferences')
        .select('interests, budget_tier, travel_pace, travel_style, climate_preferences, preferred_regions, accommodation_style, dining_style')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('trips')
        .select('destination, destination_country')
        .eq('user_id', user.id)
        .in('status', ['completed', 'active', 'booked']),
      supabase
        .from('destinations')
        .select('id, city, country, region, description, best_time_to_visit, cost_tier, tags, known_for, stock_image_url')
        .limit(50),
    ]);

    const travelDna: TravelDNA | null = travelDnaResult.data;
    const preferences: UserPreferences | null = preferencesResult.data;
    const pastTrips = pastTripsResult.data || [];
    const destinations = destinationsResult.data || [];

    // Build context for AI
    const pastDestinations = pastTrips.map(t => t.destination?.toLowerCase()).filter(Boolean);
    const availableDestinations = destinations.filter(d => 
      !pastDestinations.includes(d.city?.toLowerCase())
    );

    const userProfile = buildUserProfile(travelDna, preferences);
    const destinationList = availableDestinations.map(d => ({
      city: d.city,
      country: d.country,
      region: d.region,
      description: d.description,
      bestTime: d.best_time_to_visit,
      costTier: d.cost_tier,
      knownFor: d.known_for,
      image: d.stock_image_url,
    }));

    // Call Lovable AI to suggest 3 destinations
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a travel expert for Voyance, a personalized travel planning service. 
Your task is to suggest exactly 3 destinations that would be PERFECT for this specific traveler based on their unique Travel DNA and preferences.

IMPORTANT: 
- Choose destinations that genuinely match their personality and travel style
- Provide a compelling, personalized reason for each suggestion (2-3 sentences max)
- The reason should feel personal, like "Based on your love of culture and relaxed pace, you'd thrive in..."
- Avoid generic descriptions - make it feel like you KNOW this traveler`;

    const userPrompt = `Based on this traveler's profile, suggest 3 perfect mystery getaway destinations:

${userProfile}

PAST DESTINATIONS TO EXCLUDE (they've been here):
${pastDestinations.length > 0 ? pastDestinations.join(', ') : 'None'}

AVAILABLE DESTINATIONS TO CHOOSE FROM:
${JSON.stringify(destinationList.slice(0, 30), null, 2)}

Return EXACTLY 3 destinations as JSON.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_destinations",
              description: "Suggest 3 personalized destination options for the mystery getaway",
              parameters: {
                type: "object",
                properties: {
                  suggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        city: { type: "string", description: "City name" },
                        country: { type: "string", description: "Country name" },
                        reason: { type: "string", description: "Personalized 2-3 sentence reason why this destination is perfect for them" },
                        matchScore: { type: "number", description: "How well this matches their profile (85-99)" },
                        highlights: { 
                          type: "array", 
                          items: { type: "string" },
                          description: "3-4 specific experiences they'd love here based on their interests"
                        },
                      },
                      required: ["city", "country", "reason", "matchScore", "highlights"],
                      additionalProperties: false,
                    },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["suggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_destinations" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[suggest-mystery-trips] AI error:", response.status, errorText);
      throw new Error("Failed to generate suggestions");
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    const suggestions = parsed.suggestions;

    // Enrich suggestions with images from destination data
    const enrichedSuggestions = suggestions.map((s: any) => {
      const destData = destinations.find(d => 
        d.city?.toLowerCase() === s.city?.toLowerCase()
      );
      return {
        ...s,
        image: destData?.stock_image_url || `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80`,
        region: destData?.region || null,
      };
    });

    console.log(`[suggest-mystery-trips] Generated ${enrichedSuggestions.length} suggestions`);

    return new Response(JSON.stringify({ 
      suggestions: enrichedSuggestions,
      userProfile: {
        archetype: travelDna?.primary_archetype_name || 'Traveler',
        interests: preferences?.interests || [],
      }
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[suggest-mystery-trips] Error:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Unknown error" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildUserProfile(travelDna: TravelDNA | null, preferences: UserPreferences | null): string {
  const parts: string[] = [];

  if (travelDna?.primary_archetype_name) {
    parts.push(`🧬 TRAVEL DNA: ${travelDna.primary_archetype_name}${travelDna.secondary_archetype_name ? ` with ${travelDna.secondary_archetype_name} tendencies` : ''}`);
  }

  if (travelDna?.emotional_drivers?.length) {
    parts.push(`💫 EMOTIONAL DRIVERS: ${travelDna.emotional_drivers.join(', ')}`);
  }

  if (travelDna?.trait_scores) {
    const traits = Object.entries(travelDna.trait_scores)
      .filter(([_, score]) => Math.abs(score as number) > 3)
      .map(([trait, score]) => `${trait}: ${(score as number) > 0 ? 'high' : 'low'}`)
      .join(', ');
    if (traits) parts.push(`📊 KEY TRAITS: ${traits}`);
  }

  if (preferences?.interests?.length) {
    parts.push(`🎯 INTERESTS: ${preferences.interests.join(', ')}`);
  }

  if (preferences?.budget_tier) {
    parts.push(`💰 BUDGET: ${preferences.budget_tier}`);
  }

  if (preferences?.travel_pace) {
    parts.push(`⏱️ PACE: ${preferences.travel_pace}`);
  }

  if (preferences?.climate_preferences?.length) {
    parts.push(`🌡️ CLIMATE: ${preferences.climate_preferences.join(', ')}`);
  }

  if (preferences?.preferred_regions?.length) {
    parts.push(`🌍 PREFERRED REGIONS: ${preferences.preferred_regions.join(', ')}`);
  }

  if (preferences?.accommodation_style) {
    parts.push(`🏨 ACCOMMODATION: ${preferences.accommodation_style}`);
  }

  if (preferences?.dining_style) {
    parts.push(`🍽️ DINING: ${preferences.dining_style}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No specific preferences on file - suggest diverse options';
}
