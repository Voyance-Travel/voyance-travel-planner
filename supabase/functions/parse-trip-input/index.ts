import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const EXTRACT_TOOL = {
  type: "function" as const,
  function: {
    name: "extract_trip_data",
    description: "Extract structured trip data from pasted text, separating user preferences/prompt from itinerary output.",
    parameters: {
      type: "object",
      properties: {
        preferences: {
          type: "object",
          description: "User preferences extracted from their original prompt (if present). Null if no prompt section detected.",
          properties: {
            budget: { type: "string", description: "Budget text as stated, e.g. '$150-200/day'" },
            budgetLevel: { type: "string", enum: ["budget", "mid-range", "luxury"] },
            focus: { type: "array", items: { type: "string" }, description: "Trip focus areas, e.g. ['food', 'live music']" },
            avoid: { type: "array", items: { type: "string" }, description: "Things to avoid, e.g. ['crowds', 'touristy']" },
            dietary: { type: "array", items: { type: "string" }, description: "Dietary restrictions, e.g. ['vegetarian']" },
            walkability: { type: "string", description: "Walkability preference" },
            pace: { type: "string", description: "Trip pace preference" },
            accessibility: { type: "array", items: { type: "string" } },
            rawPreferenceText: { type: "string", description: "The original prompt text verbatim" },
          },
          additionalProperties: false,
        },
        destination: { type: "string" },
        dates: {
          type: "object",
          properties: {
            start: { type: "string" },
            end: { type: "string" },
          },
          additionalProperties: false,
        },
        duration: { type: "number", description: "Trip duration in days" },
        travelers: { type: "number" },
        tripType: { type: "string" },
        days: {
          type: "array",
          items: {
            type: "object",
            properties: {
              dayNumber: { type: "number" },
              date: { type: "string" },
              theme: { type: "string" },
              dailyBudget: { type: "number" },
              activities: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    name: { type: "string" },
                    time: { type: "string", description: "Time like '9:00 AM', 'Morning', 'Afternoon', 'Evening', 'Lunch', 'Dinner'" },
                    location: { type: "string", description: "Venue/place name or address if provided" },
                    cost: { type: "number" },
                    currency: { type: "string", description: "ISO currency code detected from symbols like $, €, ¥" },
                    notes: { type: "string", description: "Tips, descriptions, parenthetical comments" },
                    description: { type: "string" },
                    category: { type: "string", enum: ["dining", "attraction", "activity", "transport", "lodging", "shopping", "nightlife", "relaxation", "cultural"] },
                    isOption: { type: "boolean", description: "True if this is one of multiple either/or choices" },
                    optionGroup: { type: "string", description: "Shared ID for either/or options, e.g. 'dinner-d1', 'morning-d2'" },
                    bookingRequired: { type: "boolean" },
                  },
                  required: ["name"],
                  additionalProperties: false,
                },
              },
            },
            required: ["dayNumber", "activities"],
            additionalProperties: false,
          },
        },
        accommodationNotes: { type: "array", items: { type: "string" } },
        practicalTips: { type: "array", items: { type: "string" } },
        unparsed: { type: "array", items: { type: "string" }, description: "Text that couldn't be parsed into structured data" },
      },
      required: ["days"],
      additionalProperties: false,
    },
  },
};

const SYSTEM_PROMPT = `You are a travel itinerary parser. The user will paste text that may contain:

1. Their ORIGINAL PROMPT to another AI (how they asked for the trip) — detect this by looking for first-person instructions like "Build me a...", "I want...", "My budget is...", "Format it as...", separators like "---", "My prompt:", "I asked:", etc.

2. The AI's OUTPUT (the actual itinerary) — structured as days with activities, possibly in tables, bullets, prose, or mixed formats.

Your job:
- If both sections are present, extract preferences from section 1 and itinerary from section 2
- If only an itinerary is present, extract itinerary only (set preferences to null)
- Handle Markdown tables by mapping column headers dynamically (Time/When/Hour → time, Activity/What → name, Location/Where/Place → location, Cost/Price/$ → cost, Notes/Tips/Vibe → notes)
- Detect either/or options (expressed as "X or Y", "Option A/B", "(if you want X) or (if you prefer Y)") and assign matching optionGroup IDs like "dinner-d1", "morning-d2"
- Extract accommodation/hotel recommendations into accommodationNotes
- Extract practical tips, packing advice, travel logistics into practicalTips
- Ignore meta-content like "If you want, I can..." or "Tell me what kind of trip..."
- Preserve original notes, parenthetical comments, and emoji as notes
- Detect currency from symbols: $ → USD, € → EUR, ¥ → JPY, £ → GBP
- For costs like "~$15" or "$30", extract the number
- "Free" or "free" → cost: 0
- Set source: 'parsed' on all activities (handled by frontend)

Be thorough but don't hallucinate data that isn't in the text.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response(JSON.stringify({ error: 'Text input is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (text.length > 50000) {
      return new Response(JSON.stringify({ error: 'Input too long. Please paste a shorter itinerary.' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

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
          { role: "user", content: text },
        ],
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "function", function: { name: "extract_trip_data" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please wait a moment and try again." }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable. Please try again later." }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to parse trip input" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const result = await response.json();
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(result));
      return new Response(JSON.stringify({ error: "Failed to extract structured data from input" }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);

    // Add source: 'parsed' to all activities
    if (parsed.days) {
      for (const day of parsed.days) {
        if (day.activities) {
          for (const activity of day.activities) {
            activity.source = 'parsed';
          }
        }
      }
    }

    return new Response(JSON.stringify(parsed), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error("parse-trip-input error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
