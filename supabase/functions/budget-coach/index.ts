import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Activity {
  id: string;
  title: string;
  category?: string;
  cost: number;
  currency: string;
  day_number: number;
  description?: string;
}

interface RequestBody {
  itinerary_days: {
    dayNumber: number;
    date?: string;
    activities: Activity[];
  }[];
  budget_target_cents: number;
  current_total_cents: number;
  currency: string;
  destination?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { itinerary_days, budget_target_cents, current_total_cents, currency, destination } =
      (await req.json()) as RequestBody;

    const gap_cents = current_total_cents - budget_target_cents;
    if (gap_cents <= 0) {
      return new Response(
        JSON.stringify({ suggestions: [], on_target: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build a concise itinerary summary for the prompt
    const itinerarySummary = itinerary_days
      .map((day) => {
        const acts = day.activities
          .map(
            (a) =>
              `  - [${a.id}] ${a.title} (${a.category || "activity"}) — ${currency} ${(a.cost / 100).toFixed(0)}`
          )
          .join("\n");
        return `Day ${day.dayNumber}${day.date ? ` (${day.date})` : ""}:\n${acts || "  (no activities)"}`;
      })
      .join("\n\n");

    const budgetTarget = (budget_target_cents / 100).toFixed(0);
    const currentTotal = (current_total_cents / 100).toFixed(0);
    const gap = (gap_cents / 100).toFixed(0);

    const systemPrompt = `You are a travel budget coach. You analyze itineraries and suggest specific cost-cutting swaps. You NEVER suggest removing an activity entirely — always suggest a cheaper replacement that gives a similar experience. Be specific with real venue/restaurant names when possible.`;

    const userPrompt = `The user's travel itinerary to ${destination || "their destination"} costs ${currency} ${currentTotal} but their budget is ${currency} ${budgetTarget}. They need to cut ${currency} ${gap}.

Here is the full itinerary:

${itinerarySummary}

Suggest 5-8 specific cost-cutting swaps. For each:
1. Identify the expensive item (name + current cost)
2. Suggest a cheaper alternative that gives a similar experience
3. Calculate the exact savings

Types of swaps to consider:
- Private/guided tours → general admission or self-guided
- Expensive dinner restaurants → the same restaurant for lunch
- Fine dining → great local spots or street food
- Taxi rides → metro/walking if distance is reasonable
- Paid activities → free alternatives in the same area
- Premium experiences → mid-range alternatives
- Paid cooking classes → free food market walks

Rules:
- NEVER suggest removing an activity — always suggest a cheaper replacement
- Suggestions must be specific to THIS itinerary and destination
- Include real venue/restaurant names when possible
- Rank by savings amount (biggest first)
- All costs in ${currency} as integers (no decimals)`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "return_budget_suggestions",
                description:
                  "Return an array of budget-cutting swap suggestions for the itinerary.",
                parameters: {
                  type: "object",
                  properties: {
                    suggestions: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          current_item: {
                            type: "string",
                            description: "Name of the expensive item",
                          },
                          current_cost: {
                            type: "number",
                            description:
                              "Current cost in whole currency units (e.g. 50 for $50)",
                          },
                          suggested_swap: {
                            type: "string",
                            description:
                              "Name of the cheaper alternative",
                          },
                          new_cost: {
                            type: "number",
                            description:
                              "New cost in whole currency units (e.g. 30 for $30)",
                          },
                          savings: {
                            type: "number",
                            description: "Savings in whole currency units",
                          },
                          reason: {
                            type: "string",
                            description:
                              "Brief explanation of why this swap works",
                          },
                          day_number: {
                            type: "number",
                            description: "Which day this activity is on",
                          },
                          activity_id: {
                            type: "string",
                            description: "The ID of the activity to swap",
                          },
                        },
                        required: [
                          "current_item",
                          "current_cost",
                          "suggested_swap",
                          "new_cost",
                          "savings",
                          "reason",
                          "day_number",
                          "activity_id",
                        ],
                        additionalProperties: false,
                      },
                    },
                  },
                  required: ["suggestions"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "return_budget_suggestions" },
          },
        }),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    let suggestions: any[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        suggestions = parsed.suggestions || [];
      } catch {
        console.error("Failed to parse tool call arguments");
      }
    }

    // Normalize model costs safely (model may return either whole-currency or cents)
    const activityCostById = new Map<string, number>();
    for (const day of itinerary_days) {
      for (const activity of day.activities ?? []) {
        if (typeof activity.cost === "number" && Number.isFinite(activity.cost)) {
          activityCostById.set(activity.id, Math.max(0, Math.round(activity.cost)));
        }
      }
    }

    const toNumber = (value: unknown): number | null => {
      if (typeof value === "number" && Number.isFinite(value)) return value;
      if (typeof value === "string") {
        const cleaned = value.replace(/[^\d.-]/g, "");
        const parsed = Number(cleaned);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    };

    suggestions = suggestions
      .map((s: any) => {
        const rawCurrent = toNumber(s.current_cost);
        const rawNew = toNumber(s.new_cost);
        if (rawCurrent === null || rawNew === null || rawNew < 0) return null;

        const originalCostCents = activityCostById.get(String(s.activity_id));
        let multiplier = 100; // default: model returns whole-currency

        if (typeof originalCostCents === "number" && originalCostCents > 0) {
          const asWholeDelta = Math.abs(Math.round(rawCurrent * 100) - originalCostCents);
          const asCentsDelta = Math.abs(Math.round(rawCurrent) - originalCostCents);
          multiplier = asCentsDelta < asWholeDelta ? 1 : 100;
        }

        const currentCost =
          typeof originalCostCents === "number" && originalCostCents > 0
            ? originalCostCents
            : Math.max(0, Math.round(rawCurrent * multiplier));

        let newCost = Math.max(0, Math.round(rawNew * multiplier));
        const altNewCost = Math.max(0, Math.round(rawNew * (multiplier === 100 ? 1 : 100)));

        // Never allow a swap suggestion to increase price
        if (newCost > currentCost && altNewCost <= currentCost) {
          newCost = altNewCost;
        }
        if (newCost >= currentCost) return null;

        return {
          ...s,
          current_cost: currentCost,
          new_cost: newCost,
          savings: currentCost - newCost,
        };
      })
      .filter(Boolean) as any[];

    // Sort by savings desc
    suggestions.sort((a: any, b: any) => b.savings - a.savings);

    return new Response(
      JSON.stringify({ suggestions, on_target: false }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("budget-coach error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
