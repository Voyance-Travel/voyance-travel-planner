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
  /** User-protected category labels (e.g. ["Dining", "Hotels"]). */
  protected_categories?: string[];
  /** Activity IDs the user has explicitly dismissed via "Don't suggest". */
  dismissed_activity_ids?: string[];
  /** Per-category overrun in cents (planned - allocated). Positive = over. */
  category_overruns?: Partial<Record<"Dining" | "Hotels" | "Tours" | "Transit" | "Activities", number>>;
  /** Activity IDs that must NEVER be dropped (Day-1 dinner, Michelin, palace hotel anchors). */
  anchor_activity_ids?: string[];
  /** Client signal: gap is large enough that swap-only won't bridge it. Allows drop / consolidate. */
  deep_cuts_requested?: boolean;
}

// ─── Category normalization ─────────────────────────────────────
// Maps user-facing labels → the set of raw category/type strings the AI
// itinerary uses. Keep this list in lockstep with the client's CATEGORY_GROUPS
// in src/components/planner/budget/BudgetCoach.tsx.
const CATEGORY_GROUPS: Record<string, string[]> = {
  Dining: ["dining", "breakfast", "lunch", "dinner", "brunch", "cafe", "café", "coffee", "food", "restaurant", "meal", "nightcap", "drinks", "bar"],
  Hotels: ["hotel", "accommodation", "lodging", "stay", "resort", "check-in", "check-out", "bag-drop"],
  Tours: ["tour", "guided_tour", "guided tour", "experience", "attraction", "excursion"],
  Transit: ["transit", "transport", "transportation", "taxi", "train", "flight", "transfer", "metro", "subway"],
  Activities: ["activity", "sightseeing", "museum", "gallery", "culture", "wellness", "shopping", "park", "landmark"],
};

function activityMatchesProtectedGroup(
  activity: Activity,
  protectedLabels: string[]
): boolean {
  if (!protectedLabels?.length) return false;
  const cat = (activity.category || "").toLowerCase().trim();
  if (!cat) return false;
  for (const label of protectedLabels) {
    const tokens = CATEGORY_GROUPS[label];
    if (!tokens) continue;
    if (tokens.some((t) => cat.includes(t))) return true;
  }
  return false;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      itinerary_days,
      budget_target_cents,
      current_total_cents,
      currency,
      destination,
      protected_categories = [],
      dismissed_activity_ids = [],
      category_overruns = {},
    } = (await req.json()) as RequestBody;

    const gap_cents = current_total_cents - budget_target_cents;
    if (gap_cents <= 0) {
      return new Response(
        JSON.stringify({ suggestions: [], on_target: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // ─── Pre-filter: drop protected & dismissed activities entirely ───
    const dismissedSet = new Set(dismissed_activity_ids.map(String));
    const protectedActivityIds = new Set<string>();
    const filteredDays = itinerary_days.map((day) => ({
      ...day,
      activities: (day.activities ?? []).filter((a) => {
        if (dismissedSet.has(String(a.id))) return false;
        if (activityMatchesProtectedGroup(a, protected_categories)) {
          protectedActivityIds.add(String(a.id));
          return false;
        }
        return true;
      }),
    }));

    const remainingActivityCount = filteredDays.reduce(
      (n, d) => n + d.activities.length,
      0
    );

    if (remainingActivityCount === 0) {
      return new Response(
        JSON.stringify({
          suggestions: [],
          on_target: false,
          all_protected: true,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    // Build a concise itinerary summary for the prompt (post-filter).
    // Drop $0 / unknown-cost rows — they aren't candidates for "make cheaper"
    // and their presence encourages the model to invent items to fill gaps.
    const itinerarySummary = filteredDays
      .map((day) => {
        const acts = day.activities
          .filter((a) => typeof a.cost === "number" && a.cost > 0)
          .map(
            (a) =>
              `  - [${a.id}] ${a.title} (${a.category || "activity"}) — ${currency} ${(a.cost / 100).toFixed(0)}`
          )
          .join("\n");
        return `Day ${day.dayNumber}${day.date ? ` (${day.date})` : ""}:\n${acts || "  (no swappable activities)"}`;
      })
      .join("\n\n");

    const budgetTarget = (budget_target_cents / 100).toFixed(0);
    const currentTotal = (current_total_cents / 100).toFixed(0);
    const gap = (gap_cents / 100).toFixed(0);

    // Build the protected-categories clause for the prompt
    const protectedClause = protected_categories.length > 0
      ? `\n\nPROTECTED CATEGORIES — DO NOT TOUCH:
The user has marked these categories as non-negotiable for this trip: ${protected_categories.join(", ")}.
Items in these categories have already been removed from the itinerary you see below — do NOT invent suggestions for them, and do NOT propose swaps in these categories under any other guise (e.g. don't suggest a cheaper restaurant if Dining is protected, even if you remember an item from earlier context).
This trip's identity is built around those categories. Suggesting swaps for them is a hard failure.`
      : "";

    // ─── Priority overruns clause ──────────────────────────────────
    // Per-category overruns supplied by the client. Force the model to
    // prioritize swaps in over-allocated categories (e.g. Transit at 131%).
    const overrunEntries = Object.entries(category_overruns)
      .filter(([label, cents]) => typeof cents === "number" && cents > 0 && !protected_categories.includes(label))
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3);
    const priorityOverrunsClause = overrunEntries.length > 0
      ? `\n\nPRIORITY OVERRUNS (must address first):
The following categories are OVER their per-trip allocation:
${overrunEntries.map(([label, cents]) => `  • ${label}: $${Math.round((cents as number) / 100)} over allocated budget`).join("\n")}
At least your TOP ${Math.min(overrunEntries.length + 1, 4)} suggestions MUST target items in these overrun categories before suggesting swaps elsewhere. For Transit overruns, prefer demoting taxi/private-car legs to metro, bus, or walking. Use reference pricing for the new mode.`
      : "";

    const systemPrompt = `You are a travel budget coach. You analyze itineraries and suggest specific cost-cutting swaps. You NEVER suggest removing an activity entirely — always suggest a cheaper replacement that gives a similar experience.

CRITICAL NAMING RULE:
- Every "suggested_swap" MUST be a specific, real venue or experience name (e.g., "Joe's Pizza on Carmine St", "Self-guided walk through Montmartre", "Trattoria da Mario").
- NEVER use generic descriptions like "Lower cost restaurant", "Cheaper option", "Budget alternative", "Similar restaurant", "Local eatery", or "Affordable café".
- If you cannot name a specific real venue, describe a specific experience (e.g., "Street food at Jemaa el-Fnaa night market" or "Picnic with provisions from Marché d'Aligre").

CRITICAL COST RULES:
- You must NEVER invent, guess, or calculate prices yourself. Use ONLY the reference pricing data provided below.
- You must NEVER directly modify or set an activity's cost value. You can only SUGGEST SWAPS to cheaper alternatives.
- When suggesting a swap, the new_cost MUST come from the reference pricing table, not from your own estimation.
- If no reference pricing is available for a swap, use the lowest reasonable amount from the reference data for that category.
- Your new_cost must ALWAYS be strictly LESS than the current_cost. If you can't find a cheaper alternative, skip that item.
- All costs are in whole currency units (e.g., 50 for $50), NOT cents.
- NEVER output a cost number without it being sourced from the reference pricing data.${protectedClause}${priorityOverrunsClause}`;

    const userPrompt = `The user's travel itinerary to ${destination || "their destination"} costs ${currency} ${currentTotal} but their budget is ${currency} ${budgetTarget}. They need to cut ${currency} ${gap}.

Here is the full itinerary (items in protected categories have been removed):

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

    // Build lookups for ID-existence + title-match guards. Use the FULL
    // itinerary so we can validate IDs even if they referenced a protected
    // or dismissed item (filtered separately below).
    const activityCostCentsById = new Map<string, number>();
    const activityTitleById = new Map<string, string>();
    const allValidIds = new Set<string>();
    for (const day of itinerary_days) {
      for (const activity of day.activities ?? []) {
        const sid = String(activity.id);
        allValidIds.add(sid);
        activityTitleById.set(sid, String(activity.title || ""));
        if (typeof activity.cost === "number" && Number.isFinite(activity.cost) && activity.cost > 0) {
          activityCostCentsById.set(sid, Math.round(activity.cost));
        }
      }
    }

    // Title-match helper: tolerant comparison between AI-claimed item name
    // and the real activity title for a given ID. Stop-words (meal/category/day
    // tokens) are excluded so a single shared word like "dinner" cannot pass.
    const TITLE_STOPWORDS = new Set([
      "dinner", "lunch", "breakfast", "brunch", "meal", "snack", "drinks",
      "activity", "activities", "transport", "transit", "taxi", "metro",
      "hotel", "accommodation", "stay", "checkin", "checkout",
      "day", "evening", "morning", "afternoon", "night",
      "restaurant", "cafe", "café", "bar", "tour", "visit",
    ]);
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[^a-z0-9\s]+/g, " ").replace(/\s+/g, " ").trim();
    const tokenize = (s: string) =>
      new Set(
        normalize(s)
          .split(" ")
          .filter((t) => t.length >= 4 && !TITLE_STOPWORDS.has(t))
      );
    const titleMatches = (claimed: string, real: string): boolean => {
      const c = normalize(claimed);
      const r = normalize(real);
      if (!c || !r) return false;
      // Substring match only counts when the shared side is meaningfully long
      const shorter = c.length <= r.length ? c : r;
      const longer = shorter === c ? r : c;
      if (shorter.length >= 8 && longer.includes(shorter)) return true;
      const ct = tokenize(claimed);
      const rt = tokenize(real);
      if (ct.size === 0 || rt.size === 0) return false;
      let overlap = 0;
      for (const t of ct) if (rt.has(t)) overlap++;
      // Require at least 2 non-stopword tokens in common
      return overlap >= 2;
    };

    // Placeholder titles indicate the underlying activity is unresolved — the
    // coach has nothing concrete to swap, so reject any suggestion against one.
    const PLACEHOLDER_TITLE_RE = /^(breakfast|lunch|dinner|brunch|meal|activity|activities|transport|transit|hotel|accommodation|untitled)\s*(\(|-|–|—|$)/i;
    const isPlaceholderTitle = (t?: string) => {
      const s = (t || "").trim();
      if (!s) return true;
      if (/^(activity|untitled|tbd|n\/a)$/i.test(s)) return true;
      return PLACEHOLDER_TITLE_RE.test(s);
    };

    console.log("Activity costs (cents) from caller:", JSON.stringify(Object.fromEntries(activityCostCentsById)));
    console.log(`Protections: categories=${JSON.stringify(protected_categories)} dismissed=${dismissed_activity_ids.length} preFilteredOut=${protectedActivityIds.size} validIds=${allValidIds.size}`);

    // The AI is instructed to return whole-currency values (e.g. 50 for $50).
    // We simply multiply by 100 to get cents. No heuristic.
    suggestions = suggestions
      .map((s: any) => {
        const rawNew = typeof s.new_cost === "number" ? s.new_cost : null;
        if (rawNew === null || rawNew < 0) return null;

        // POST-FILTER: drop any suggestion targeting a protected or dismissed
        // activity (model drift safety net — the prompt should prevent this,
        // but we guard against it anyway).
        const sid = String(s.activity_id);

        // ID-MUST-EXIST GUARD: drop hallucinated IDs that aren't in the trip.
        if (!allValidIds.has(sid)) {
          console.log(`  → FILTERED OUT (unknown activity_id "${sid}", claimed item: "${s.current_item}")`);
          return null;
        }

        if (dismissedSet.has(sid)) {
          console.log(`  → FILTERED OUT (dismissed activity ${sid})`);
          return null;
        }
        if (protectedActivityIds.has(sid)) {
          console.log(`  → FILTERED OUT (protected activity ${sid} in ${protected_categories.join(",")})`);
          return null;
        }

        // PLACEHOLDER-TITLE GUARD: if the real itinerary row is just a generic
        // placeholder ("Dinner (Day 2)", "transport (Day 2)", "Activity"), the
        // coach has nothing concrete to swap — reject to avoid phantom suggestions.
        const realTitle = activityTitleById.get(sid) || "";
        if (isPlaceholderTitle(realTitle)) {
          console.log(`  → FILTERED OUT (placeholder real title "${realTitle}" for ${sid})`);
          return null;
        }

        // TITLE-MUST-MATCH GUARD: catches the case where the model reuses a
        // real ID but writes a fabricated current_item for the user-visible card.
        if (realTitle && s.current_item && !titleMatches(String(s.current_item), realTitle)) {
          console.log(`  → FILTERED OUT (title mismatch: claimed "${s.current_item}" vs real "${realTitle}")`);
          return null;
        }

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
        const knownCostCents = activityCostCentsById.get(sid);
        const currentCostCents = knownCostCents ?? Math.round((typeof s.current_cost === "number" ? s.current_cost : 0) * 100);

        console.log(`Suggestion "${s.suggested_swap}": AI current=${s.current_cost}, AI new=${s.new_cost}, knownCents=${knownCostCents}, newCents=${newCostCents}, currentCents=${currentCostCents}`);

        // STRICT GUARD: new cost must be strictly less than current cost
        if (newCostCents >= currentCostCents) {
          console.log(`  → FILTERED OUT (new ${newCostCents} >= current ${currentCostCents})`);
          return null;
        }

        return {
          ...s,
          // Force the rendered title to the real itinerary item so even
          // a slightly-off AI label can't show a phantom name in the UI.
          current_item: activityTitleById.get(sid) || s.current_item,
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
