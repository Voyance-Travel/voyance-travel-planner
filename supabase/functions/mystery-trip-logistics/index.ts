import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";
import { trackCost } from "../_shared/cost-tracker.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

    const { destination, country, startDate, endDate } = await req.json();
    if (!destination || !startDate || !endDate) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[mystery-logistics] Fetching logistics for ${destination}, ${country} | ${startDate} - ${endDate}`);

    // Fetch user data in parallel
    const [preferencesResult, pastTripsResult, dnaResult] = await Promise.all([
      supabase
        .from('user_preferences')
        .select('budget_tier, accommodation_style, interests, preferred_regions')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('trips')
        .select('destination, origin_city, budget_tier, hotel_selection, travelers')
        .eq('user_id', user.id)
        .in('status', ['completed', 'active', 'booked'])
        .order('created_at', { ascending: false })
        .limit(10),
      supabase
        .from('travel_dna_profiles')
        .select('primary_archetype_name, trait_scores')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const preferences = preferencesResult.data;
    const pastTrips = pastTripsResult.data || [];
    const dna = dnaResult.data;

    // Derive user context
    const departureCity = pastTrips.find(t => t.origin_city)?.origin_city || 'Unknown';
    const budgetTier = preferences?.budget_tier || pastTrips.find(t => t.budget_tier)?.budget_tier || 'moderate';
    const accommodationStyle = preferences?.accommodation_style || 'hotel';

    // Analyze past hotel choices for patterns
    const pastHotelPatterns = pastTrips
      .filter(t => t.hotel_selection)
      .map(t => {
        const hotel = Array.isArray(t.hotel_selection) ? t.hotel_selection[0] : t.hotel_selection;
        return hotel ? {
          starRating: hotel.starRating || hotel.star_rating,
          pricePerNight: hotel.pricePerNight || hotel.price_per_night,
          roomType: hotel.roomType || hotel.room_type,
        } : null;
      })
      .filter(Boolean);

    const avgStarRating = pastHotelPatterns.length > 0
      ? Math.round(pastHotelPatterns.reduce((sum, h) => sum + (h!.starRating || 4), 0) / pastHotelPatterns.length)
      : 4;
    const avgPricePerNight = pastHotelPatterns.length > 0
      ? Math.round(pastHotelPatterns.reduce((sum, h) => sum + (h!.pricePerNight || 150), 0) / pastHotelPatterns.length)
      : null;

    const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Call AI to estimate flight price and suggest hotels
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a travel logistics expert. Given a destination, travel dates, and user preferences, provide:
1. A realistic estimated round-trip flight price from the user's departure city.
2. Three hotel suggestions that match the user's budget tier, accommodation style, and past hotel preferences.

Be realistic with pricing. Use your knowledge of typical flight and hotel costs for the destination and time of year.`;

    const userPrompt = `Destination: ${destination}, ${country || ''}
Dates: ${startDate} to ${endDate} (${days} days)
Departure city: ${departureCity}

User budget tier: ${budgetTier}
Accommodation style preference: ${accommodationStyle}
${dna?.primary_archetype_name ? `Travel archetype: ${dna.primary_archetype_name}` : ''}
${avgPricePerNight ? `Average past hotel price/night: $${avgPricePerNight}` : ''}
${avgStarRating ? `Preferred star rating: ${avgStarRating} stars` : ''}

Provide a flight estimate and 3 hotel suggestions. Hotels should range from budget-friendly to premium within the user's comfort zone.`;

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
              name: "provide_logistics",
              description: "Provide flight estimate and hotel suggestions for the mystery getaway",
              parameters: {
                type: "object",
                properties: {
                  flightEstimate: {
                    type: "object",
                    properties: {
                      priceRangeLow: { type: "number", description: "Low end of estimated round-trip flight price in USD" },
                      priceRangeHigh: { type: "number", description: "High end of estimated round-trip flight price in USD" },
                      typicalAirline: { type: "string", description: "A typical airline for this route" },
                      flightDuration: { type: "string", description: "Approximate flight duration e.g. '8h 30m'" },
                      departureCity: { type: "string", description: "The departure city used" },
                    },
                    required: ["priceRangeLow", "priceRangeHigh", "typicalAirline", "flightDuration", "departureCity"],
                    additionalProperties: false,
                  },
                  hotelSuggestions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Hotel name" },
                        neighborhood: { type: "string", description: "Neighborhood or area of the city" },
                        starRating: { type: "number", description: "Star rating 1-5" },
                        pricePerNight: { type: "number", description: "Estimated price per night in USD" },
                        totalEstimate: { type: "number", description: "Total estimated cost for the stay in USD" },
                        whyMatch: { type: "string", description: "1-2 sentence reason why this hotel matches the user's style" },
                        amenityHighlights: {
                          type: "array",
                          items: { type: "string" },
                          description: "3 key amenity highlights",
                        },
                        tier: { type: "string", enum: ["value", "comfort", "premium"], description: "Budget tier of this option" },
                      },
                      required: ["name", "neighborhood", "starRating", "pricePerNight", "totalEstimate", "whyMatch", "amenityHighlights", "tier"],
                      additionalProperties: false,
                    },
                    minItems: 3,
                    maxItems: 3,
                  },
                },
                required: ["flightEstimate", "hotelSuggestions"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "provide_logistics" } },
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
      console.error("[mystery-logistics] AI error:", response.status, errorText);
      throw new Error("Failed to generate logistics estimates");
    }

    const aiResult = await response.json();

    // Track cost
    const costTracker = trackCost('mystery_trip_logistics', 'google/gemini-3-flash-preview');
    costTracker.setUserId(user.id);
    costTracker.recordAiUsage(aiResult);
    await costTracker.save();

    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("Invalid AI response format");
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    console.log(`[mystery-logistics] Generated flight estimate and ${parsed.hotelSuggestions?.length || 0} hotel suggestions`);

    return new Response(JSON.stringify({
      flightEstimate: parsed.flightEstimate,
      hotelSuggestions: parsed.hotelSuggestions,
      departureCity,
      budgetTier,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[mystery-logistics] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
