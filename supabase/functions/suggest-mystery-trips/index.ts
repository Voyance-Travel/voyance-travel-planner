import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

interface UserEnrichment {
  entity_id: string;
  entity_name: string;
  feedback_tags: string[] | null;
  decline_count: number;
  suppress_until: string | null;
  is_permanent_suppress: boolean;
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

    // Fetch user data in parallel (including enrichment/feedback data)
    const [travelDnaResult, preferencesResult, pastTripsResult, destinationsResult, enrichmentResult, previousSuggestionsResult] = await Promise.all([
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
      // Get user's declined destinations
      supabase
        .from('user_enrichment')
        .select('entity_id, entity_name, feedback_tags, decline_count, suppress_until, is_permanent_suppress')
        .eq('user_id', user.id)
        .eq('enrichment_type', 'destination_decline'),
      // Get recently shown mystery trip suggestions to avoid repeats
      supabase
        .from('user_enrichment')
        .select('entity_name, created_at')
        .eq('user_id', user.id)
        .eq('enrichment_type', 'mystery_trip_shown')
        .order('created_at', { ascending: false })
        .limit(15),
    ]);

    const travelDna: TravelDNA | null = travelDnaResult.data;
    const preferences: UserPreferences | null = preferencesResult.data;
    const pastTrips = pastTripsResult.data || [];
    const destinations = destinationsResult.data || [];
    const enrichmentData: UserEnrichment[] = enrichmentResult.data || [];
    const previouslyShown = (previousSuggestionsResult.data || []).map(s => s.entity_name?.toLowerCase()).filter(Boolean);

    // Build sets of destinations to exclude
    const pastDestinations = pastTrips.map(t => t.destination?.toLowerCase()).filter(Boolean);
    
    // Build suppressed destinations from enrichment data
    const now = new Date();
    const suppressedDestinations = enrichmentData
      .filter(e => {
        // Permanently suppressed (declined 5+ times)
        if (e.is_permanent_suppress) return true;
        // Temporarily suppressed (declined 3+ times, within suppress window)
        if (e.suppress_until && new Date(e.suppress_until) > now) return true;
        return false;
      })
      .map(e => e.entity_id);

    // Build context about user's dislikes from enrichment
    const userDislikes = enrichmentData
      .flatMap(e => e.feedback_tags || [])
      .reduce((acc, tag) => {
        acc[tag] = (acc[tag] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    // Sort to find top dislikes
    const topDislikes = Object.entries(userDislikes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);

    console.log(`[suggest-mystery-trips] Suppressed destinations: ${suppressedDestinations.length}, Top dislikes: ${topDislikes.join(', ')}`);

    // Filter available destinations
    const availableDestinations = destinations.filter(d => {
      const cityLower = d.city?.toLowerCase();
      const entityId = `${cityLower}_${d.country?.toLowerCase()}`;
      
      // Exclude past trips
      if (pastDestinations.includes(cityLower)) return false;
      
      // Exclude suppressed destinations
      if (suppressedDestinations.includes(entityId)) return false;
      
      return true;
    });

    const userProfile = buildUserProfile(travelDna, preferences, topDislikes);
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

    // Shuffle available destinations to reduce AI bias toward top-of-list picks
    const shuffled = [...destinationList].sort(() => Math.random() - 0.5);

    const systemPrompt = `You are a travel expert for Voyance, a personalized travel planning service. 
Your task is to suggest exactly 3 destinations that would be PERFECT for this specific traveler based on their unique Travel DNA and preferences.

IMPORTANT: 
- VARIETY IS CRITICAL: Pick surprising, diverse destinations across different regions and vibes. Never cluster all 3 in the same region.
- Choose destinations that genuinely match their personality and travel style
- AVOID destinations that match their known dislikes (listed below)
- Provide a compelling, personalized reason for each suggestion (2-3 sentences max)
- The reason should feel personal, like "Based on your love of culture and relaxed pace, you'd thrive in..."
- Avoid generic descriptions - make it feel like you KNOW this traveler
- Do NOT repeat previously shown destinations (listed below)`;

    const userPrompt = `Based on this traveler's profile, suggest 3 perfect mystery getaway destinations:

${userProfile}

PAST DESTINATIONS TO EXCLUDE (they've been here):
${pastDestinations.length > 0 ? pastDestinations.join(', ') : 'None'}

DECLINED DESTINATIONS TO EXCLUDE (they weren't interested):
${suppressedDestinations.length > 0 ? suppressedDestinations.map(id => id.replace('_', ', ')).join('; ') : 'None'}

PREVIOUSLY SUGGESTED DESTINATIONS TO EXCLUDE (already shown recently — DO NOT repeat these):
${previouslyShown.length > 0 ? previouslyShown.join(', ') : 'None'}

AVAILABLE DESTINATIONS TO CHOOSE FROM:
${JSON.stringify(shuffled.slice(0, 30), null, 2)}

Return EXACTLY 3 destinations as JSON. Pick different destinations than the previously suggested ones.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        temperature: 1.2,
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
    
    // Track AI usage
    const costTracker = trackCost('suggest_mystery_trips', 'google/gemini-3-flash-preview');
    costTracker.setUserId(user.id);
    costTracker.recordAiUsage(aiResult);
    await costTracker.save();
    
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

    // Record shown suggestions so they won't repeat next time
    const shownRecords = enrichedSuggestions.map((s: any) => ({
      user_id: user.id,
      enrichment_type: 'mystery_trip_shown',
      entity_type: 'destination',
      entity_id: `${s.city?.toLowerCase()}_${s.country?.toLowerCase()}`,
      entity_name: `${s.city}, ${s.country}`,
      metadata: { shown_at: new Date().toISOString() },
    }));
    const { error: shownError } = await supabase.from('user_enrichment').insert(shownRecords);
    if (shownError) {
      console.warn('[suggest-mystery-trips] Failed to record shown suggestions:', shownError);
    }

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

function buildUserProfile(
  travelDna: TravelDNA | null, 
  preferences: UserPreferences | null,
  topDislikes: string[]
): string {
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

  // Add user dislikes from feedback
  if (topDislikes.length > 0) {
    const dislikeLabels: Record<string, string> = {
      'been_there': 'familiar destinations',
      'not_interested': 'mainstream destinations',
      'too_expensive': 'expensive destinations',
      'wrong_climate': 'certain climates',
      'too_far': 'long-haul destinations',
      'safety_concerns': 'destinations with safety concerns',
      'wrong_vibe': 'destinations that don\'t match their style',
    };
    const formattedDislikes = topDislikes.map(d => dislikeLabels[d] || d).join(', ');
    parts.push(`🚫 AVOID: ${formattedDislikes}`);
  }

  return parts.length > 0 ? parts.join('\n') : 'No specific preferences on file - suggest diverse options';
}