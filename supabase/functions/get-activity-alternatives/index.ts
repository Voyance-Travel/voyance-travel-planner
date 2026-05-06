import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { fetchTravelerDNA, buildCompactDNASummary, type TravelerDNA } from "../_shared/traveler-dna.ts";
// Inlined from generate-itinerary/fix-placeholders.ts (edge functions can't import across sibling function dirs at deploy time)
const AI_STUB_VENUE_PATTERNS: RegExp[] = [
  /^(le |la |il |el )?(table|bistrot|brasserie|caf[eé]|comptoir|boulangerie|p[âa]tisserie|trattoria|osteria|taverna|restaurant|maison|petit|grand|bar|cave)\s+(du|de la|des|de|del|della|dei)\s+(quartier|march[ée]|coin|place|soir|midi|matin|gare|arts|jardin|vins|coeur|nord|sud|est|ouest|centre|village|port|pont)\b/i,
  /^(le |la )?(petit|petite|grand|grande|caf[eé])\s+(matin|matinal|matinale|soir|midi|jardin|comptoir|march[ée]|place|coin)\b/i,
  /^(caf[eé] matinal|boulangerie du quartier|le petit matin|caf[eé] des arts|p[âa]tisserie du coin|bistrot du march[ée]|le comptoir du midi|brasserie du coin|caf[eé] de la place|table du quartier|restaurant le jardin|la table du soir|le petit comptoir|brasserie de la gare|restaurant du march[ée]|le bar du coin|comptoir des vins|le petit bar|bar de la place|cave [àa] vins)$/i,
];
function matchesAIStubVenue(name: string): boolean {
  return AI_STUB_VENUE_PATTERNS.some((re) => re.test((name || '').trim()));
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface RequestBody {
  currentActivity: {
    id: string;
    name: string;
    type: string;
    description?: string;
    time?: string;
  };
  destination?: string;
  searchQuery?: string;
  excludeActivities?: string[];
  suggestionMode?: 'similar' | 'different' | 'filter';
  tripId?: string;
}

interface AlternativeActivity {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: string;
  estimatedCost: number;
  location: string;
  rating: number;
  matchScore: number;
  whyRecommended: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { currentActivity, destination, searchQuery, excludeActivities, suggestionMode, tripId } = body;

    console.log('[alt] mode=%s query=%s activity=%s', suggestionMode, searchQuery, currentActivity.name);

    // Fetch Traveler DNA for personalized alternatives
    let travelerDNA: TravelerDNA | null = null;
    
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader || '' } } }
    );
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id || null;
    }

    if (!userId && tripId) {
      const { data: trip } = await supabase
        .from('trips')
        .select('user_id')
        .eq('id', tripId)
        .maybeSingle();
      userId = trip?.user_id || null;
    }

    // Fetch DNA with a 3s timeout to avoid blocking
    if (userId) {
      try {
        const dnaPromise = fetchTravelerDNA(supabase, userId);
        const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
        const dnaResult = await Promise.race([dnaPromise, timeoutPromise]);
        if (dnaResult && typeof dnaResult === 'object' && 'hasData' in dnaResult && dnaResult.hasData) {
          travelerDNA = dnaResult.dna;
        }
      } catch (dnaError) {
        console.warn('[alt] DNA fetch failed:', dnaError);
      }
    }

    let alternatives: AlternativeActivity[];
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (LOVABLE_API_KEY) {
      try {
        // Use AbortController so we can truly cancel the AI fetch on timeout
        const aiAbort = new AbortController();
        const timer = setTimeout(() => aiAbort.abort(), 12_000);

        const aiPromise = getAIAlternatives(
          currentActivity, 
          destination, 
          searchQuery, 
          LOVABLE_API_KEY, 
          excludeActivities,
          suggestionMode,
          travelerDNA,
          aiAbort.signal,
        );

        try {
          alternatives = await aiPromise;
          clearTimeout(timer);
          console.log('[alt] AI ok, %d results', alternatives.length);
        } catch (aiErr) {
          clearTimeout(timer);
          if (aiAbort.signal.aborted) {
            console.warn('[alt] AI timed out, using templates');
          } else {
            console.error('[alt] AI error, using templates:', aiErr);
          }
          alternatives = generateTemplateAlternatives(currentActivity, destination, searchQuery, suggestionMode);
        }
      } catch (outerErr) {
        console.error('[alt] Outer AI error:', outerErr);
        alternatives = generateTemplateAlternatives(currentActivity, destination, searchQuery, suggestionMode);
      }
    } else {
      console.log('[alt] No API key, using templates');
      alternatives = generateTemplateAlternatives(currentActivity, destination, searchQuery, suggestionMode);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alternatives,
        meta: {
          query: searchQuery,
          basedOn: currentActivity.name,
          destination,
          suggestionMode,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[alt] Error:', errorMessage);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        alternatives: [] 
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

async function getAIAlternatives(
  activity: RequestBody['currentActivity'],
  destination?: string,
  searchQuery?: string,
  apiKey?: string,
  excludeActivities?: string[],
  suggestionMode?: string,
  travelerDNA?: TravelerDNA | null,
  signal?: AbortSignal,
): Promise<AlternativeActivity[]> {
  const locationName = destination || 'the destination';
  const activityType = activity.type || 'activity';
  
  const exclusionNote = excludeActivities && excludeActivities.length > 0
    ? `\n\nIMPORTANT: Do NOT suggest any of these places (already in the traveler's itinerary):\n- ${excludeActivities.join('\n- ')}`
    : '';

  // Build DNA context for personalized suggestions
  let dnaContext = '';
  if (travelerDNA) {
    const dnaSummary = buildCompactDNASummary(travelerDNA);
    dnaContext = `\n\n## TRAVELER PROFILE\n${dnaSummary}\n\nALL suggestions must align with this traveler's preferences and style.`;
    
    const guidelines: string[] = [];
    if (Math.abs(travelerDNA.traits.adventure) >= 4) {
      guidelines.push(travelerDNA.traits.adventure < 0 
        ? 'Suggest safe, comfortable, well-reviewed options' 
        : 'Include adventurous, unique, off-beaten-path options');
    }
    if (Math.abs(travelerDNA.traits.authenticity) >= 4) {
      guidelines.push(travelerDNA.traits.authenticity < 0 
        ? 'Tourist-friendly locations are fine' 
        : 'Prioritize local favorites over tourist spots');
    }
    if (Math.abs(travelerDNA.traits.comfort) >= 4) {
      guidelines.push(travelerDNA.traits.comfort < 0 
        ? 'Prioritize budget-friendly options' 
        : 'Include premium/luxury options');
    }
    if (Math.abs(travelerDNA.traits.social) >= 4) {
      guidelines.push(travelerDNA.traits.social < 0 
        ? 'Prefer quieter, intimate venues' 
        : 'Include social, lively venues');
    }
    if (travelerDNA.dietaryRestrictions.length > 0) {
      guidelines.push(`Dietary: ${travelerDNA.dietaryRestrictions.join(', ')}`);
    }
    if (travelerDNA.interests.length > 0) {
      guidelines.push(`Interests: ${travelerDNA.interests.slice(0, 4).join(', ')}`);
    }
    
    if (guidelines.length > 0) {
      dnaContext += `\n\nKey preferences:\n- ${guidelines.join('\n- ')}`;
    }
  }

  let userPrompt: string;
  let systemPrompt: string;

  if (suggestionMode === 'different' || searchQuery === 'completely_different') {
    userPrompt = `The traveler has "${activity.name}" (${activityType}) in their itinerary but wants something COMPLETELY DIFFERENT.
    
Suggest 4 activities in ${locationName} that are:
- Different category/type than ${activityType}
- Different vibe and experience style
- Variety of price points
- Mix of popular and hidden gems

Do NOT suggest anything similar to ${activity.name}.${exclusionNote}${dnaContext}`;

    systemPrompt = `You are a creative travel expert who helps travelers discover unexpected experiences.
Generate 4 diverse activity alternatives that break from the traveler's current choice.
Think outside the box - if they have a museum, suggest a food tour. If they have hiking, suggest a spa.
Each suggestion should feel like a fresh, exciting alternative that matches the traveler's profile.`;

  } else if (searchQuery && searchQuery !== 'completely_different') {
    userPrompt = `Find 4 activities matching: "${searchQuery}" in ${locationName}.

The traveler is replacing "${activity.name}" and looking for something specific.
Focus on real, bookable experiences that match their search.${exclusionNote}${dnaContext}`;

    systemPrompt = `You are a travel activity recommendation expert for ${locationName}.
Generate 4 activities that match the user's search criteria AND their profile.
Include a mix of:
- Popular well-reviewed options
- Hidden gems and local favorites
- Different price points
Be specific with real place names and locations.`;

  } else {
    userPrompt = `Find 4 alternative activities SIMILAR to "${activity.name}" (${activityType}) in ${locationName}.

Suggest activities that:
- Are the same general category/type
- Offer a similar experience level
- Vary in price (budget, mid-range, premium options)
- Include both popular and lesser-known alternatives${exclusionNote}${dnaContext}`;

    systemPrompt = `You are a travel activity recommendation expert for ${locationName}.
Generate 4 alternatives similar to the current activity but offering variety that matches the traveler's style.
Include:
- A premium/upgraded version of the experience
- A budget-friendly alternative
- A local hidden gem in the same category
- A popular alternative with great reviews
Be specific with real place names when possible.`;
  }

  // Pass signal to fetch so the request is truly aborted on timeout
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    signal,
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "suggest_activities",
            description: "Return 4 alternative activity suggestions for the traveler.",
            parameters: {
              type: "object",
              properties: {
                activities: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string", description: "Activity name - be specific with real place names" },
                      description: { type: "string", description: "Brief description (1-2 sentences)" },
                      category: { type: "string", description: "Category: dining, cultural, adventure, relaxation, shopping, nightlife, tours, nature" },
                      estimatedDuration: { type: "string", description: "Duration like '2 hours' or '3.5 hours'" },
                      estimatedCost: { type: "number", description: "Cost in USD" },
                      location: { type: "string", description: "Specific location or area name" },
                      rating: { type: "number", description: "Rating from 4.0 to 5.0" },
                      matchScore: { type: "number", description: "How well it matches the request, 70-99" },
                      whyRecommended: { type: "string", description: "One sentence explaining why this is recommended" },
                      distanceFromOriginal: { type: "string", description: "Estimated distance from the original activity, e.g. '0.8 km away' or '2.5 km away'" },
                      walkTimeFromOriginal: { type: "string", description: "Estimated walking time from the original activity, e.g. '10 min walk' or '30 min by transit'" }
                    },
                    required: ["name", "description", "category", "estimatedDuration", "estimatedCost", "location", "rating", "matchScore", "whyRecommended"],
                    additionalProperties: false
                  }
                }
              },
              required: ["activities"],
              additionalProperties: false
            }
          }
        }
      ],
      tool_choice: { type: "function", function: { name: "suggest_activities" } },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[alt] AI error:', response.status, errorText);
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error('No tool call response from AI');
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  const activities = parsed.activities || [];

  // Filter out AI stub venue names ("Table du Quartier", "Café Matinal", etc.)
  // — never suggest these to users per the Meal Rules core memory.
  const filtered = activities.filter((act: Omit<AlternativeActivity, 'id'>) => {
    const cat = (act.category || '').toLowerCase();
    if (!(cat.includes('dining') || cat.includes('food') || cat.includes('restaurant'))) return true;
    if (matchesAIStubVenue(act.name || '') || matchesAIStubVenue(act.location || '')) {
      console.warn('[alt] dropped AI stub venue suggestion:', act.name);
      return false;
    }
    return true;
  });

  return filtered.map((act: Omit<AlternativeActivity, 'id'>, idx: number) => ({
    ...act,
    id: `ai-alt-${Date.now()}-${idx}`,
  }));
}

function generateTemplateAlternatives(
  activity: RequestBody['currentActivity'],
  destination?: string,
  searchQuery?: string,
  suggestionMode?: string
): AlternativeActivity[] {
  const activityType = activity.type?.toLowerCase() || 'activity';
  const locationName = destination || 'the area';

  if (suggestionMode === 'different' || searchQuery === 'completely_different') {
    const differentOptions: AlternativeActivity[] = [
      {
        id: `diff-1-${Date.now()}`,
        name: `Local Food Tour in ${locationName}`,
        description: 'Explore the culinary scene with tastings at multiple local spots.',
        category: 'dining',
        estimatedDuration: '3 hours',
        estimatedCost: 75,
        location: 'Various locations',
        rating: 4.8,
        matchScore: 85,
        whyRecommended: 'A completely different experience to explore local flavors',
      },
      {
        id: `diff-2-${Date.now()}`,
        name: `Sunset Boat Cruise`,
        description: 'Relax on the water with stunning views as the sun sets.',
        category: 'relaxation',
        estimatedDuration: '2 hours',
        estimatedCost: 65,
        location: 'Waterfront',
        rating: 4.7,
        matchScore: 82,
        whyRecommended: 'Peaceful alternative with beautiful scenery',
      },
      {
        id: `diff-3-${Date.now()}`,
        name: `Artisan Market & Shopping`,
        description: 'Browse unique handcrafted goods and local products.',
        category: 'shopping',
        estimatedDuration: '2.5 hours',
        estimatedCost: 0,
        location: 'Market District',
        rating: 4.5,
        matchScore: 78,
        whyRecommended: 'Discover local crafts and take home unique souvenirs',
      },
      {
        id: `diff-4-${Date.now()}`,
        name: `Spa & Wellness Experience`,
        description: 'Rejuvenate with a relaxing spa treatment or massage.',
        category: 'relaxation',
        estimatedDuration: '2 hours',
        estimatedCost: 95,
        location: 'Wellness Center',
        rating: 4.9,
        matchScore: 80,
        whyRecommended: 'Perfect for unwinding and self-care',
      },
    ];
    return differentOptions;
  }

  if (searchQuery) {
    const query = searchQuery.toLowerCase();
    let category = 'activity';
    let baseName = searchQuery;

    if (query.includes('food') || query.includes('dining') || query.includes('restaurant')) {
      category = 'dining';
      baseName = 'Culinary';
    } else if (query.includes('outdoor') || query.includes('nature') || query.includes('hiking')) {
      category = 'adventure';
      baseName = 'Outdoor';
    } else if (query.includes('wine') || query.includes('drinks') || query.includes('bar')) {
      category = 'dining';
      baseName = 'Wine & Drinks';
    } else if (query.includes('art') || query.includes('museum') || query.includes('culture')) {
      category = 'cultural';
      baseName = 'Art & Culture';
    } else if (query.includes('shopping') || query.includes('market')) {
      category = 'shopping';
      baseName = 'Shopping';
    } else if (query.includes('spa') || query.includes('relax') || query.includes('wellness')) {
      category = 'relaxation';
      baseName = 'Wellness';
    } else if (query.includes('photo') || query.includes('scenic') || query.includes('instagram')) {
      category = 'tours';
      baseName = 'Photo Tour';
    }

    return [
      {
        id: `search-1-${Date.now()}`,
        name: `${baseName} Experience in ${locationName}`,
        description: `A curated ${baseName.toLowerCase()} experience with local highlights.`,
        category,
        estimatedDuration: '2-3 hours',
        estimatedCost: 65,
        location: locationName,
        rating: 4.7,
        matchScore: 92,
        whyRecommended: `Top-rated ${baseName.toLowerCase()} option`,
      },
      {
        id: `search-2-${Date.now()}`,
        name: `Premium ${baseName} Tour`,
        description: `An upscale ${baseName.toLowerCase()} experience with VIP access.`,
        category,
        estimatedDuration: '3 hours',
        estimatedCost: 120,
        location: `Central ${locationName}`,
        rating: 4.9,
        matchScore: 88,
        whyRecommended: 'Premium option with exclusive access',
      },
      {
        id: `search-3-${Date.now()}`,
        name: `Local ${baseName} Discovery`,
        description: `Off-the-beaten-path ${baseName.toLowerCase()} led by local experts.`,
        category,
        estimatedDuration: '2 hours',
        estimatedCost: 45,
        location: 'Local neighborhood',
        rating: 4.6,
        matchScore: 85,
        whyRecommended: 'Authentic local experience',
      },
      {
        id: `search-4-${Date.now()}`,
        name: `${baseName} for Groups`,
        description: `Social ${baseName.toLowerCase()} experience perfect for travelers.`,
        category,
        estimatedDuration: '2.5 hours',
        estimatedCost: 40,
        location: 'Meeting point',
        rating: 4.5,
        matchScore: 80,
        whyRecommended: 'Great value and social atmosphere',
      },
    ];
  }

  const categoryTemplates: Record<string, AlternativeActivity[]> = {
    dining: [
      {
        id: `alt-dining-1-${Date.now()}`,
        name: `Fine Dining Experience in ${locationName}`,
        description: 'Upscale restaurant featuring local cuisine with a modern twist.',
        category: 'dining',
        estimatedDuration: '2 hours',
        estimatedCost: 120,
        location: 'City Center',
        rating: 4.8,
        matchScore: 92,
        whyRecommended: 'Premium alternative with exceptional reviews',
      },
      {
        id: `alt-dining-2-${Date.now()}`,
        name: 'Local Food Market Tour',
        description: 'Explore vibrant food stalls and taste authentic local dishes.',
        category: 'dining',
        estimatedDuration: '3 hours',
        estimatedCost: 45,
        location: 'Historic District',
        rating: 4.7,
        matchScore: 88,
        whyRecommended: 'Authentic local experience at great value',
      },
      {
        id: `alt-dining-3-${Date.now()}`,
        name: 'Cooking Class with Local Chef',
        description: 'Learn to prepare traditional dishes in an interactive session.',
        category: 'dining',
        estimatedDuration: '3.5 hours',
        estimatedCost: 85,
        location: 'Culinary School',
        rating: 4.9,
        matchScore: 85,
        whyRecommended: 'Interactive experience with takeaway skills',
      },
      {
        id: `alt-dining-4-${Date.now()}`,
        name: 'Hidden Gem Bistro',
        description: 'Locals-only restaurant with incredible home-style cooking.',
        category: 'dining',
        estimatedDuration: '1.5 hours',
        estimatedCost: 35,
        location: 'Residential area',
        rating: 4.6,
        matchScore: 82,
        whyRecommended: 'Budget-friendly local favorite',
      },
    ],
    cultural: [
      {
        id: `alt-cultural-1-${Date.now()}`,
        name: `Private Museum Tour in ${locationName}`,
        description: 'Skip-the-line access with a private guide explaining the collections.',
        category: 'cultural',
        estimatedDuration: '2.5 hours',
        estimatedCost: 95,
        location: 'Museum District',
        rating: 4.9,
        matchScore: 94,
        whyRecommended: 'VIP experience with expert insights',
      },
      {
        id: `alt-cultural-2-${Date.now()}`,
        name: 'Historical Walking Tour',
        description: 'Discover hidden stories and architectural gems with a historian guide.',
        category: 'cultural',
        estimatedDuration: '3 hours',
        estimatedCost: 35,
        location: 'Old Town',
        rating: 4.7,
        matchScore: 90,
        whyRecommended: 'Budget-friendly with excellent reviews',
      },
      {
        id: `alt-cultural-3-${Date.now()}`,
        name: 'Art Gallery & Studio Visit',
        description: 'Meet local artists and see their creative process firsthand.',
        category: 'cultural',
        estimatedDuration: '2 hours',
        estimatedCost: 55,
        location: 'Arts District',
        rating: 4.6,
        matchScore: 82,
        whyRecommended: 'Unique behind-the-scenes access',
      },
      {
        id: `alt-cultural-4-${Date.now()}`,
        name: 'Evening Cultural Performance',
        description: 'Experience traditional music, dance, or theater.',
        category: 'cultural',
        estimatedDuration: '2 hours',
        estimatedCost: 60,
        location: 'Cultural Center',
        rating: 4.8,
        matchScore: 85,
        whyRecommended: 'Immersive evening entertainment',
      },
    ],
    adventure: [
      {
        id: `alt-adventure-1-${Date.now()}`,
        name: `Scenic Hiking Adventure near ${locationName}`,
        description: 'Guided trek through stunning landscapes with panoramic views.',
        category: 'adventure',
        estimatedDuration: '4 hours',
        estimatedCost: 65,
        location: 'Nearby Nature Reserve',
        rating: 4.8,
        matchScore: 91,
        whyRecommended: 'Best views and expert local guide',
      },
      {
        id: `alt-adventure-2-${Date.now()}`,
        name: 'Water Sports Experience',
        description: 'Try kayaking, paddleboarding, or sailing with professional instruction.',
        category: 'adventure',
        estimatedDuration: '3 hours',
        estimatedCost: 85,
        location: 'Waterfront',
        rating: 4.7,
        matchScore: 86,
        whyRecommended: 'Active fun on the water',
      },
      {
        id: `alt-adventure-3-${Date.now()}`,
        name: 'Bike Tour of Hidden Gems',
        description: 'Cycle through scenic routes and discover local secrets.',
        category: 'adventure',
        estimatedDuration: '3 hours',
        estimatedCost: 45,
        location: 'City & Surroundings',
        rating: 4.6,
        matchScore: 84,
        whyRecommended: 'Eco-friendly and active exploration',
      },
      {
        id: `alt-adventure-4-${Date.now()}`,
        name: 'Sunrise/Sunset Adventure',
        description: 'Experience magical golden hour from a unique vantage point.',
        category: 'adventure',
        estimatedDuration: '2 hours',
        estimatedCost: 55,
        location: 'Scenic viewpoint',
        rating: 4.9,
        matchScore: 88,
        whyRecommended: 'Unforgettable photo opportunities',
      },
    ],
  };

  const templates = categoryTemplates[activityType] || [
    {
      id: `alt-default-1-${Date.now()}`,
      name: `Premium ${activity.name || 'Experience'}`,
      description: 'An enhanced version with exclusive access and personalized service.',
      category: activityType,
      estimatedDuration: '2 hours',
      estimatedCost: 100,
      location: locationName,
      rating: 4.8,
      matchScore: 90,
      whyRecommended: 'Upgraded experience with VIP treatment',
    },
    {
      id: `alt-default-2-${Date.now()}`,
      name: `Local ${activityType} Discovery`,
      description: 'Authentic experience led by passionate local guides.',
      category: activityType,
      estimatedDuration: '2.5 hours',
      estimatedCost: 50,
      location: 'Local Area',
      rating: 4.6,
      matchScore: 85,
      whyRecommended: 'Great value with local expertise',
    },
    {
      id: `alt-default-3-${Date.now()}`,
      name: `Group ${activityType} Adventure`,
      description: 'Join fellow travelers for a social and engaging experience.',
      category: activityType,
      estimatedDuration: '3 hours',
      estimatedCost: 40,
      location: 'Meeting Point',
      rating: 4.5,
      matchScore: 80,
      whyRecommended: 'Perfect for meeting new people',
    },
    {
      id: `alt-default-4-${Date.now()}`,
      name: `Budget-Friendly ${activityType}`,
      description: 'Great experience without breaking the bank.',
      category: activityType,
      estimatedDuration: '2 hours',
      estimatedCost: 25,
      location: locationName,
      rating: 4.4,
      matchScore: 78,
      whyRecommended: 'Best value option available',
    },
  ];

  return templates;
}
