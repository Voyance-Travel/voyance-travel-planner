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

    // ─── Look up cost_reference for this destination to ground AI suggestions ───
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
    const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || "";
    let costRefLookup = "";
    if (SUPABASE_URL && SUPABASE_SERVICE_KEY && destination) {
      try {
        const { createClient } = await import("npm:@supabase/supabase-js@2.90.1");
        const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
        const { data: refs } = await sb
          .from("cost_reference")
          .select("category, subcategory, item_name, cost_low_usd, cost_mid_usd, cost_high_usd")
          .ilike("destination_city", destination.split(",")[0].trim())
          .limit(50);
        if (refs && refs.length > 0) {
          costRefLookup = "\n\nREFERENCE PRICING (use these, NOT your own guesses):\n" +
            refs.map((r: any) => `${r.category}/${r.subcategory || "general"} (${r.item_name || ""}): $${r.cost_low_usd}-$${r.cost_mid_usd}-$${r.cost_high_usd}`).join("\n");
        }
      } catch (refErr) {
        console.warn("cost_reference lookup failed:", refErr);
      }
    }

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

    const systemPrompt = `You are a travel budget coach. You analyze itineraries and suggest specific cost-cutting swaps. You NEVER suggest removing an activity entirely — always suggest a cheaper replacement that gives a similar experience.

CRITICAL NAMING RULE:
- Every "suggested_swap" MUST be a specific, real venue or experience name (e.g., "Joe's Pizza on Carmine St", "Self-guided walk through Montmartre", "Trattoria da Mario").
- NEVER use generic descriptions like "Lower cost restaurant", "Cheaper option", "Budget alternative", "Similar restaurant", "Local eatery", or "Affordable café".
- If you cannot name a specific real venue, describe a specific experience (e.g., "Street food at Jemaa el-Fnaa night market" or "Picnic with provisions from Marché d'Aligre").

CRITICAL COST RULES:
- You must NEVER invent or guess prices. Use ONLY the reference pricing data provided below.
- If no reference pricing is available for a swap, use conservative estimates well below the current cost.
- Your new_cost must ALWAYS be strictly LESS than the current_cost. If you can't find a cheaper alternative, skip that item.
- All costs are in whole currency units (e.g., 50 for $50), NOT cents.`;

    const userPrompt = `The user's travel itinerary to ${destination || "their destination"} costs ${currency} ${currentTotal} but their budget is ${currency} ${budgetTarget}. They need to cut ${currency} ${gap}.

Here is the full itinerary:

${itinerarySummary}
${costRefLookup}

Suggest 5-8 specific cost-cutting swaps. For each:
1. Identify the expensive item (name + current cost)
2. Suggest a cheaper alternative that gives a similar experience
3. The new_cost MUST come from the reference pricing above, not from your own estimates
4. Calculate the exact savings
5. Write a suggested_description that reads like an itinerary activity description — focus on the experience, not the budget reasoning

Types of swaps to consider:
- Private/guided tours → general admission or self-guided
- Expensive dinner restaurants → the same restaurant for lunch (keep the original venue name — do NOT prefix with "Lunch at"; explain the lunch-price saving in the "reason" field)
- Fine dining → great local spots or street food
- Taxi rides → metro/walking if distance is reasonable
- Paid activities → free alternatives in the same area
- Premium experiences → mid-range alternatives

Rules:
- NEVER suggest removing an activity — always suggest a cheaper replacement
- Suggestions must be specific to THIS itinerary and destination
- Include real venue/restaurant names when possible
- Rank by savings amount (biggest first)
- All costs in ${currency} as integers (no decimals)
- NEVER suggest the same replacement venue/restaurant in more than one suggestion. Each swap must recommend a DIFFERENT specific place, even if multiple items are in the same category (e.g., if two breakfasts need swaps, suggest two different affordable cafés).`;

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
                              "The specific name of a real venue, restaurant, or experience to replace the current one. Must be a concrete, real place name (e.g. 'Trattoria da Mario', 'Self-guided walk through Montmartre') — NOT a generic description like 'lower cost restaurant' or 'cheaper option'.",
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
                              "Brief explanation of why this swap saves money (shown in coach panel only)",
                          },
                          suggested_description: {
                            type: "string",
                            description:
                              "A short, experience-focused description of the replacement activity as it should appear on the itinerary card (e.g. 'Grab gourmet sandwiches from Lenwich and enjoy a picnic in Central Park'). Do NOT include budget reasoning here.",
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
                          "suggested_description",
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

    // Build a lookup of original activity costs (already in cents from the caller)
    const activityCostCentsById = new Map<string, number>();
    for (const day of itinerary_days) {
      for (const activity of day.activities ?? []) {
        if (typeof activity.cost === "number" && Number.isFinite(activity.cost) && activity.cost > 0) {
          activityCostCentsById.set(activity.id, Math.round(activity.cost));
        }
      }
    }

    console.log("Activity costs (cents) from caller:", JSON.stringify(Object.fromEntries(activityCostCentsById)));

    // The AI is instructed to return whole-currency values (e.g. 50 for $50).
    // We simply multiply by 100 to get cents. No heuristic.
    suggestions = suggestions
      .map((s: any) => {
        const rawNew = typeof s.new_cost === "number" ? s.new_cost : null;
        if (rawNew === null || rawNew < 0) return null;

        // GENERIC NAME FILTER: reject vague swap names
        const swapName = (s.suggested_swap || "").toLowerCase();
        const GENERIC_PATTERNS = [
          "lower cost", "cheaper", "budget", "affordable", "inexpensive",
          "alternative option", "similar restaurant", "similar cafe", "similar café",
          "local eatery", "local restaurant", "local cafe", "local café",
          "generic", "another option", "different restaurant", "different cafe",
          "mid-range", "moderately priced", "less expensive", "cost-effective",
          "economy", "no-frills",
        ];
        const isGeneric = GENERIC_PATTERNS.some((p) => swapName.includes(p));
        if (isGeneric) {
          console.log(`  → FILTERED OUT generic swap name: "${s.suggested_swap}"`);
          return null;
        }

        // Convert AI's whole-currency value to cents
        const newCostCents = Math.round(rawNew * 100);

        // Use the known activity cost as ground truth (already in cents)
        const knownCostCents = activityCostCentsById.get(String(s.activity_id));
        const currentCostCents = knownCostCents ?? Math.round((typeof s.current_cost === "number" ? s.current_cost : 0) * 100);

        console.log(`Suggestion "${s.suggested_swap}": AI current=${s.current_cost}, AI new=${s.new_cost}, knownCents=${knownCostCents}, newCents=${newCostCents}, currentCents=${currentCostCents}`);

        // STRICT GUARD: new cost must be strictly less than current cost
        if (newCostCents >= currentCostCents) {
          console.log(`  → FILTERED OUT (new ${newCostCents} >= current ${currentCostCents})`);
          return null;
        }

        return {
          ...s,
          current_cost: currentCostCents,
          new_cost: newCostCents,
          savings: currentCostCents - newCostCents,
        };
      })
      .filter(Boolean) as any[];

    // Sort by savings desc
    suggestions.sort((a: any, b: any) => b.savings - a.savings);

    console.log(`Returning ${suggestions.length} valid suggestions`);

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
