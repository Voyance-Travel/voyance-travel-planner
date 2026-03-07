import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";

/**
 * Generate Trip Preview - AI-Only (Optimized Free Tier)
 * 
 * This endpoint generates a FREE trip preview that:
 * ✅ Uses AI only (~$0.02-0.03 cost)
 * ❌ Does NOT call Google Places (saves ~$0.30)
 * ❌ Does NOT call Amadeus (saves ~$0.12)
 * ❌ Does NOT return real venue names
 * 
 * Returns:
 * - Day structure (themes, neighborhoods)
 * - Time blocks (Morning/Afternoon/Evening)
 * - Activity TYPES not names ("A renowned sushi counter" not "Sukiyabashi Jiro")
 * - DNA-based personalization callouts
 * 
 * The full trip with real venues requires credits/purchase.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PreviewRequest {
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers?: number;
  tripType?: string;
  budgetTier?: string;
  pace?: string;
  interests?: string[];
}

interface PreviewDay {
  dayNumber: number;
  date: string;
  title: string;
  theme: string;
  neighborhood: string;
  timeBlocks: {
    period: 'morning' | 'afternoon' | 'evening';
    activityType: string;
    teaser: string;
    dnaAlignment?: string;
  }[];
}

interface TripPreview {
  destination: string;
  totalDays: number;
  days: PreviewDay[];
  highlights: string[];
  dnaCallouts: string[];
  isPreview: true;
  generatedAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('generate-trip-preview', 'google/gemini-2.5-flash-lite');

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Get user from auth header (optional for preview)
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    if (authHeader) {
      const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
      userId = user?.id || null;
    }

    const body: PreviewRequest = await req.json();
    const {
      destination,
      destinationCountry,
      startDate,
      endDate,
      travelers = 2,
      tripType = 'vacation',
      budgetTier = 'moderate',
      pace = 'moderate',
      interests = [],
    } = body;

    if (!destination || !startDate || !endDate) {
      return new Response(
        JSON.stringify({ error: 'destination, startDate, and endDate are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate trip duration
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const cappedDays = Math.min(totalDays, 2); // Cap FREE preview at 2 days — user must unlock additional days with credits

    costTracker.setUserId(userId || 'anonymous');
    costTracker.addMetadata('destination', destination);
    costTracker.addMetadata('days', cappedDays);

    // Load user's Travel DNA if authenticated
    let dnaContext = '';
    if (userId) {
      const { data: preferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (preferences) {
        dnaContext = `
TRAVELER DNA:
- Preferred pace: ${preferences.travel_pace || pace}
- Budget tier: ${preferences.budget_tier || budgetTier}
- Interests: ${(preferences.interests || interests).join(', ')}
- Trip type: ${tripType}
- Food preferences: ${preferences.food_preferences?.join(', ') || 'varied'}
- Avoid: ${preferences.avoid_list?.join(', ') || 'none'}
`;
      }
    }

    // Build AI prompt for preview (NO REAL VENUES)
    const prompt = `You are Voyance, a premium AI travel planner. Generate a PREVIEW itinerary structure for ${destination}${destinationCountry ? `, ${destinationCountry}` : ''}.

CRITICAL: This is a FREE PREVIEW. You must:
- ❌ NOT use real venue names (no specific restaurants, museums, hotels)
- ✅ Describe activities by TYPE and VIBE ("A hidden ramen gem in Shibuya", "An ancient temple with stunning views")
- ✅ Name neighborhoods and districts
- ✅ Show the trip structure and flow
- ✅ Create intrigue without revealing specifics

TRIP DETAILS:
- Destination: ${destination}
- Dates: ${startDate} to ${endDate} (${cappedDays} days)
- Travelers: ${travelers}
- Trip type: ${tripType}
- Budget: ${budgetTier}
- Pace: ${pace}
${dnaContext}

Generate a preview for ${cappedDays} days. For each day provide:
1. A compelling title/theme
2. The main neighborhood focus
3. Morning/Afternoon/Evening activity blocks with:
   - Activity type (dining, cultural, adventure, etc.)
   - Teaser description (evocative but no real names)
   - Why it fits this traveler's DNA (if known)

Also provide:
- 3-5 trip highlights (teaser style)
- 2-3 DNA-based personalization callouts (how this trip matches their style)

Respond in JSON format:
{
  "days": [
    {
      "dayNumber": 1,
      "date": "YYYY-MM-DD",
      "title": "Arrival & First Taste",
      "theme": "Immersion",
      "neighborhood": "Shibuya",
      "timeBlocks": [
        {
          "period": "afternoon",
          "activityType": "arrival",
          "teaser": "Settle into your hotel and get oriented",
          "dnaAlignment": "Matches your relaxed pace preference"
        },
        {
          "period": "evening",
          "activityType": "dining",
          "teaser": "A legendary ramen spot tucked in a narrow alley",
          "dnaAlignment": "Authentic local cuisine you crave"
        }
      ]
    }
  ],
  "highlights": [
    "A sunrise experience the crowds never see",
    "The neighborhood where chefs eat on their nights off"
  ],
  "dnaCallouts": [
    "Timed for your preferred late-morning starts",
    "Balances culture with the foodie experiences you love"
  ]
}`;

    // Call AI (lightweight model for cost efficiency)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Cheapest model for preview
        messages: [
          { role: "system", content: "You are Voyance, a premium AI travel planner. Return valid JSON only." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[generate-trip-preview] AI error:", aiResponse.status, errorText);
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    costTracker.recordAiUsage(aiData, 'google/gemini-2.5-flash-lite');

    // Parse AI response
    let content = aiData.choices?.[0]?.message?.content || '{}';
    
    // Clean markdown code blocks if present
    if (content.includes('```')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    let previewData;
    try {
      previewData = JSON.parse(content);
    } catch (e) {
      console.error("[generate-trip-preview] Failed to parse AI response:", content);
      throw new Error("Failed to parse preview data");
    }

    // Construct response
    const preview: TripPreview = {
      destination,
      totalDays: cappedDays,
      days: previewData.days?.map((day: any, index: number) => ({
        dayNumber: index + 1,
        date: new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: day.title || `Day ${index + 1}`,
        theme: day.theme || 'Exploration',
        neighborhood: day.neighborhood || destination,
        timeBlocks: day.timeBlocks || [],
      })) || [],
      highlights: previewData.highlights || [],
      dnaCallouts: previewData.dnaCallouts || [],
      isPreview: true,
      generatedAt: new Date().toISOString(),
    };

    await costTracker.save();

    console.log(`[generate-trip-preview] ✓ Generated ${cappedDays}-day preview for ${destination} | User: ${userId || 'anon'}`);

    return new Response(
      JSON.stringify({
        success: true,
        preview,
        message: "This is a free preview. Unlock the full itinerary to see real venues, booking links, and optimized routing.",
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[generate-trip-preview] Error:", error);
    await costTracker.save();

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to generate preview' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
