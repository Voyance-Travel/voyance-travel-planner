import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");

    const { tripId, mode } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // =============================================
    // DAILY BRIEFING MODE
    // =============================================
    if (mode === 'daily-briefing') {
      const { data: tripData } = await supabase
        .from('trips')
        .select('destination, destination_country, itinerary_data, metadata, start_date')
        .eq('id', tripId)
        .single();

      if (!tripData) {
        return new Response(JSON.stringify({ error: 'Trip not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const today = new Date().toISOString().split('T')[0];
      const itin = (tripData.itinerary_data as any) || {};
      const days = itin.days || itin.itinerary || [];
      const todayDay = (Array.isArray(days) ? days : []).find((d: any) => d.date === today);
      const todayActivities = todayDay?.activities || [];

      const todaySchedule = {
        activityCount: todayActivities.length,
        firstActivity: todayActivities.length > 0
          ? `${todayActivities[0].title} at ${todayActivities[0].startTime || todayActivities[0].start_time || 'TBD'}`
          : 'No activities planned',
        lastActivity: todayActivities.length > 1
          ? `${todayActivities[todayActivities.length - 1].title} at ${todayActivities[todayActivities.length - 1].startTime || todayActivities[todayActivities.length - 1].start_time || 'TBD'}`
          : todayActivities.length === 1 ? 'Just one activity today' : '',
      };

      const destination = tripData.destination || 'the destination';
      const meta = (tripData.metadata as any) || {};
      const dnaTraits = meta.interestCategories || [];

      const briefingPrompt = `You are a local travel concierge for ${destination}, ${tripData.destination_country || ''}.
Today's date: ${today}

The traveler has these interests: ${dnaTraits.join(', ') || 'general sightseeing'}.

Today's planned activities:
${todayActivities.map((a: any, i: number) => `${i + 1}. ${a.title} (${a.startTime || a.start_time || 'TBD'}) - ${a.category || 'activity'}`).join('\n') || 'None planned'}

Generate a daily briefing as JSON with:
1. "weather": Realistic weather estimate for ${destination} today (use seasonal averages for this time of year). Include condition, tempHigh, tempLow, unit ("C" for non-US destinations, "F" for US), and a practical tip.
2. "highlights": 2-3 things happening near ${destination} today that match the traveler's interests. Could be markets, seasonal events, local customs, neighborhood vibes. Each needs title, reason (why this matches them), and optional timeNote.
3. "dontMiss": 2-3 practical, time-sensitive tips for today. Examples: best times to visit busy spots, sunset times, restaurant reservation tips, local customs to know. Each needs tip and category ("timing", "local", "weather", or "tip").

Return ONLY valid JSON, no markdown.`;

      const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-lite',
          messages: [
            { role: 'system', content: 'You are a travel concierge. Return only valid JSON.' },
            { role: 'user', content: briefingPrompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error('[mid-trip-dna] AI gateway error:', aiResponse.status, errText);
        return new Response(JSON.stringify({ error: 'Failed to generate briefing' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content || '{}';

      let briefingData;
      try {
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        briefingData = JSON.parse(cleanContent);
      } catch {
        briefingData = { weather: null, highlights: [], dontMiss: [] };
      }

      return new Response(JSON.stringify({
        briefing: {
          weather: briefingData.weather || null,
          todaySchedule,
          highlights: briefingData.highlights || [],
          dontMiss: briefingData.dontMiss || [],
        }
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // =============================================
    // ORIGINAL PREDICTIONS MODE (default)
    // =============================================

    // Load trip and DNA profile in parallel (no feedback/memories needed)
    const [tripRes, dnaRes] = await Promise.all([
      supabase
        .from("trips")
        .select("destination, start_date, end_date, travelers, itinerary_data, metadata")
        .eq("id", tripId)
        .single(),
      supabase
        .from("travel_dna_profiles")
        .select("primary_archetype_name, trait_scores, travel_dna_v2")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    const trip = tripRes.data;
    if (!trip) throw new Error("Trip not found");

    const dnaProfile = dnaRes.data;

    // Calculate trip progress
    const now = new Date();
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const currentDay = Math.min(
      Math.max(1, Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1),
      totalDays
    );

    // Get archetype
    const archetype =
      dnaProfile?.primary_archetype_name ||
      (dnaProfile?.travel_dna_v2 as any)?.primary_archetype_name ||
      (trip.metadata as any)?.archetype ||
      "Explorer";

    // Get trait scores
    const traitScores =
      dnaProfile?.trait_scores ||
      (dnaProfile?.travel_dna_v2 as any)?.trait_scores ||
      {};

    // Summarize itinerary activities for context
    const activitySummary: string[] = [];
    if (trip.itinerary_data && typeof trip.itinerary_data === "object") {
      const itin = trip.itinerary_data as any;
      const days = itin.days || itin.itinerary || [];
      if (Array.isArray(days)) {
        for (const day of days) {
          const acts = day.activities || [];
          if (Array.isArray(acts)) {
            for (const act of acts) {
              const title = act.title || act.name || "";
              const category = act.category || "";
              if (title) activitySummary.push(`${title} (${category})`);
            }
          }
        }
      }
    }

    const prompt = `Generate fun, personality-driven trip predictions for this traveler.

TRAVELER:
- Archetype: ${archetype}
- Key traits: ${JSON.stringify(traitScores)}

TRIP:
- Destination: ${trip.destination}
- Day ${currentDay} of ${totalDays}
- Travelers: ${trip.travelers || 1}
- Planned activities: ${activitySummary.slice(0, 15).join(", ") || "various activities"}

Generate spontaneous, delightful predictions about what might happen on this trip based on their personality archetype and destination. Think: "Your Culinary Cartographer DNA says you'll find a hole-in-the-wall restaurant that becomes your favorite." or "Slow Traveler alert: you'll end up staying at one café for 3 hours and love every minute."

These should feel personal, fun, and specific to the destination — NOT about app engagement or metrics.`;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a playful Travel DNA oracle. You make fun, specific predictions about what will happen on someone's trip based on their personality archetype and destination. Be warm, witty, and specific to the destination. Each prediction should feel like a fortune cookie written by a best friend who knows you well.`,
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_trip_predictions",
                description: "Generate fun personality-driven trip predictions",
                parameters: {
                  type: "object",
                  properties: {
                    headline: {
                      type: "string",
                      description: "A punchy 5-10 word headline about their archetype on this trip (e.g. 'Your inner foodie is about to feast')",
                    },
                    archetypeInsight: {
                      type: "string",
                      description: "A one-liner about how their archetype plays out in this specific destination (1 sentence)",
                    },
                    predictions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          emoji: {
                            type: "string",
                            description: "A single emoji that represents this prediction",
                          },
                          text: {
                            type: "string",
                            description: "A fun, specific prediction sentence (1-2 sentences max). Reference the archetype naturally.",
                          },
                        },
                        required: ["emoji", "text"],
                      },
                      description: "3-4 fun personality-driven predictions about what might happen on this trip",
                    },
                  },
                  required: ["headline", "archetypeInsight", "predictions"],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "generate_trip_predictions" },
          },
        }),
      }
    );

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await aiResponse.text();
      console.error("AI error:", aiResponse.status, text);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("No predictions generated");
    }

    const predictions = JSON.parse(toolCall.function.arguments);

    return new Response(
      JSON.stringify({
        success: true,
        predictions,
        meta: {
          archetype,
          tripDay: currentDay,
          totalDays,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("mid-trip-dna error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
