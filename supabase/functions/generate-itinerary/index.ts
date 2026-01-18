import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TripDetails {
  tripId: string;
  destination: string;
  destinationCountry?: string;
  startDate: string;
  endDate: string;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
}

interface UserPreferenceInsights {
  loved_activity_types: Record<string, number>;
  disliked_activity_types: Record<string, number>;
  loved_categories: Record<string, number>;
  disliked_categories: Record<string, number>;
  preferred_times: Record<string, number>;
  preferred_pace: string | null;
  insights_summary: string | null;
}

interface GenerationRequest {
  tripId: string;
  dayNumber: number;
  totalDays: number;
  destination: string;
  destinationCountry?: string;
  date: string;
  travelers: number;
  tripType?: string;
  budgetTier?: string;
  preferences?: {
    pace?: string;
    interests?: string[];
    budget?: string;
  };
  previousDayActivities?: string[];
  userId?: string; // For fetching learned preferences
}

interface Activity {
  id: string;
  name: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  duration: string;
  location: string;
  estimatedCost: { amount: number; currency: string };
  bookingRequired: boolean;
  tips?: string;
  coordinates?: { lat: number; lng: number };
}

interface GeneratedDay {
  dayNumber: number;
  date: string;
  theme: string;
  activities: Activity[];
  narrative?: {
    theme: string;
    highlights: string[];
  };
}

// Helper to get learned preferences
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getLearnedPreferences(supabase: any, userId: string): Promise<UserPreferenceInsights | null> {
  try {
    const { data, error } = await supabase
      .from('user_preference_insights')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) {
      console.error('[generate-itinerary] Error fetching preferences:', error);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('[generate-itinerary] Failed to get preferences:', e);
    return null;
  }
}

// Helper to get collaborator preferences for a trip
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCollaboratorPreferences(supabase: any, tripId: string): Promise<any[]> {
  try {
    // Get all collaborators for this trip
    const { data: collaborators, error: collabError } = await supabase
      .from('trip_collaborators')
      .select('user_id')
      .eq('trip_id', tripId);
    
    if (collabError || !collaborators || collaborators.length === 0) {
      return [];
    }

    const userIds = collaborators.map((c: any) => c.user_id);
    console.log(`[generate-itinerary] Found ${userIds.length} collaborators for trip ${tripId}`);

    // Fetch their preferences
    const { data: preferences, error: prefError } = await supabase
      .from('user_preferences')
      .select('user_id, interests, travel_pace, dining_style, activity_level, budget_tier')
      .in('user_id', userIds);

    if (prefError) {
      console.error('[generate-itinerary] Error fetching collaborator preferences:', prefError);
      return [];
    }

    // Fetch their profiles for names
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name')
      .in('id', userIds);

    // Combine preferences with profile names
    return (preferences || []).map((pref: any) => {
      const profile = profiles?.find((p: any) => p.id === pref.user_id);
      return {
        ...pref,
        display_name: profile?.display_name || 'Travel Companion',
      };
    });
  } catch (e) {
    console.error('[generate-itinerary] Failed to get collaborator preferences:', e);
    return [];
  }
}

// Build preference context for AI prompt
function buildPreferenceContext(insights: UserPreferenceInsights | null, collaboratorPrefs: any[] = []): string {
  const parts: string[] = [];
  
  if (insights) {
    // Get top loved activity types
    const lovedTypes = Object.entries(insights.loved_activity_types || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    
    if (lovedTypes.length > 0) {
      parts.push(`Primary traveler LOVES: ${lovedTypes.join(', ')} activities. Prioritize these.`);
    }
    
    // Get disliked activity types
    const dislikedTypes = Object.entries(insights.disliked_activity_types || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type]) => type.replace(/_/g, ' '));
    
    if (dislikedTypes.length > 0) {
      parts.push(`AVOID or minimize: ${dislikedTypes.join(', ')} activities.`);
    }
    
    // Get loved categories
    const lovedCategories = Object.entries(insights.loved_categories || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([cat]) => cat.replace(/_/g, ' '));
    
    if (lovedCategories.length > 0) {
      parts.push(`Favorite categories: ${lovedCategories.join(', ')}.`);
    }
    
    // Get disliked categories
    const dislikedCategories = Object.entries(insights.disliked_categories || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([cat]) => cat.replace(/_/g, ' '));
    
    if (dislikedCategories.length > 0) {
      parts.push(`Categories to avoid: ${dislikedCategories.join(', ')}.`);
    }
    
    // Add pace preference
    if (insights.preferred_pace) {
      parts.push(`Preferred pace: ${insights.preferred_pace}.`);
    }
  }

  // Add collaborator preferences
  if (collaboratorPrefs.length > 0) {
    parts.push(`\n👥 TRAVEL COMPANIONS (${collaboratorPrefs.length} linked friends):`);
    
    collaboratorPrefs.forEach((collab, index) => {
      const prefs: string[] = [];
      if (collab.interests?.length) {
        prefs.push(`interests: ${(collab.interests as string[]).slice(0, 3).join(', ')}`);
      }
      if (collab.travel_pace) prefs.push(`pace: ${collab.travel_pace}`);
      if (collab.dining_style) prefs.push(`dining: ${collab.dining_style}`);
      if (collab.activity_level) prefs.push(`activity level: ${collab.activity_level}`);
      
      if (prefs.length > 0) {
        parts.push(`  ${index + 1}. ${collab.display_name}: ${prefs.join(', ')}`);
      }
    });
    
    parts.push(`\n⚖️ BALANCE THE ITINERARY to include activities that appeal to the whole group!`);
  }
  
  if (parts.length === 0) return '';
  
  return `\n\n🎯 PERSONALIZED PREFERENCES (based on past trip feedback and travel companions):\n${parts.join('\n')}`;
}

const SYSTEM_PROMPT = `You are an expert travel planner with deep knowledge of destinations worldwide. Generate detailed, personalized day itineraries that feel authentic and locally-informed.

Your itineraries should:
- Be realistic with proper timing and logistics
- Include a mix of experiences (cultural, culinary, relaxation)
- Consider the traveler's pace preference
- Include local hidden gems alongside popular attractions
- Provide practical tips for each activity
- Account for travel time between activities
- STRONGLY prioritize activities the traveler has loved in the past
- AVOID activity types the traveler has disliked

Format times as HH:MM (24-hour). Costs should be in USD equivalent.`;

function buildDayPrompt(request: GenerationRequest, preferenceContext: string): string {
  const { dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities } = request;
  
  let prompt = `Generate a detailed itinerary for Day ${dayNumber} of ${totalDays} in ${destination}${destinationCountry ? `, ${destinationCountry}` : ''}.

Date: ${date}
Travelers: ${travelers} ${travelers === 1 ? 'person' : 'people'}
${tripType ? `Trip type: ${tripType}` : ''}
${budgetTier ? `Budget: ${budgetTier}` : ''}
${preferences?.pace ? `Pace: ${preferences.pace}` : ''}
${preferences?.interests?.length ? `Interests: ${preferences.interests.join(', ')}` : ''}`;

  // Add personalized preference context
  prompt += preferenceContext;

  if (previousDayActivities?.length) {
    prompt += `\n\nActivities already planned on previous days (avoid repeating): ${previousDayActivities.join(', ')}`;
  }

  prompt += `\n\nGenerate 4-6 activities for this day, including meals. Start around 9:00 and end by 21:00-22:00.
  
IMPORTANT: If personalized preferences are provided above, heavily weight your recommendations toward loved activity types and away from disliked ones.`;

  return prompt;
}

const activityTool = {
  type: "function",
  function: {
    name: "create_day_itinerary",
    description: "Creates a structured day itinerary with activities",
    parameters: {
      type: "object",
      properties: {
        dayNumber: { type: "number", description: "Day number in the trip" },
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
        theme: { type: "string", description: "Theme or focus of the day (e.g., 'Historic Exploration', 'Culinary Journey')" },
        activities: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string", description: "Unique activity ID" },
              name: { type: "string", description: "Activity name" },
              description: { type: "string", description: "Brief description (1-2 sentences)" },
              category: { 
                type: "string", 
                enum: ["attraction", "dining", "transport", "experience", "relaxation", "shopping"],
                description: "Activity category"
              },
              startTime: { type: "string", description: "Start time in HH:MM format" },
              endTime: { type: "string", description: "End time in HH:MM format" },
              duration: { type: "string", description: "Duration (e.g., '2 hours', '45 minutes')" },
              location: { type: "string", description: "Specific location/address" },
              estimatedCost: {
                type: "object",
                properties: {
                  amount: { type: "number" },
                  currency: { type: "string", default: "USD" }
                },
                required: ["amount", "currency"]
              },
              bookingRequired: { type: "boolean", description: "Whether advance booking is needed" },
              tips: { type: "string", description: "Insider tip for this activity" },
              coordinates: {
                type: "object",
                properties: {
                  lat: { type: "number" },
                  lng: { type: "number" }
                }
              },
              type: { type: "string", description: "Specific activity type (museum, restaurant, park, etc.)" }
            },
            required: ["id", "name", "description", "category", "startTime", "endTime", "duration", "location", "estimatedCost", "bookingRequired"]
          }
        },
        narrative: {
          type: "object",
          properties: {
            theme: { type: "string" },
            highlights: { type: "array", items: { type: "string" } }
          }
        }
      },
      required: ["dayNumber", "date", "theme", "activities"]
    }
  }
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[generate-itinerary] Action: ${action}`, JSON.stringify(params, null, 2));

    if (action === 'generate-day') {
      const request = params as GenerationRequest;
      
      // Fetch learned preferences if userId is provided
      let insights: UserPreferenceInsights | null = null;
      let collaboratorPrefs: any[] = [];
      
      if (request.userId) {
        console.log(`[generate-itinerary] Fetching learned preferences for user ${request.userId}`);
        insights = await getLearnedPreferences(supabase, request.userId);
      }
      
      // Fetch collaborator preferences for this trip
      if (request.tripId) {
        console.log(`[generate-itinerary] Fetching collaborator preferences for trip ${request.tripId}`);
        collaboratorPrefs = await getCollaboratorPreferences(supabase, request.tripId);
      }
      
      const preferenceContext = buildPreferenceContext(insights, collaboratorPrefs);
      if (preferenceContext) {
        console.log(`[generate-itinerary] Applied preference context:`, preferenceContext);
      }
      
      const prompt = buildDayPrompt(request, preferenceContext);

      console.log(`[generate-itinerary] Generating day ${request.dayNumber} for ${request.destination}`);

      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt }
          ],
          tools: [activityTool],
          tool_choice: { type: "function", function: { name: "create_day_itinerary" } },
        }),
      });

      if (!response.ok) {
        const status = response.status;
        const errorText = await response.text();
        console.error(`[generate-itinerary] AI Gateway error: ${status}`, errorText);

        if (status === 429) {
          return new Response(
            JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (status === 402) {
          return new Response(
            JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: "Failed to generate itinerary day" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await response.json();
      console.log(`[generate-itinerary] AI response received`);

      // Extract the tool call result
      const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
      if (!toolCall?.function?.arguments) {
        console.error("[generate-itinerary] No tool call in response");
        return new Response(
          JSON.stringify({ error: "Invalid AI response format" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const generatedDay: GeneratedDay = JSON.parse(toolCall.function.arguments);
      
      // Ensure IDs are unique
      generatedDay.activities = generatedDay.activities.map((activity, index) => ({
        ...activity,
        id: activity.id || `day${request.dayNumber}-activity${index + 1}-${Date.now()}`
      }));

      console.log(`[generate-itinerary] Generated ${generatedDay.activities.length} activities for day ${request.dayNumber}`);

      return new Response(
        JSON.stringify({ 
          success: true, 
          day: generatedDay,
          dayNumber: request.dayNumber,
          totalDays: request.totalDays,
          usedPersonalization: !!preferenceContext
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'get-trip') {
      const { tripId } = params;
      const { data: trip, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (error || !trip) {
        console.error("[generate-itinerary] Trip not found:", error);
        return new Response(
          JSON.stringify({ error: "Trip not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tripDetails: TripDetails = {
        tripId: trip.id,
        destination: trip.destination,
        destinationCountry: trip.destination_country,
        startDate: trip.start_date,
        endDate: trip.end_date,
        travelers: trip.travelers || 1,
        tripType: trip.trip_type,
        budgetTier: trip.budget_tier,
      };

      return new Response(
        JSON.stringify({ success: true, trip: tripDetails }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'save-itinerary') {
      const { tripId, itinerary } = params;

      // Save to trips.itinerary_data (JSONB)
      const { error } = await supabase
        .from('trips')
        .update({ 
          itinerary_data: itinerary,
          itinerary_status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', tripId);

      if (error) {
        console.error("[generate-itinerary] Failed to save itinerary:", error);
        return new Response(
          JSON.stringify({ error: "Failed to save itinerary" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`[generate-itinerary] Itinerary saved for trip ${tripId}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[generate-itinerary] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
