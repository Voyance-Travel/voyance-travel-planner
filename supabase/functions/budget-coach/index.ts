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
      anchor_activity_ids = [],
      deep_cuts_requested = false,
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

    // ─── Pre-filter: drop logistics, protected & dismissed activities entirely ───
    const dismissedSet = new Set(dismissed_activity_ids.map(String));
    const protectedActivityIds = new Set<string>();
    const NON_SUGGESTABLE_CATS = [
      "hotel", "accommodation", "lodging", "stay", "flight", "flights",
      "check-in", "check-out", "checkin", "checkout", "bag-drop", "bag drop",
      "departure", "arrival",
    ];
    const NON_SUGGESTABLE_TITLE_RE = /\b(check\s*-?\s*in|check\s*-?\s*out|bag\s*-?\s*drop|return\s+to\s+(?:your\s+)?hotel|back\s+to\s+(?:your\s+)?hotel|freshen\s*up\s+at\s+(?:your\s+)?hotel|hotel\s+checkout|hotel\s+check-?in|airport\s+transfer)\b/i;
    const isLogisticsRow = (a: Activity): boolean => {
      const cat = `${a.category || ""}`.toLowerCase();
      if (NON_SUGGESTABLE_CATS.some((c) => cat.includes(c))) return true;
      if (NON_SUGGESTABLE_TITLE_RE.test(String(a.title || ""))) return true;
      return false;
    };

    let totalIncomingCount = 0;
    let logisticsDropped = 0;
    const filteredDays = itinerary_days.map((day) => ({
      ...day,
      activities: (day.activities ?? []).filter((a) => {
        totalIncomingCount++;
        if (isLogisticsRow(a)) { logisticsDropped++; return false; }
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

    // ZERO-CANDIDATE GUARD: even with activities present, the AI needs at
    // least one positively-priced, non-placeholder item it can swap. Without
    // this the model invents venues to fill the response.
    const PLACEHOLDER_TITLE_RE_PRE = /^(breakfast|lunch|dinner|brunch|meal|activity|activities|transport|transit|hotel|accommodation|untitled)\s*(\(|-|–|—|$)/i;
    const isPlaceholderPre = (t?: string) => {
      const s = (t || "").trim();
      if (!s) return true;
      if (/^(activity|untitled|tbd|n\/a)$/i.test(s)) return true;
      return PLACEHOLDER_TITLE_RE_PRE.test(s);
    };
    const positiveCandidateCount = filteredDays.reduce(
      (n, d) =>
        n +
        (d.activities ?? []).filter(
          (a) => typeof a.cost === "number" && a.cost > 0 && !isPlaceholderPre(a.title)
        ).length,
      0
    );

    if (remainingActivityCount === 0 || positiveCandidateCount === 0) {
      // Only flag all_protected when protections actually removed every
      // would-be candidate — not when the itinerary is empty/logistics-only.
      const onlyProtectionsCausedEmpty =
        protectedActivityIds.size > 0 &&
        (totalIncomingCount - logisticsDropped) > 0 &&
        protectedActivityIds.size >= (totalIncomingCount - logisticsDropped - dismissedSet.size);
      console.log(`[budget-coach] No candidates (incoming=${totalIncomingCount} logistics=${logisticsDropped} protected=${protectedActivityIds.size} positive=${positiveCandidateCount}) — skipping AI call`);
      return new Response(
        JSON.stringify({
          suggestions: [],
          on_target: false,
          no_candidates: true,
          all_protected: onlyProtectionsCausedEmpty,
          reason: onlyProtectionsCausedEmpty
            ? "All candidate activities are in protected categories"
            : "No paid itinerary activities available to optimize",
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

    // ─── Deep-cuts mode ────────────────────────────────────────────
    // When the gap is too large to bridge by swapping alone, allow the model
    // to recommend dropping non-anchor discretionary activities outright.
    const gapPctOfTotal = current_total_cents > 0 ? gap_cents / current_total_cents : 0;
    const deepCutsMode = deep_cuts_requested || gapPctOfTotal > 0.25 || gap_cents > 150000; // > $1500
    const anchorIdSet = new Set(anchor_activity_ids.map(String));
    const anchorIdList = anchor_activity_ids.length > 0
      ? `\nANCHOR ACTIVITY IDS — never drop these (signature experiences):\n${anchor_activity_ids.map((id) => `  • ${id}`).join("\n")}`
      : "";

    // ─── COVERAGE CONTRACT ─────────────────────────────────────────
    // Sum of positive-cost, non-anchor, non-protected, non-logistics
    // candidates. The model is asked to deliver savings ≥ min(gap, 70%
    // of discretionary). Without this the model returns 5–8 small swaps
    // that never close a $2k+ overrun.
    let discretionaryCents = 0;
    for (const day of filteredDays) {
      for (const a of day.activities) {
        if (typeof a.cost !== "number" || !(a.cost > 0)) continue;
        if (anchorIdSet.has(String(a.id))) continue;
        if (isPlaceholderPre(a.title)) continue;
        discretionaryCents += a.cost;
      }
    }
    const targetSavingsCents = Math.min(
      gap_cents,
      Math.round(discretionaryCents * 0.7),
    );
    const targetSavingsUnits = Math.round(targetSavingsCents / 100);

    // Adaptive suggestion count: bigger gaps need more suggestions to be
    // capable of summing to the target.
    let countLow = 5, countHigh = 8;
    if (deepCutsMode) {
      if (gap_cents >= 250000) { countLow = 16; countHigh = 24; }
      else if (gap_cents >= 100000) { countLow = 12; countHigh = 18; }
      else { countLow = 8; countHigh = 12; }
    }
    const countRange = `${countLow}-${countHigh}`;

    const deepCutsClause = deepCutsMode
      ? `\n\nDEEP-CUTS MODE (gap is too large for swap-only):
The user is ${currency} ${(gap_cents / 100).toFixed(0)} over a ${currency} ${(current_total_cents / 100).toFixed(0)} total. Swap-only suggestions cannot realistically close this gap.
You may now use TWO additional swap_type values:
  • "drop" — recommend removing a single non-anchor, non-protected, paid discretionary activity entirely. Set new_cost = 0, suggested_swap = "Drop — free time / use saved budget elsewhere", and put a one-line trade-off explanation in "reason" (e.g. "Frees the afternoon and saves $${"{X}"}; the morning museum still anchors the day").
  • "consolidate" — replace one activity with a cheaper combo or merged version that subsumes another same-day item. Use "swap" semantics on the kept item; mention the consolidated item in "reason".
Drop rules:
  • NEVER drop hotel/accommodation, flights, check-in/out, bag-drop, transfers, anchor IDs (above), or items in protected categories.
  • NEVER drop the only meal of a meal-slot (the only breakfast on a day, the only dinner, etc.). Dropping a second optional meal/drink stop is fine.
  • Prefer dropping: nightcaps, optional museums beyond the daily anchor, paid sightseeing duplicates, secondary tours, premium add-ons.
  • Up to 2 drops per day are acceptable when needed to hit the coverage target.
Return ${countRange} suggestions in this mode, mixing drops and swaps. Rank by absolute savings.${anchorIdList}`
      : "";

    const coverageClause = `\n\nCOVERAGE CONTRACT (HARD REQUIREMENT):
The sum of \`savings\` across your returned suggestions MUST be >= ${currency} ${targetSavingsUnits}.
That is the user's gap (${currency} ${(gap_cents / 100).toFixed(0)}) capped at 70% of their discretionary spend (${currency} ${Math.round(discretionaryCents / 100)}).
If swaps alone can't reach this number, ${deepCutsMode ? "use `drop` suggestions on optional discretionary items (nightcaps, secondary museums, duplicate sightseeing, premium add-ons) to make up the difference" : "you should still return cheaper swaps for every paid discretionary item you can"}. Returning fewer suggestions to "stay safe" is the worst possible outcome — under-coverage leaves the user with no actionable path.`;

    const systemPrompt = `You are a travel budget coach. You analyze itineraries and suggest specific cost-cutting swaps. ${deepCutsMode ? "When the gap is large you may also suggest dropping non-anchor optional activities." : "You NEVER suggest removing an activity entirely — always suggest a cheaper replacement that gives a similar experience."}

CRITICAL NAMING RULE:
- Every "suggested_swap" MUST be a specific, real venue or experience name (e.g., "Joe's Pizza on Carmine St", "Self-guided walk through Montmartre", "Trattoria da Mario").
- For swap_type="drop", suggested_swap is the literal string "Drop — free time / use saved budget elsewhere".
- NEVER use generic descriptions like "Lower cost restaurant", "Cheaper option", "Budget alternative", "Similar restaurant", "Local eatery", or "Affordable café".
- If you cannot name a specific real venue, describe a specific experience (e.g., "Street food at Jemaa el-Fnaa night market" or "Picnic with provisions from Marché d'Aligre").

CRITICAL COST RULES:
- You must NEVER invent, guess, or calculate prices yourself. Use ONLY the reference pricing data provided below.
- You must NEVER directly modify or set an activity's cost value. You can only SUGGEST SWAPS to cheaper alternatives or DROPS (in deep-cuts mode).
- When suggesting a swap, the new_cost MUST come from the reference pricing table, not from your own estimation.
- If no reference pricing is available for a swap, use the lowest reasonable amount from the reference data for that category.
- For swap_type="swap" the new_cost MUST be strictly LESS than current_cost. For swap_type="drop" new_cost MUST be 0.
- All costs are in whole currency units (e.g., 50 for $50), NOT cents.
- NEVER output a cost number without it being sourced from the reference pricing data.${protectedClause}${priorityOverrunsClause}${deepCutsClause}${coverageClause}`;

    const userPrompt = `The user's travel itinerary to ${destination || "their destination"} costs ${currency} ${currentTotal} but their budget is ${currency} ${budgetTarget}. They need to cut ${currency} ${gap}.

Here is the full itinerary (items in protected categories have been removed):

${itinerarySummary}
${costRefLookup}

Suggest ${countRange} specific cost-cutting changes whose combined savings reach AT LEAST ${currency} ${targetSavingsUnits}. For each:
1. Identify the expensive item (name + current cost)
2. Choose swap_type: "swap" (default), ${deepCutsMode ? '"drop" (deep-cuts mode), or "consolidate"' : 'only "swap" is allowed'}.
3. For swaps: suggest a cheaper alternative that gives a similar experience; new_cost MUST come from reference pricing.
4. For drops: new_cost = 0; only target non-anchor, non-protected, optional discretionary items.
5. Calculate the exact savings (current_cost - new_cost).
6. Write a suggested_description that reads like an itinerary activity description — focus on the experience, not the budget reasoning.

Types of swaps to consider:
- Private/guided tours → general admission or self-guided
- Expensive dinner restaurants → the same restaurant for lunch (keep the original venue name — do NOT prefix with "Lunch at"; explain the lunch-price saving in the "reason" field)
- Fine dining → great local spots or street food
- Taxi rides → metro/walking if distance is reasonable
- Paid activities → free alternatives in the same area
- Premium experiences → mid-range alternatives

Rules:
- Suggestions must be specific to THIS itinerary and destination
- Include real venue/restaurant names when possible
- Rank by savings amount (biggest first)
- All costs in ${currency} as integers (no decimals)
- NEVER suggest the same replacement venue/restaurant in more than one suggestion. Each swap must recommend a DIFFERENT specific place, even if multiple items are in the same category (e.g., if two breakfasts need swaps, suggest two different affordable cafés).`;

    // ── AI call (factored so we can re-prompt for coverage) ───────
    const TOOL_SCHEMA = {
      type: "function" as const,
      function: {
        name: "return_budget_suggestions",
        description: "Return an array of budget-cutting swap suggestions for the itinerary.",
        parameters: {
          type: "object",
          properties: {
            suggestions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  current_item: { type: "string", description: "Name of the expensive item" },
                  current_cost: { type: "number", description: "Current cost in whole currency units (e.g. 50 for $50)" },
                  suggested_swap: { type: "string", description: "The specific name of a real venue, restaurant, or experience to replace the current one. Must be a concrete, real place name (e.g. 'Trattoria da Mario', 'Self-guided walk through Montmartre') — NOT a generic description like 'lower cost restaurant' or 'cheaper option'." },
                  new_cost: { type: "number", description: "New cost in whole currency units (e.g. 30 for $30)" },
                  savings: { type: "number", description: "Savings in whole currency units" },
                  reason: { type: "string", description: "Brief explanation of why this swap saves money (shown in coach panel only)" },
                  suggested_description: { type: "string", description: "A short, experience-focused description of the replacement activity as it should appear on the itinerary card (e.g. 'Grab gourmet sandwiches from Lenwich and enjoy a picnic in Central Park'). Do NOT include budget reasoning here." },
                  day_number: { type: "number", description: "Which day this activity is on" },
                  activity_id: { type: "string", description: "The ID of the activity to swap or drop" },
                  swap_type: { type: "string", enum: ["swap", "drop", "consolidate"], description: "swap = replace with cheaper alternative (default). drop = remove the activity entirely (deep-cuts mode only). consolidate = swap-merge with another same-day item." },
                },
                required: ["current_item", "current_cost", "suggested_swap", "new_cost", "savings", "reason", "suggested_description", "day_number", "activity_id", "swap_type"],
                additionalProperties: false,
              },
            },
          },
          required: ["suggestions"],
          additionalProperties: false,
        },
      },
    };

    const callAI = async (sysPrompt: string, usrPrompt: string): Promise<any[]> => {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: usrPrompt },
          ],
          tools: [TOOL_SCHEMA],
          tool_choice: { type: "function", function: { name: "return_budget_suggestions" } },
        }),
      });
      if (!r.ok) {
        if (r.status === 429) throw new Error("__RATE_LIMITED__");
        if (r.status === 402) throw new Error("__CREDITS_EXHAUSTED__");
        const text = await r.text();
        console.error("AI gateway error:", r.status, text);
        throw new Error(`AI gateway error: ${r.status}`);
      }
      const j = await r.json();
      const tc = j.choices?.[0]?.message?.tool_calls?.[0];
      if (!tc?.function?.arguments) return [];
      try { return JSON.parse(tc.function.arguments).suggestions || []; }
      catch { console.error("Failed to parse tool call arguments"); return []; }
    };

    let suggestions: any[];
    try {
      suggestions = await callAI(systemPrompt, userPrompt);
    } catch (callErr: any) {
      if (callErr?.message === "__RATE_LIMITED__") {
        return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (callErr?.message === "__CREDITS_EXHAUSTED__") {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw callErr;
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
    const filterSuggestions = (raw: any[]): any[] =>
      raw
        .map((s: any) => {
          const rawNew = typeof s.new_cost === "number" ? s.new_cost : null;
          if (rawNew === null || rawNew < 0) return null;

          const swapType: "swap" | "drop" | "consolidate" =
            s.swap_type === "drop" || s.swap_type === "consolidate" ? s.swap_type : "swap";

          const sid = String(s.activity_id);

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
          if (swapType === "drop" && anchorIdSet.has(sid)) {
            console.log(`  → FILTERED OUT (drop on anchor activity ${sid})`);
            return null;
          }
          if ((swapType === "drop" || swapType === "consolidate") && !deepCutsMode) {
            console.log(`  → FILTERED OUT (${swapType} not allowed outside deep-cuts mode for ${sid})`);
            return null;
          }

          const realTitle = activityTitleById.get(sid) || "";
          if (isPlaceholderTitle(realTitle)) {
            console.log(`  → FILTERED OUT (placeholder real title "${realTitle}" for ${sid})`);
            return null;
          }
          if (realTitle && s.current_item && !titleMatches(String(s.current_item), realTitle)) {
            console.log(`  → FILTERED OUT (title mismatch: claimed "${s.current_item}" vs real "${realTitle}")`);
            return null;
          }

          if (swapType !== "drop") {
            const swapName = (s.suggested_swap || "").toLowerCase();
            const GENERIC_PATTERNS = [
              "lower cost", "cheaper", "budget", "affordable", "inexpensive",
              "alternative option", "similar restaurant", "similar cafe", "similar café",
              "local eatery", "local restaurant", "local cafe", "local café",
              "generic", "another option", "different restaurant", "different cafe",
              "mid-range", "moderately priced", "less expensive", "cost-effective",
              "economy", "no-frills",
            ];
            if (GENERIC_PATTERNS.some((p) => swapName.includes(p))) {
              console.log(`  → FILTERED OUT generic swap name: "${s.suggested_swap}"`);
              return null;
            }
          }

          const newCostCents = swapType === "drop" ? 0 : Math.round(rawNew * 100);
          const knownCostCents = activityCostCentsById.get(sid);
          const currentCostCents = knownCostCents ?? Math.round((typeof s.current_cost === "number" ? s.current_cost : 0) * 100);

          if (swapType === "drop") {
            if (currentCostCents <= 0) {
              console.log(`  → FILTERED OUT (drop on $0 item ${sid})`);
              return null;
            }
          } else if (newCostCents >= currentCostCents) {
            console.log(`  → FILTERED OUT (new ${newCostCents} >= current ${currentCostCents})`);
            return null;
          }

          return {
            ...s,
            swap_type: swapType,
            current_item: activityTitleById.get(sid) || s.current_item,
            suggested_swap: swapType === "drop"
              ? "Drop — free time / use saved budget elsewhere"
              : s.suggested_swap,
            current_cost: currentCostCents,
            new_cost: newCostCents,
            savings: currentCostCents - newCostCents,
          };
        })
        .filter(Boolean) as any[];

    let filtered = filterSuggestions(suggestions);

    const sumSavings = (arr: any[]) => arr.reduce((s, x) => s + (x?.savings || 0), 0);
    let totalSavingsCents = sumSavings(filtered);
    let coverageRatio = targetSavingsCents > 0 ? totalSavingsCents / targetSavingsCents : 1;
    let retryAttempted = false;

    // ── Retry once if coverage < 50% in deep-cuts mode ───────────
    if (deepCutsMode && coverageRatio < 0.5 && filtered.length > 0) {
      retryAttempted = true;
      const usedIds = new Set(filtered.map((s: any) => String(s.activity_id)));
      const usedIdList = [...usedIds].join(", ") || "(none)";
      const retryUserPrompt = `Your previous suggestions only covered ${Math.round(coverageRatio * 100)}% of the user's gap (${currency} ${(totalSavingsCents / 100).toFixed(0)} of the required ${currency} ${targetSavingsUnits}).

Return a NEW list (do NOT repeat any of these activity_ids: ${usedIdList}) of ${countLow}-${countHigh} additional swaps and drops that, combined with the previous list, reach the coverage target. Drops are STRONGLY preferred for high-cost discretionary items (nightcaps, secondary museums, duplicate sightseeing, premium add-ons). Same itinerary as before:

${itinerarySummary}
${costRefLookup}`;
      try {
        const retryRaw = await callAI(systemPrompt, retryUserPrompt);
        const retryFiltered = filterSuggestions(retryRaw)
          .filter((s: any) => !usedIds.has(String(s.activity_id)));
        filtered = [...filtered, ...retryFiltered];
        totalSavingsCents = sumSavings(filtered);
        coverageRatio = targetSavingsCents > 0 ? totalSavingsCents / targetSavingsCents : 1;
        console.log(`[budget-coach] Retry added ${retryFiltered.length} suggestions; coverage now ${Math.round(coverageRatio * 100)}%`);
      } catch (retryErr) {
        console.warn("[budget-coach] Retry failed, returning first-pass suggestions:", retryErr);
      }
    }

    // Sort by savings desc
    filtered.sort((a: any, b: any) => b.savings - a.savings);

    console.log(`[budget-coach] final_count=${filtered.length} total_savings_cents=${totalSavingsCents} target_savings_cents=${targetSavingsCents} coverage_ratio=${coverageRatio.toFixed(2)} discretionary_cents=${discretionaryCents} retry_attempted=${retryAttempted} deepCutsMode=${deepCutsMode}`);

    return new Response(
      JSON.stringify({
        suggestions: filtered,
        on_target: false,
        deep_cuts_mode: deepCutsMode,
        filtered_empty: filtered.length === 0,
        no_candidates: filtered.length === 0,
        coverage_ratio: coverageRatio,
        target_savings_cents: targetSavingsCents,
        discretionary_cents: discretionaryCents,
        retry_attempted: retryAttempted,
        total_savings_cents: totalSavingsCents,
      }),
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
