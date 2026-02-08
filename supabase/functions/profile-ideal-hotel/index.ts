import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface DNATraits {
  planning: number;
  social: number;
  comfort: number;
  pace: number;
  budget: number;
  adventure: number;
  culture: number;
  authenticity: number;
}

interface IdealHotelProfile {
  idealTypes: string[];           // e.g. ["boutique", "riad"]
  idealNeighborhoods: string[];   // e.g. ["Marais", "Latin Quarter"]
  idealAmenities: string[];       // e.g. ["rooftop bar", "spa"]
  priceRange: { min: number; max: number };
  styleDescription: string;       // 1-2 sentence natural language
  avoidTypes: string[];           // e.g. ["hostel", "chain"]
  searchKeywords: string[];       // terms to boost in hotel search
}

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
}

// ============= CACHE =============
const CACHE_TTL_HOURS = 24; // DNA profiles don't change often

async function getCachedProfile(userId: string, destination: string): Promise<IdealHotelProfile | null> {
  try {
    const supabase = getSupabaseAdmin();
    const cacheKey = `hotel-profile:${userId}:${destination.toLowerCase().trim()}`;
    
    const { data } = await supabase
      .from('search_cache')
      .select('results')
      .eq('search_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .single();
    
    if (data?.results) {
      console.log('[ProfileIdealHotel] Cache hit');
      return data.results as unknown as IdealHotelProfile;
    }
    return null;
  } catch {
    return null;
  }
}

async function cacheProfile(userId: string, destination: string, profile: IdealHotelProfile): Promise<void> {
  try {
    const supabase = getSupabaseAdmin();
    const cacheKey = `hotel-profile:${userId}:${destination.toLowerCase().trim()}`;
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('search_cache')
      .upsert({
        search_type: 'hotel_profile',
        search_key: cacheKey,
        destination: destination.toUpperCase(),
        results: profile as any,
        result_count: 1,
        expires_at: expiresAt,
      }, { onConflict: 'search_key' });
  } catch (e) {
    console.warn('[ProfileIdealHotel] Cache write error:', e);
  }
}

// ============= BUDGET MAPPING =============
function getBudgetRange(budgetTier: string): { min: number; max: number } {
  switch (budgetTier) {
    case 'budget': return { min: 40, max: 100 };
    case 'moderate': return { min: 100, max: 250 };
    case 'premium': return { min: 200, max: 500 };
    case 'luxury': return { min: 400, max: 1500 };
    default: return { min: 100, max: 250 };
  }
}

// ============= MAIN =============
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, destination, traitScores, budgetTier, primaryArchetype, tripType } = await req.json();

    if (!destination) {
      return new Response(JSON.stringify({ error: 'Destination is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check cache first (only if we have a userId)
    if (userId) {
      const cached = await getCachedProfile(userId, destination);
      if (cached) {
        return new Response(JSON.stringify({ success: true, profile: cached }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Build trait description for AI
    const traits: DNATraits = traitScores || {
      planning: 0.5, social: 0.5, comfort: 0.5, pace: 0.5,
      budget: 0.5, adventure: 0.5, culture: 0.5, authenticity: 0.5,
    };
    const tier = budgetTier || 'moderate';
    const priceRange = getBudgetRange(tier);

    const traitSummary = [
      traits.comfort >= 0.7 ? 'Values high comfort and luxury amenities' :
        traits.comfort <= 0.3 ? 'Comfortable with basic accommodations' : 'Moderate comfort expectations',
      traits.adventure >= 0.7 ? 'Loves unique, unconventional stays' :
        traits.adventure <= 0.3 ? 'Prefers familiar, reliable properties' : 'Open to some adventure',
      traits.social >= 0.7 ? 'Enjoys social atmospheres and communal spaces' :
        traits.social <= 0.3 ? 'Prefers privacy and quiet' : 'Balanced social needs',
      traits.culture >= 0.7 ? 'Seeks culturally immersive experiences' :
        traits.culture <= 0.3 ? 'Prioritizes convenience over culture' : 'Appreciates cultural context',
      traits.authenticity >= 0.7 ? 'Strongly prefers locally-owned, character properties' :
        traits.authenticity <= 0.3 ? 'Fine with international chains' : 'Some preference for local character',
      traits.pace >= 0.7 ? 'Wants central location for fast exploration' :
        traits.pace <= 0.3 ? 'Happy with quieter, removed locations' : 'Flexible on location centrality',
      traits.planning <= 0.3 ? 'Needs hassle-free booking and services' :
        traits.planning >= 0.7 ? 'Comfortable planning and coordinating' : 'Average planning tolerance',
    ].join('. ');

    const archetypeContext = primaryArchetype ? `Their travel archetype is "${primaryArchetype}".` : '';
    const tripContext = tripType ? `This is a ${tripType} trip.` : '';

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a luxury travel concierge AI that recommends ideal hotel types for travelers based on their personality profile. You have deep knowledge of neighborhoods, hotel styles, and local character for destinations worldwide. Always return practical, real-world recommendations.`;

    const userPrompt = `For a traveler going to ${destination}:

Personality Profile:
${traitSummary}
${archetypeContext}
${tripContext}

Budget: ${tier} tier ($${priceRange.min}-$${priceRange.max}/night)

Recommend their ideal hotel profile. Think about:
1. Which hotel TYPES suit them best (boutique, chain, hostel, resort, ryokan, riad, villa, apartment, etc.)
2. Which specific NEIGHBORHOODS in ${destination} match their style (name 2-4 real neighborhoods)
3. Which AMENITIES matter most to them
4. What types to AVOID
5. Search keywords that would find their ideal property`;

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
              name: "recommend_hotel_profile",
              description: "Return the ideal hotel profile for this traveler and destination",
              parameters: {
                type: "object",
                properties: {
                  idealTypes: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-3 hotel types that best fit (e.g., boutique, riad, resort)",
                  },
                  idealNeighborhoods: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-4 specific real neighborhood names in the destination",
                  },
                  idealAmenities: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-6 amenities that matter most (e.g., rooftop bar, spa, pool)",
                  },
                  styleDescription: {
                    type: "string",
                    description: "1-2 sentence natural language description of their ideal stay",
                  },
                  avoidTypes: {
                    type: "array",
                    items: { type: "string" },
                    description: "Hotel types to avoid (e.g., hostel, chain)",
                  },
                  searchKeywords: {
                    type: "array",
                    items: { type: "string" },
                    description: "3-5 search terms to find ideal properties (e.g., 'design hotel', 'historic charm')",
                  },
                },
                required: ["idealTypes", "idealNeighborhoods", "idealAmenities", "styleDescription", "avoidTypes", "searchKeywords"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recommend_hotel_profile" } },
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
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("[ProfileIdealHotel] AI error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResult = await response.json();
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall?.function?.arguments) {
      console.error("[ProfileIdealHotel] No tool call in response");
      throw new Error("AI did not return structured output");
    }

    const parsed = typeof toolCall.function.arguments === 'string'
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;

    const profile: IdealHotelProfile = {
      idealTypes: parsed.idealTypes || [],
      idealNeighborhoods: parsed.idealNeighborhoods || [],
      idealAmenities: parsed.idealAmenities || [],
      priceRange,
      styleDescription: parsed.styleDescription || '',
      avoidTypes: parsed.avoidTypes || [],
      searchKeywords: parsed.searchKeywords || [],
    };

    // Cache the result
    if (userId) {
      await cacheProfile(userId, destination, profile);
    }

    return new Response(JSON.stringify({ success: true, profile }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[ProfileIdealHotel] Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
