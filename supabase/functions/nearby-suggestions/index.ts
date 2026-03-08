import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NearbyRequest {
  lat: number;
  lng: number;
  category: 'coffee' | 'food' | 'wander' | 'drinks' | 'snacks' | 'nightlife' | 'attractions' | 'events';
  archetype?: string;
  timeOfDay?: 'morning' | 'afternoon' | 'evening' | 'night';
  radiusMeters?: number;
  query?: string;
}

// Archetype-specific preferences for filtering
const ARCHETYPE_PREFERENCES: Record<string, {
  vibes: string[];
  avoid: string[];
  prioritize: string[];
}> = {
  slow_traveler: {
    vibes: ['cozy', 'quiet', 'local', 'authentic', 'unhurried'],
    avoid: ['chain', 'tourist trap', 'crowded', 'fast food'],
    prioritize: ['ambiance', 'seating', 'local favorite'],
  },
  adrenaline_architect: {
    vibes: ['quick', 'fuel', 'efficient', 'energy'],
    avoid: ['slow service', 'pretentious'],
    prioritize: ['speed', 'portions', 'caffeine'],
  },
  culinary_cartographer: {
    vibes: ['authentic', 'local specialty', 'hidden gem', 'chef-driven'],
    avoid: ['generic', 'tourist menu', 'chain'],
    prioritize: ['food quality', 'local ingredients', 'unique dishes'],
  },
  cultural_anthropologist: {
    vibes: ['historic', 'local institution', 'neighborhood staple', 'story'],
    avoid: ['generic', 'new chain'],
    prioritize: ['history', 'character', 'local patrons'],
  },
  urban_nomad: {
    vibes: ['trendy', 'cool', 'design', 'instagram-worthy'],
    avoid: ['dated', 'touristy'],
    prioritize: ['vibe', 'people watching', 'location'],
  },
  retreat_regular: {
    vibes: ['peaceful', 'comfortable', 'relaxed', 'quiet'],
    avoid: ['loud', 'crowded', 'hectic'],
    prioritize: ['seating', 'calm', 'no rush'],
  },
  zen_seeker: {
    vibes: ['mindful', 'healthy', 'serene', 'natural'],
    avoid: ['chaotic', 'processed', 'noisy'],
    prioritize: ['healthy options', 'quiet', 'outdoor seating'],
  },
  social_butterfly: {
    vibes: ['lively', 'communal', 'social', 'bustling'],
    avoid: ['dead', 'isolated'],
    prioritize: ['atmosphere', 'bar seating', 'group friendly'],
  },
  flexible_wanderer: {
    vibes: ['interesting', 'unexpected', 'local', 'spontaneous'],
    avoid: ['obvious', 'planned', 'touristy'],
    prioritize: ['discovery', 'off-beaten-path', 'serendipity'],
  },
};

const CATEGORY_PROMPTS: Record<string, string> = {
  coffee: 'cafes, coffee shops, tea houses, bakeries with coffee',
  food: 'restaurants, local eateries, food halls, street food spots',
  wander: 'interesting streets, parks, viewpoints, neighborhoods to explore',
  drinks: 'bars, wine bars, cocktail lounges, beer gardens, pubs',
  snacks: 'bakeries, ice cream, street food, quick bites',
  nightlife: 'comedy clubs, live music venues, jazz clubs, dance clubs, nightclubs, karaoke bars, rooftop bars, late-night lounges, speakeasies, entertainment venues',
  attractions: 'museums, galleries, landmarks, monuments, historic sites, architectural wonders, observation decks, theaters, cultural centers',
  events: 'live performances, concerts, local festivals, pop-up events, theater shows, sporting events, markets, street performances happening now or soon',
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: NearbyRequest = await req.json();
    const { lat, lng, category, archetype, timeOfDay, radiusMeters = 800, query } = body;

    if (!lat || !lng || !category) {
      return new Response(
        JSON.stringify({ error: "lat, lng, and category are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Get archetype preferences
    const prefs = archetype ? ARCHETYPE_PREFERENCES[archetype] || ARCHETYPE_PREFERENCES.flexible_wanderer : ARCHETYPE_PREFERENCES.flexible_wanderer;
    const categoryContext = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.food;

    // Build query context if a natural language query was provided
    const queryContext = query
      ? `\nUSER QUERY: "${query}"\nThe user is looking for something specific. Prioritize results matching their intent over strict category filters. Interpret their request broadly — if they ask about "tonight" or "what's happening", focus on entertainment, nightlife, live events, and things to do rather than just restaurants.`
      : '';

    const systemPrompt = `You are a local expert finding nearby ${category} spots for travelers.

LOCATION: ${lat}, ${lng}
RADIUS: ${radiusMeters}m walking distance
TIME: ${timeOfDay || 'current time'}
CATEGORY: ${categoryContext}
${queryContext}

TRAVELER STYLE (${archetype || 'flexible_wanderer'}):
- Vibes they love: ${prefs.vibes.join(', ')}
- Things to avoid: ${prefs.avoid.join(', ')}
- Prioritize: ${prefs.prioritize.join(', ')}

Generate 4-6 nearby suggestions that match this traveler's style.
For each, provide a personalized "whyForYou" explaining why THIS traveler would love it based on their archetype.

CRITICAL: 
- Use REAL places that actually exist near these coordinates
- Estimate realistic walking times and distances
- Be specific about what makes each place special for this archetype
- For nightlife/events queries: focus on ENTERTAINMENT venues (comedy, music, clubs, shows) NOT restaurants
- For attractions: focus on cultural/sightseeing experiences NOT food

OUTPUT FORMAT (JSON only, no markdown):
{
  "suggestions": [
    {
      "id": "unique-slug",
      "name": "Place Name",
      "category": "${category}",
      "description": "Brief description (15-25 words)",
      "whyForYou": "Archetype-specific reason (10-20 words)",
      "distance": "400m",
      "walkTime": "5 min",
      "priceLevel": 2,
      "rating": 4.5,
      "isOpen": true,
      "address": "Street address"
    }
  ]
}`;

    const userMessage = query
      ? `The user asked: "${query}". Find relevant options within ${radiusMeters}m of coordinates ${lat}, ${lng}`
      : `Find nearby ${category} options within ${radiusMeters}m of coordinates ${lat}, ${lng}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage }
        ],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const aiResponse = await response.json();
    const content = aiResponse.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Parse error:", parseError, "Content:", content);
      throw new Error("Failed to parse AI response");
    }

    return new Response(JSON.stringify({
      suggestions: parsed.suggestions || [],
      category,
      archetype: archetype || 'flexible_wanderer',
      radiusMeters,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("nearby-suggestions error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Suggestion lookup failed", code: "SUGGESTIONS_ERROR" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
