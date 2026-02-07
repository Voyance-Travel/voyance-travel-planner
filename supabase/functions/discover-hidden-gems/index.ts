import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Hidden Gems Discovery Engine
 * 
 * 5 Discovery Layers:
 * 1. DNA-Personalized Search — archetype-specific queries
 * 2. Reddit/Forum Mining — local subreddit & forum recommendations
 * 3. Time-Gated Intelligence — new spots not yet touristy (18-36mo old)
 * 4. Non-English Sources — local language blogs/reviews
 * 5. Reverse Geolocation — cluster discovery around known good spots
 */

interface HiddenGem {
  name: string;
  category: string; // restaurant, cafe, museum, trail, market, gallery, bar, experience
  neighborhood: string;
  whyHidden: string; // Why most tourists miss this
  whyFitsYou: string; // DNA-personalized reason
  discoveryLayer: string; // Which layer found it
  confidenceSignals: string[]; // e.g. "4.8★ with 800 reviews", "Mentioned in r/lisbon"
  tip: string; // Insider tip for visiting
  priceRange?: string;
  bestTime?: string;
}

interface DiscoveryRequest {
  destination: string;
  country?: string;
  archetypeName: string;
  secondaryArchetype?: string;
  interests?: string[];
  diningStyle?: string;
  budgetTier?: string;
  travelPace?: string;
  tripDuration?: number;
  isFirstVisit?: boolean;
}

// Archetype-specific search angle mappings
const ARCHETYPE_SEARCH_ANGLES: Record<string, {
  focus: string;
  searchTerms: string[];
  avoidTerms: string[];
  sourceHints: string[];
}> = {
  cultural_anthropologist: {
    focus: "cultural immersion, local traditions, artisan workshops",
    searchTerms: ["artisan workshop", "cultural center", "traditional craft", "local tradition", "community gathering"],
    avoidTerms: ["tourist show", "commercialized", "souvenir shop"],
    sourceHints: ["cultural blogs", "art journals", "heritage society pages"],
  },
  collection_curator: {
    focus: "hidden museums, private galleries, rare archives, curated collections",
    searchTerms: ["private collection", "hidden gallery", "independent museum", "rare archive", "art space"],
    avoidTerms: ["gift shop museum", "mainstream gallery"],
    sourceHints: ["academic art blogs", "museum journals", "architecture forums"],
  },
  adrenaline_architect: {
    focus: "undiscovered trails, local adventure spots, extreme experiences",
    searchTerms: ["secret trail", "local climbing spot", "unmarked path", "adventure experience", "wild swimming"],
    avoidTerms: ["tourist zip-line", "guided bus tour"],
    sourceHints: ["climbing forums", "trail running blogs", "outdoor adventure subreddits"],
  },
  slow_traveler: {
    focus: "neighborhood cafés, local hangouts, authentic daily life",
    searchTerms: ["neighborhood cafe", "local hangout", "family-run", "regulars spot", "morning ritual"],
    avoidTerms: ["Instagram cafe", "tourist area", "chain restaurant"],
    sourceHints: ["local neighborhood blogs", "slow travel forums", "expat communities"],
  },
  culinary_explorer: {
    focus: "family-run restaurants, food markets, cooking traditions, street food",
    searchTerms: ["family recipe", "local market", "street food stall", "traditional kitchen", "food artisan"],
    avoidTerms: ["Michelin-listed", "hotel restaurant", "tourist menu"],
    sourceHints: ["food blogs", "r/foodie", "local food Instagram", "Eater guides"],
  },
  explorer: {
    focus: "off-the-beaten-path discoveries, unexpected experiences, local secrets",
    searchTerms: ["hidden spot", "local secret", "undiscovered", "off beaten path", "unexpected find"],
    avoidTerms: ["top 10 list", "most popular", "tourist attraction"],
    sourceHints: ["travel forums", "backpacker blogs", "local subreddits"],
  },
  luxury_connoisseur: {
    focus: "exclusive experiences, private access, bespoke services",
    searchTerms: ["private dining", "exclusive access", "bespoke experience", "members-only", "intimate venue"],
    avoidTerms: ["mass tourism", "budget option", "backpacker"],
    sourceHints: ["luxury travel magazines", "concierge recommendations", "private club forums"],
  },
  social_butterfly: {
    focus: "vibrant nightlife, social venues, community events, group experiences",
    searchTerms: ["local bar scene", "community event", "live music venue", "social gathering", "popup event"],
    avoidTerms: ["tourist bar", "overpriced club"],
    sourceHints: ["nightlife blogs", "event listings", "local social media"],
  },
};

const DEFAULT_SEARCH_ANGLE = {
  focus: "authentic local experiences, hidden spots, genuine recommendations",
  searchTerms: ["local favorite", "hidden gem", "neighborhood spot", "authentic experience"],
  avoidTerms: ["tourist trap", "overrated", "overcrowded"],
  sourceHints: ["local subreddits", "travel forums", "food blogs"],
};

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: DiscoveryRequest = await req.json().catch(() => ({} as DiscoveryRequest));
    
    if (!body.destination) {
      return new Response(JSON.stringify({ error: "Destination is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const PERPLEXITY_API_KEY = Deno.env.get("PERPLEXITY_API_KEY");
    if (!PERPLEXITY_API_KEY) {
      return new Response(JSON.stringify({ error: "Search API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[hidden-gems] Discovering gems for ${body.destination} | archetype: ${body.archetypeName}`);

    // Resolve archetype search angles
    const archetypeKey = body.archetypeName?.toLowerCase().replace(/\s+/g, '_') || 'explorer';
    const searchAngle = ARCHETYPE_SEARCH_ANGLES[archetypeKey] || DEFAULT_SEARCH_ANGLE;
    
    // Secondary archetype for blended searches
    const secondaryKey = body.secondaryArchetype?.toLowerCase().replace(/\s+/g, '_');
    const secondaryAngle = secondaryKey ? ARCHETYPE_SEARCH_ANGLES[secondaryKey] : null;

    const destination = body.destination;
    const country = body.country || '';
    const fullDest = country ? `${destination}, ${country}` : destination;

    // Run all 5 discovery layers in parallel via Perplexity
    const discoveryPromises = [
      // LAYER 1: DNA-Personalized Search
      callPerplexity(PERPLEXITY_API_KEY, {
        system: `You are a hyper-personalized travel discovery engine. You find places that specifically match a traveler's unique personality and style. 

RETURN ONLY a JSON array of objects, each with: name, category, neighborhood, whyHidden, whyFitsYou, confidenceSignals (array), tip, priceRange, bestTime.
No markdown. No explanation. Just the JSON array.`,
        user: `Find 3-4 hidden gems in ${fullDest} specifically for a "${body.archetypeName}" traveler.

Their focus: ${searchAngle.focus}
${secondaryAngle ? `Secondary interest: ${secondaryAngle.focus}` : ''}
${body.interests?.length ? `Personal interests: ${body.interests.join(', ')}` : ''}
${body.diningStyle ? `Dining preference: ${body.diningStyle}` : ''}
${body.budgetTier ? `Budget: ${body.budgetTier}` : ''}
${body.isFirstVisit ? 'This is their FIRST visit — include 1 iconic spot done the non-touristy way.' : 'They have been before — skip ALL obvious attractions.'}

SEARCH for: ${searchAngle.searchTerms.join(', ')}
AVOID: ${searchAngle.avoidTerms.join(', ')}
Look in: ${searchAngle.sourceHints.join(', ')}

Each result MUST have <5K Google reviews (truly hidden, not mainstream).
Each whyFitsYou must reference the "${body.archetypeName}" archetype specifically.`,
      }),

      // LAYER 2: Reddit/Forum Mining
      callPerplexity(PERPLEXITY_API_KEY, {
        system: `You are a Reddit and travel forum researcher. You find recommendations from actual locals and experienced travelers — NOT from travel blogs or mainstream media.

RETURN ONLY a JSON array of objects, each with: name, category, neighborhood, whyHidden, whyFitsYou, confidenceSignals (array), tip, priceRange, bestTime.
No markdown. No explanation. Just the JSON array.`,
        user: `Search Reddit (r/${destination.toLowerCase().replace(/\s+/g, '')}, r/travel, r/solotravel, r/foodie) and travel forums for hidden gem recommendations in ${fullDest}.

Find 3-4 places that:
- Were recommended by locals or repeat visitors in the last 12 months
- Have <5K Google reviews but high ratings (4.5+)
- Are NOT in mainstream travel guides or "Top 10" lists
- Are NOT Michelin-starred or chain restaurants
- Include family-run restaurants, local bars, markets, or unique experiences

For whyFitsYou, explain how this matches a "${body.archetypeName}" traveler.
For confidenceSignals, cite specific sources like "recommended in r/lisbon 3 months ago" or "4.8★ with 650 reviews".`,
      }),

      // LAYER 3: Time-Gated Intelligence (new but not yet touristy)
      callPerplexity(PERPLEXITY_API_KEY, {
        system: `You are a "new discovery" specialist. You find restaurants, cafes, and experiences that opened recently (1-3 years ago), get excellent local reviews, but haven't hit the tourist radar yet.

RETURN ONLY a JSON array of objects, each with: name, category, neighborhood, whyHidden, whyFitsYou, confidenceSignals (array), tip, priceRange, bestTime.
No markdown. No explanation. Just the JSON array.`,
        user: `Find 2-3 relatively new spots in ${fullDest} that:
- Opened in the last 1-3 years
- Have 4.7+ Google rating
- Have <3K reviews (not yet famous)
- Are gaining traction among locals (mentioned on local food Instagram or neighborhood blogs)
- Are NOT yet in major travel guides

Focus on restaurants, cafes, wine bars, or experience-based venues.
For a "${body.archetypeName}" traveler who values: ${searchAngle.focus}.
For whyFitsYou, explain the specific appeal to this archetype.`,
      }),

      // LAYER 4: Non-English Language Sources
      callPerplexity(PERPLEXITY_API_KEY, {
        system: `You are a multilingual travel researcher who finds gems mentioned in local-language sources that English-speaking tourists miss entirely.

RETURN ONLY a JSON array of objects, each with: name, category, neighborhood, whyHidden, whyFitsYou, confidenceSignals (array), tip, priceRange, bestTime.
No markdown. No explanation. Just the JSON array.`,
        user: `Search non-English sources (local food blogs, regional review sites, local Instagram accounts) for hidden gems in ${fullDest}.

Find 2-3 places that:
- Are recommended in local-language publications or social media
- Are largely unknown to English-speaking tourists
- Have authentic local character (not internationalized for tourists)
- Are family-run or independent businesses

For a "${body.archetypeName}" traveler.
For confidenceSignals, cite the local-language source (e.g., "Featured in El Comidista", "Popular on local Instagram @username").
For tip, include any local customs or ordering advice.`,
      }),

      // LAYER 5: Reverse Geolocation / Cluster Discovery
      callPerplexity(PERPLEXITY_API_KEY, {
        system: `You are a neighborhood discovery specialist. You find hidden gem clusters — areas where multiple great spots exist close together, creating a walkable discovery zone.

RETURN ONLY a JSON array of objects, each with: name, category, neighborhood, whyHidden, whyFitsYou, confidenceSignals (array), tip, priceRange, bestTime.
No markdown. No explanation. Just the JSON array.`,
        user: `Find 2-3 hidden gems in ${fullDest} that are clustered in the same lesser-known neighborhoods.

Requirements:
- Choose neighborhoods that tourists rarely visit
- Each spot should have <2K Google reviews
- Spots should be within walking distance of each other (same neighborhood)
- Has been open 2+ years (established, not hype)
- NOT on TripAdvisor top 100 for ${destination}

For a "${body.archetypeName}" traveler who values: ${searchAngle.focus}.
For each gem, mention what other gems are nearby in the tip field.`,
      }),
    ];

    const results = await Promise.allSettled(discoveryPromises);

    const layerNames = [
      'DNA-Personalized',
      'Reddit/Forum Mining', 
      'Time-Gated Intelligence',
      'Non-English Sources',
      'Cluster Discovery',
    ];

    const allGems: HiddenGem[] = [];
    const layerStats: Record<string, number> = {};

    results.forEach((result, idx) => {
      const layerName = layerNames[idx];
      if (result.status === 'fulfilled' && result.value) {
        const gems = result.value.map((g: any) => ({
          ...g,
          discoveryLayer: layerName,
        }));
        allGems.push(...gems);
        layerStats[layerName] = gems.length;
        console.log(`[hidden-gems] Layer "${layerName}": ${gems.length} gems found`);
      } else {
        layerStats[layerName] = 0;
        const reason = result.status === 'rejected' ? result.reason : 'empty';
        console.warn(`[hidden-gems] Layer "${layerName}" failed:`, reason);
      }
    });

    // Deduplicate by name similarity
    const deduped = deduplicateGems(allGems);

    console.log(`[hidden-gems] Total: ${allGems.length} raw → ${deduped.length} deduped gems for ${destination}`);

    return new Response(JSON.stringify({
      gems: deduped,
      layerStats,
      destination: fullDest,
      archetype: body.archetypeName,
      totalFound: deduped.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[hidden-gems] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function callPerplexity(
  apiKey: string,
  prompt: { system: string; user: string }
): Promise<HiddenGem[]> {
  const response = await fetch('https://api.perplexity.ai/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'sonar',
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[hidden-gems] Perplexity error ${response.status}:`, text);
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content?.trim() || '';

  try {
    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return Array.isArray(parsed) ? parsed : [];
    }
    return [];
  } catch (parseErr) {
    console.warn('[hidden-gems] Failed to parse Perplexity response:', parseErr);
    return [];
  }
}

function deduplicateGems(gems: HiddenGem[]): HiddenGem[] {
  const seen = new Map<string, HiddenGem>();
  
  for (const gem of gems) {
    const normalizedName = gem.name?.toLowerCase().replace(/[^a-z0-9]/g, '') || '';
    if (!normalizedName) continue;
    
    // Check for similar names (first 8 chars match = likely duplicate)
    let isDupe = false;
    for (const [key] of seen) {
      if (key.startsWith(normalizedName.slice(0, 8)) || normalizedName.startsWith(key.slice(0, 8))) {
        isDupe = true;
        break;
      }
    }
    
    if (!isDupe) {
      seen.set(normalizedName, gem);
    }
  }
  
  return Array.from(seen.values());
}
