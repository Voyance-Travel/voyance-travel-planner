import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are a friendly travel planning assistant for Voyance. Your job is to gather trip details from the user through natural conversation.

You need to collect:
1. Destination (required)
2. Travel dates or approximate timeframe (required)
3. Number of travelers (required)
4. Trip type/occasion (e.g. leisure, honeymoon, family, girls trip, bachelor/bachelorette, anniversary, birthday, business)
5. Budget (helpful but optional)
6. Hotel/accommodation details (optional)
7. Flight/transportation details (optional)
8. Must-do activities or restrictions (optional)

Guidelines:
- Be warm, conversational, and concise. Keep responses under 3 sentences when possible.
- If the user pastes in a block of research or notes, parse what you can from it.
- Don't ask for all details at once — guide naturally. Start by acknowledging what they've shared, then ask for what's missing.
- When you have at least destination, dates, and travelers, let them know you have enough to generate but ask if they have anything else to add.
- Never mention AI, ChatGPT, or any specific AI tool. You are Voyance.

IMPORTANT: When you believe you have enough details to generate an itinerary, you MUST call the "extract_trip_details" tool to return the structured data. Call this tool when:
- You have at least destination, dates (or approximate), and number of travelers
- The user confirms they're ready or says they have nothing else to add
- You've asked if there's anything else and they indicate no

Always be ready to extract partial data — missing fields are fine, just extract what you have.`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const response = await fetch(
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
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_trip_details",
                description:
                  "Extract structured trip details from the conversation when enough information has been gathered (at minimum: destination, dates, travelers).",
                parameters: {
                  type: "object",
                  properties: {
                    destination: {
                      type: "string",
                      description: "Primary destination city/region",
                    },
                    startDate: {
                      type: "string",
                      description: "Trip start date in YYYY-MM-DD format if known",
                    },
                    endDate: {
                      type: "string",
                      description: "Trip end date in YYYY-MM-DD format if known",
                    },
                    travelers: {
                      type: "number",
                      description: "Number of travelers",
                    },
                    tripType: {
                      type: "string",
                      enum: [
                        "leisure",
                        "honeymoon",
                        "anniversary",
                        "birthday",
                        "family",
                        "girls_trip",
                        "guys_trip",
                        "bachelor",
                        "bachelorette",
                        "business",
                        "solo",
                        "reunion",
                        "graduation",
                        "retirement",
                      ],
                      description: "Type/occasion of the trip",
                    },
                    budgetAmount: {
                      type: "number",
                      description:
                        "Total budget in USD if mentioned",
                    },
                    hotelName: {
                      type: "string",
                      description: "Hotel name if mentioned",
                    },
                    hotelAddress: {
                      type: "string",
                      description: "Hotel address if mentioned",
                    },
                    mustDoActivities: {
                      type: "string",
                      description:
                        "Any must-do activities, restrictions, or requirements mentioned",
                    },
                    additionalNotes: {
                      type: "string",
                      description:
                        "Any other relevant details the user shared",
                    },
                  },
                  required: ["destination", "travelers"],
                },
              },
            },
          ],
          stream: true,
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Usage limit reached. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(
        JSON.stringify({ error: "AI service error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat-trip-planner error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
