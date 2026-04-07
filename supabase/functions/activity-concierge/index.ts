import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface ActivityContext {
  title: string;
  venue_name: string;
  address: string;
  category: string;
  start_time: string;
  end_time: string;
  date: string;
  day_of_week: string;
  cost_per_person: number;
  description: string;
  booking_required: boolean;
  website?: string;
}

interface TripContext {
  city: string;
  country: string;
  trip_type: string;
  total_days: number;
  num_guests: number;
  start_date: string;
  end_date: string;
  currency: string;
}

interface SurroundingContext {
  previous_activity?: string;
  next_activity?: string;
  day_title: string;
}

function buildSystemPrompt(
  activity: ActivityContext,
  trip: TripContext,
  surrounding: SurroundingContext
): string {
  return `You are a Voyance AI concierge providing personalized advice about a specific activity on the user's trip.

CONTEXT:
- Activity: ${activity.title} at ${activity.venue_name}
- Location: ${activity.address}
- Category: ${activity.category}
- When: ${activity.day_of_week}, ${activity.date} at ${activity.start_time}${activity.end_time ? ` - ${activity.end_time}` : ""}
- Trip: ${trip.total_days}-day ${trip.trip_type} trip to ${trip.city}, ${trip.country} for ${trip.num_guests} guest(s)
- Budget per person for this activity: ${activity.cost_per_person} ${trip.currency}
- Day theme: ${surrounding.day_title}
${surrounding.previous_activity ? `- Previous activity: ${surrounding.previous_activity}` : ""}
${surrounding.next_activity ? `- Next activity: ${surrounding.next_activity}` : ""}
${activity.description ? `- Activity description: ${activity.description}` : ""}

YOUR ROLE:
1. You are a knowledgeable local concierge who knows this venue intimately
2. Proactively share insider tips, what to order, what to skip, dress codes, reservation advice
3. Be aware of the DAY and TIME — mention if opening hours might be an issue, if it's typically crowded at that time, etc.
4. If the user asks "suggest an alternative," use the suggest_alternatives tool to provide 2-3 real alternatives in the same price range and category, with brief reasons why
5. Keep responses concise and practical — this is trip planning, not an essay
6. NEVER make up fake venue names. Only suggest real, verifiable restaurants/attractions.
7. Be aware of the trip type (Luminary = luxury, Explorer = mid-range, Budget = affordable) and tailor suggestions accordingly.
8. Format with short paragraphs and bullet points for readability.`;
}

const ALTERNATIVES_TOOL = {
  type: "function" as const,
  function: {
    name: "suggest_alternatives",
    description:
      "Suggest 2-3 real alternative venues in the same category and price range. Use this when the user asks for alternatives, wants to swap, or asks for other options.",
    parameters: {
      type: "object",
      properties: {
        intro_text: {
          type: "string",
          description: "A brief intro sentence before listing alternatives",
        },
        alternatives: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string", description: "Real venue name" },
              address: {
                type: "string",
                description: "Full address in the city",
              },
              price_per_person: {
                type: "number",
                description: "Estimated cost per person in trip currency",
              },
              reason: {
                type: "string",
                description: "One-line reason why this is a good alternative",
              },
              category: {
                type: "string",
                description: "Activity category (dining, cultural, activity, etc.)",
              },
            },
            required: ["name", "address", "price_per_person", "reason"],
          },
        },
      },
      required: ["alternatives", "intro_text"],
    },
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, activityContext, tripContext, surroundingContext } =
      await req.json();

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = buildSystemPrompt(
      activityContext,
      tripContext,
      surroundingContext
    );

    // Check if the latest user message is asking for alternatives
    const lastMsg = messages[messages.length - 1];
    const isAskingAlternatives =
      lastMsg &&
      /\b(alternative|swap|replace|suggest|other option|different|instead)\b/i.test(
        lastMsg.content
      );

    const body: Record<string, unknown> = {
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: true,
    };

    if (isAskingAlternatives) {
      body.tools = [ALTERNATIVES_TOOL];
    }

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add funds in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("activity-concierge error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
