import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const { tripId } = await req.json();
    if (!tripId) throw new Error("tripId required");

    // Load trip, feedback, DNA profile in parallel
    const [tripRes, feedbackRes, dnaRes, memoriesRes] = await Promise.all([
      supabase
        .from("trips")
        .select(
          "destination, start_date, end_date, travelers, itinerary_data, metadata"
        )
        .eq("id", tripId)
        .single(),
      supabase
        .from("activity_feedback")
        .select("rating, activity_category, activity_type, feedback_tags, personalization_tags")
        .eq("trip_id", tripId)
        .eq("user_id", user.id),
      supabase
        .from("travel_dna_profiles")
        .select("primary_archetype_name, trait_scores, travel_dna_v2")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("trip_memories")
        .select("id")
        .eq("trip_id", tripId)
        .eq("user_id", user.id),
    ]);

    const trip = tripRes.data;
    if (!trip) throw new Error("Trip not found");

    const feedback = feedbackRes.data || [];
    const dnaProfile = dnaRes.data;
    const memoriesCount = memoriesRes.data?.length || 0;

    // Calculate trip progress
    const now = new Date();
    const start = new Date(trip.start_date);
    const end = new Date(trip.end_date);
    const totalDays =
      Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const currentDay = Math.min(
      Math.max(
        1,
        Math.ceil((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) +
          1
      ),
      totalDays
    );

    // Analyze feedback patterns
    const ratingCounts = { loved: 0, liked: 0, okay: 0, disliked: 0 };
    const categoryPrefs: Record<string, { loved: number; total: number }> = {};

    for (const f of feedback) {
      const r = f.rating as keyof typeof ratingCounts;
      if (r in ratingCounts) ratingCounts[r]++;

      const cat = f.activity_category || f.activity_type || "other";
      if (!categoryPrefs[cat]) categoryPrefs[cat] = { loved: 0, total: 0 };
      categoryPrefs[cat].total++;
      if (r === "loved" || r === "liked") categoryPrefs[cat].loved++;
    }

    // Get current archetype
    const currentArchetype =
      dnaProfile?.primary_archetype_name ||
      (dnaProfile?.travel_dna_v2 as any)?.primary_archetype_name ||
      (trip.metadata as any)?.archetype ||
      "unknown";

    // Get trait scores
    const traitScores =
      dnaProfile?.trait_scores ||
      (dnaProfile?.travel_dna_v2 as any)?.trait_scores ||
      {};

    // Count activities from itinerary
    let totalActivities = 0;
    if (trip.itinerary_data && typeof trip.itinerary_data === "object") {
      const itin = trip.itinerary_data as any;
      const days = itin.days || itin.itinerary || [];
      if (Array.isArray(days)) {
        for (const day of days) {
          const acts = day.activities || [];
          totalActivities += Array.isArray(acts) ? acts.length : 0;
        }
      }
    }

    // Build prompt
    const topCategories = Object.entries(categoryPrefs)
      .sort(([, a], [, b]) => b.loved / b.total - a.loved / a.total)
      .slice(0, 5)
      .map(([cat, stats]) => `${cat}: ${stats.loved}/${stats.total} positive`)
      .join(", ");

    const feedbackSummary = feedback.length > 0
      ? `Ratings: ${ratingCounts.loved} loved, ${ratingCounts.liked} liked, ${ratingCounts.okay} okay, ${ratingCounts.disliked} disliked. Top categories: ${topCategories}`
      : "No activity ratings yet.";

    const prompt = `Analyze this traveler's mid-trip behavior and generate DNA predictions.

TRAVELER CONTEXT:
- Current archetype: ${currentArchetype}
- Trait scores: ${JSON.stringify(traitScores)}
- Destination: ${trip.destination}
- Trip progress: Day ${currentDay} of ${totalDays}
- Travelers: ${trip.travelers || 1}

MID-TRIP DATA:
- Activities planned: ${totalActivities}
- Activities rated: ${feedback.length}
- ${feedbackSummary}
- Photos captured: ${memoriesCount}
- Feedback tags: ${[...new Set(feedback.flatMap((f) => f.feedback_tags || []))].join(", ") || "none"}
- Personalization signals: ${[...new Set(feedback.flatMap((f) => f.personalization_tags || []))].join(", ") || "none"}

Generate mid-trip DNA insights using the tool provided.`;

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
              content: `You are a Travel DNA analyst. Analyze mid-trip behavior to surface personality insights, trait shifts, and predictions. Be specific, warm, and insightful. Reference actual activities and patterns. Keep insights concise and actionable.`,
            },
            { role: "user", content: prompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "generate_dna_predictions",
                description:
                  "Generate mid-trip DNA predictions based on traveler behavior",
                parameters: {
                  type: "object",
                  properties: {
                    headline: {
                      type: "string",
                      description:
                        "A punchy 5-8 word headline about their travel personality this trip (e.g. 'Your inner foodie is taking over')",
                    },
                    travelingAs: {
                      type: "string",
                      description:
                        "What archetype they're traveling as RIGHT NOW based on behavior, may differ from their profile archetype",
                    },
                    traitShifts: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          trait: { type: "string" },
                          direction: {
                            type: "string",
                            enum: ["up", "down", "stable"],
                          },
                          insight: {
                            type: "string",
                            description: "One sentence explaining the shift",
                          },
                        },
                        required: ["trait", "direction", "insight"],
                      },
                      description: "2-4 trait shifts detected from behavior",
                    },
                    prediction: {
                      type: "string",
                      description:
                        "A fun prediction for the rest of the trip based on patterns (1-2 sentences)",
                    },
                    surprisingPattern: {
                      type: "string",
                      description:
                        "Something unexpected about their behavior vs their DNA profile (1 sentence). Null if no surprise.",
                    },
                    engagementScore: {
                      type: "number",
                      description:
                        "0-100 score of how engaged they are with the trip based on ratings, photos, activity completion",
                    },
                  },
                  required: [
                    "headline",
                    "travelingAs",
                    "traitShifts",
                    "prediction",
                    "engagementScore",
                  ],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "generate_dna_predictions" },
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
          currentArchetype,
          tripDay: currentDay,
          totalDays,
          feedbackCount: feedback.length,
          memoriesCount,
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
