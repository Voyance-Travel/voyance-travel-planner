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

const SYSTEM_PROMPT = `You are an expert travel planner with deep knowledge of destinations worldwide. Generate detailed, personalized day itineraries that feel authentic and locally-informed.

Your itineraries should:
- Be realistic with proper timing and logistics
- Include a mix of experiences (cultural, culinary, relaxation)
- Consider the traveler's pace preference
- Include local hidden gems alongside popular attractions
- Provide practical tips for each activity
- Account for travel time between activities

Format times as HH:MM (24-hour). Costs should be in USD equivalent.`;

function buildDayPrompt(request: GenerationRequest): string {
  const { dayNumber, totalDays, destination, destinationCountry, date, travelers, tripType, budgetTier, preferences, previousDayActivities } = request;
  
  let prompt = `Generate a detailed itinerary for Day ${dayNumber} of ${totalDays} in ${destination}${destinationCountry ? `, ${destinationCountry}` : ''}.

Date: ${date}
Travelers: ${travelers} ${travelers === 1 ? 'person' : 'people'}
${tripType ? `Trip type: ${tripType}` : ''}
${budgetTier ? `Budget: ${budgetTier}` : ''}
${preferences?.pace ? `Pace: ${preferences.pace}` : ''}
${preferences?.interests?.length ? `Interests: ${preferences.interests.join(', ')}` : ''}`;

  if (previousDayActivities?.length) {
    prompt += `\n\nActivities already planned on previous days (avoid repeating): ${previousDayActivities.join(', ')}`;
  }

  prompt += `\n\nGenerate 4-6 activities for this day, including meals. Start around 9:00 and end by 21:00-22:00.`;

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
              }
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

    const body = await req.json();
    const { action, ...params } = body;

    console.log(`[generate-itinerary] Action: ${action}`, JSON.stringify(params, null, 2));

    if (action === 'generate-day') {
      const request = params as GenerationRequest;
      const prompt = buildDayPrompt(request);

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
          totalDays: request.totalDays
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === 'get-trip') {
      // Fetch trip details from database
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

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
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

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
