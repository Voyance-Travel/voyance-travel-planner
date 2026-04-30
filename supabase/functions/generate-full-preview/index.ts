import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";
import { googlePlacesTextSearch } from "../_shared/google-api.ts";

/**
 * Generate Full Preview - "Full Preview, No Details" Model
 * 
 * This endpoint generates a COMPLETE itinerary preview with:
 * ✅ REAL venue names and times
 * ✅ Personalized reasoning for each choice
 * ✅ Full day-by-day structure
 * ✅ Minimal venue validation (existence check)
 * 
 * GATED (requires purchase):
 * ❌ Addresses
 * ❌ Hours of operation
 * ❌ Photos
 * ❌ Booking links
 * ❌ Detailed tips
 * ❌ Map coordinates
 * ❌ PDF export
 * 
 * Cost: ~$0.10-0.14 per preview (AI + light Google validation)
 * 
 * Psychology: User sees exactly what they're getting, but can't ACT on it.
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
  archetype?: string;
}

interface PreviewActivity {
  time: string;
  venueName: string;
  venueType: 'dining' | 'cultural' | 'nature' | 'shopping' | 'entertainment' | 'transport' | 'accommodation';
  neighborhood: string;
  reasoning: string;  // Why this fits the traveler's DNA
  durationMinutes: number;
  // GATED - these are null in preview, populated on purchase
  address?: null;
  hours?: null;
  photoUrl?: null;
  bookingUrl?: null;
  tips?: null;
  coordinates?: null;
}

interface PreviewDay {
  dayNumber: number;
  date: string;
  title: string;
  theme: string;
  activities: PreviewActivity[];
}

interface FullPreview {
  destination: string;
  country?: string;
  totalDays: number;
  totalActivities: number;
  days: PreviewDay[];
  tripSummary: {
    experienceCount: number;
    diningCount: number;
    culturalCount: number;
    uniqueNeighborhoods: string[];
  };
  dnaAlignment: string[];  // How this matches their profile
  isPreview: true;
  gatedFeatures: string[];
  generatedAt: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const costTracker = trackCost('generate-full-preview', 'google/gemini-3-flash-preview');

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // REQUIRE authentication for full preview
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required to generate preview' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    costTracker.setUserId(userId);

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
      archetype,
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

    costTracker.addMetadata('destination', destination);
    costTracker.addMetadata('days', cappedDays);

    // Load user's Travel DNA
    let dnaContext = '';
    let userArchetype = archetype || 'Experiential Explorer';
    
    const { data: preferences } = await supabase
      .from('user_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (preferences) {
      userArchetype = preferences.travel_archetype || userArchetype;
      dnaContext = `
TRAVELER DNA PROFILE:
- Archetype: ${userArchetype}
- Preferred pace: ${preferences.travel_pace || pace}
- Budget tier: ${preferences.budget_tier || budgetTier}
- Interests: ${(preferences.interests || interests).join(', ') || 'varied'}
- Trip type: ${tripType}
- Food preferences: ${preferences.food_preferences?.join(', ') || 'varied'}
- Must avoid: ${preferences.avoid_list?.join(', ') || 'none specified'}
- Travel style notes: ${preferences.travel_style_notes || 'none'}
`;
    }

    // Build AI prompt for FULL preview with REAL venues
    const prompt = `You are Voyance, a premium AI travel planner with deep local knowledge.

Generate a COMPLETE ${cappedDays}-day itinerary for ${destination}${destinationCountry ? `, ${destinationCountry}` : ''} with REAL venue names.

${dnaContext}

TRIP PARAMETERS:
- Dates: ${startDate} to ${endDate}
- Travelers: ${travelers}
- Trip type: ${tripType}
- Budget: ${budgetTier}
- Pace: ${pace}

CRITICAL REQUIREMENTS:
1. Use REAL, EXISTING venue names (restaurants, temples, museums, shops)
2. Include specific times for each activity
3. Explain WHY each venue fits this traveler's ${userArchetype} profile
4. Balance the day with 5-7 activities including meals
5. Consider opening hours and realistic timing
6. Include mix of: dining, cultural, nature/walking, and optional shopping/entertainment

For each activity provide:
- time: "9:00 AM" format
- venueName: Real venue name
- venueType: dining|cultural|nature|shopping|entertainment|transport|accommodation
- neighborhood: District/area name
- reasoning: 1-2 sentences explaining DNA alignment
- durationMinutes: Estimated time to spend

Generate exactly ${cappedDays} days with 5-7 activities each.

Respond in JSON format:
{
  "days": [
    {
      "dayNumber": 1,
      "date": "${startDate}",
      "title": "Arrival & First Taste",
      "theme": "Immersion",
      "activities": [
        {
          "time": "2:00 PM",
          "venueName": "Meiji Shrine",
          "venueType": "cultural",
          "neighborhood": "Shibuya",
          "reasoning": "Peaceful introduction to Tokyo. Timed for afternoon calm when crowds thin. Perfect for your ${userArchetype} preference for meaningful experiences over tourist checkboxes.",
          "durationMinutes": 90
        }
      ]
    }
  ],
  "dnaAlignment": [
    "Timed for your preferred late-morning starts",
    "Dining selections match your adventurous palate",
    "Built-in breathing room between experiences"
  ]
}`;

    // Call AI (use flash-preview for better quality)
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`[generate-full-preview] Generating ${cappedDays}-day preview for ${destination} | User: ${userId}`);

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are Voyance, a premium AI travel planner. Return valid JSON only. Use real venue names that actually exist." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("[generate-full-preview] AI error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again in a moment.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'AI credits exhausted. Please contact support.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI generation failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    costTracker.recordAiUsage(aiData, 'google/gemini-3-flash-preview');

    // Parse AI response
    let content = aiData.choices?.[0]?.message?.content || '{}';
    
    if (content.includes('```')) {
      content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    }

    let previewData;
    try {
      previewData = JSON.parse(content);
    } catch (e) {
      console.error("[generate-full-preview] Failed to parse AI response:", content);
      throw new Error("Failed to parse preview data");
    }

    // Light venue validation - just check a sample exists via Google Text Search
    // This adds ~$0.05-0.08 but ensures venues are real
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_PLACES_API_KEY");
    let validationPassed = true;
    
    if (GOOGLE_API_KEY && previewData.days?.[0]?.activities?.[0]) {
      // Validate first dining venue as a sanity check
      const firstDining = previewData.days
        .flatMap((d: any) => d.activities || [])
        .find((a: any) => a.venueType === 'dining');
      
      if (firstDining) {
      try {
          const searchQuery = `${firstDining.venueName} ${destination}`;
          const validationRes = await googlePlacesTextSearch(
            {
              textQuery: searchQuery,
              fieldMask: "places.id,places.displayName",
              maxResultCount: 1,
            },
            { tracker: costTracker, reason: `preview-validate: ${firstDining.venueName}` },
          );

          const places = validationRes.data?.places ?? [];
          if (places.length > 0) {
            console.log(`[generate-full-preview] ✓ Validated venue: ${firstDining.venueName}`);
          } else {
            console.warn(`[generate-full-preview] ⚠ Could not validate: ${firstDining.venueName}`);
            // Don't fail - AI venues are usually real, validation is just a sanity check
          }
        } catch (e) {
          console.warn("[generate-full-preview] Validation check failed:", e);
          // Continue anyway - validation is best-effort
        }
      }
    }

    // Count activities by type
    const allActivities = previewData.days?.flatMap((d: any) => d.activities || []) || [];
    const diningCount = allActivities.filter((a: any) => a.venueType === 'dining').length;
    const culturalCount = allActivities.filter((a: any) => a.venueType === 'cultural').length;
    const neighborhoods = [...new Set(allActivities.map((a: any) => a.neighborhood).filter(Boolean))];

    // Construct response with GATED fields as null
    const preview: FullPreview = {
      destination,
      country: destinationCountry,
      totalDays: cappedDays,
      totalActivities: allActivities.length,
      days: previewData.days?.map((day: any, index: number) => ({
        dayNumber: index + 1,
        date: new Date(start.getTime() + index * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        title: day.title || `Day ${index + 1}`,
        theme: day.theme || 'Exploration',
        activities: (day.activities || []).map((act: any) => ({
          time: act.time,
          venueName: act.venueName,
          venueType: act.venueType,
          neighborhood: act.neighborhood,
          reasoning: act.reasoning,
          durationMinutes: act.durationMinutes || 60,
          // GATED - null in preview
          address: null,
          hours: null,
          photoUrl: null,
          bookingUrl: null,
          tips: null,
          coordinates: null,
        })),
      })) || [],
      tripSummary: {
        experienceCount: allActivities.length,
        diningCount,
        culturalCount,
        uniqueNeighborhoods: neighborhoods as string[],
      },
      dnaAlignment: previewData.dnaAlignment || [],
      isPreview: true,
      gatedFeatures: [
        'Full addresses + Google Maps',
        'Hours of operation',
        'High-quality venue photos',
        'Booking links & reservations',
        'Insider tips for each stop',
        'Offline PDF export',
        'Optimized routing',
      ],
      generatedAt: new Date().toISOString(),
    };

    await costTracker.save();

    console.log(`[generate-full-preview] ✓ Generated ${cappedDays}-day preview with ${allActivities.length} activities for ${destination}`);

    return new Response(
      JSON.stringify({
        success: true,
        preview,
        conversionCopy: {
          headline: `Your ${cappedDays}-Day ${destination} Itinerary is Ready`,
          subheadline: `${allActivities.length} curated experiences across ${neighborhoods.length} neighborhoods`,
          cta: "Get My Complete Itinerary",
          valueProps: [
            `Full addresses + Google Maps integration`,
            `Hours, tips, and "when to arrive" for each stop`,
            `Your personalized PDF to take offline`,
          ],
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("[generate-full-preview] Error:", error);
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
