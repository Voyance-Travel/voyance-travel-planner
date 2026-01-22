import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: RequestBody = await req.json();
    const { currentActivity, destination, searchQuery } = body;

    console.log('[get-activity-alternatives] Request:', {
      activity: currentActivity.name,
      destination,
      searchQuery,
    });

    // Try AI-powered alternatives first, fall back to templates
    let alternatives: AlternativeActivity[];
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (LOVABLE_API_KEY) {
      try {
        alternatives = await getAIAlternatives(currentActivity, destination, searchQuery, LOVABLE_API_KEY);
      } catch (aiError) {
        console.error('[get-activity-alternatives] AI fallback to templates:', aiError);
        alternatives = generateTemplateAlternatives(currentActivity, destination, searchQuery);
      }
    } else {
      console.log('[get-activity-alternatives] No API key, using templates');
      alternatives = generateTemplateAlternatives(currentActivity, destination, searchQuery);
    }

    return new Response(
      JSON.stringify({
        success: true,
        alternatives,
        meta: {
          query: searchQuery,
          basedOn: currentActivity.name,
          destination,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[get-activity-alternatives] Error:', errorMessage);
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

// AI-powered alternatives using Lovable AI
async function getAIAlternatives(
  activity: RequestBody['currentActivity'],
  destination?: string,
  searchQuery?: string,
  apiKey?: string
): Promise<AlternativeActivity[]> {
  const locationName = destination || 'the destination';
  const activityType = activity.type || 'activity';
  
  const userPrompt = searchQuery 
    ? `The user is looking for: "${searchQuery}". Find activities matching this request in ${locationName}.`
    : `Find 4 alternative activities similar to "${activity.name}" (${activityType}) in ${locationName}.`;

  const systemPrompt = `You are a travel activity recommendation expert. Generate creative, real-world activity alternatives for travelers.
  
For ${locationName}, suggest actual places and experiences that exist or could realistically exist there.
Consider the local culture, popular attractions, and hidden gems.
Vary the price points and experience types (premium, budget-friendly, unique local, group-friendly).`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
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
                      name: { type: "string", description: "Activity name" },
                      description: { type: "string", description: "Brief description (1-2 sentences)" },
                      category: { type: "string", description: "Category like dining, cultural, adventure, relaxation, shopping" },
                      estimatedDuration: { type: "string", description: "Duration like '2 hours' or '3.5 hours'" },
                      estimatedCost: { type: "number", description: "Cost in USD" },
                      location: { type: "string", description: "Specific location or area name" },
                      rating: { type: "number", description: "Rating from 4.0 to 5.0" },
                      matchScore: { type: "number", description: "How well it matches the request, 70-99" },
                      whyRecommended: { type: "string", description: "One sentence explaining why this is recommended" }
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
    console.error('[get-activity-alternatives] AI error:', response.status, errorText);
    throw new Error(`AI request failed: ${response.status}`);
  }

  const data = await response.json();
  
  // Extract tool call result
  const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
  if (!toolCall?.function?.arguments) {
    throw new Error('No tool call response from AI');
  }

  const parsed = JSON.parse(toolCall.function.arguments);
  const activities = parsed.activities || [];

  // Add unique IDs
  return activities.map((act: Omit<AlternativeActivity, 'id'>, idx: number) => ({
    ...act,
    id: `ai-alt-${Date.now()}-${idx}`,
  }));
}

// Template-based alternatives as fallback
function generateTemplateAlternatives(
  activity: RequestBody['currentActivity'],
  destination?: string,
  searchQuery?: string
): AlternativeActivity[] {
  const activityType = activity.type?.toLowerCase() || 'activity';
  const locationName = destination || 'the area';

  // If there's a search query, generate search-based results
  if (searchQuery) {
    return [
      {
        id: `search-1-${Date.now()}`,
        name: `${searchQuery} Experience in ${locationName}`,
        description: `A curated experience based on your search for "${searchQuery}".`,
        category: activityType,
        estimatedDuration: '2-3 hours',
        estimatedCost: 75,
        location: locationName,
        rating: 4.6,
        matchScore: 90,
        whyRecommended: `Matches your search for "${searchQuery}"`,
      },
      {
        id: `search-2-${Date.now()}`,
        name: `Premium ${searchQuery} Tour`,
        description: `An upscale version of your requested experience with VIP access.`,
        category: activityType,
        estimatedDuration: '3-4 hours',
        estimatedCost: 150,
        location: `Central ${locationName}`,
        rating: 4.9,
        matchScore: 85,
        whyRecommended: 'Premium option with exclusive access',
      },
      {
        id: `search-3-${Date.now()}`,
        name: `Local ${searchQuery} Discovery`,
        description: `Off-the-beaten-path experience led by local experts.`,
        category: activityType,
        estimatedDuration: '2 hours',
        estimatedCost: 45,
        location: 'Local neighborhood',
        rating: 4.7,
        matchScore: 82,
        whyRecommended: 'Authentic local experience',
      },
    ];
  }

  // Category-based templates
  const templates: Record<string, AlternativeActivity[]> = {
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
    ],
  };

  // Return matching category or default activity templates
  const categoryTemplates = templates[activityType] || [
    {
      id: `alt-default-1-${Date.now()}`,
      name: `Premium ${activity.name || 'Experience'}`,
      description: `An enhanced version with exclusive access and personalized service.`,
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
  ];

  return categoryTemplates;
}
