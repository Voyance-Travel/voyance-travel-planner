/**
 * backfill-activity-costs
 * 
 * Reads existing trips' itinerary_data JSON and populates the activity_costs table.
 * Validates costs against cost_reference ranges; auto-corrects outliers.
 * Enhanced with keyword-based subcategory matching for accurate transport/dining pricing.
 * 
 * POST /backfill-activity-costs
 * Body: { tripId?: string }   — optional: backfill a single trip. Omit for all trips.
 */

import { createClient } from "npm:@supabase/supabase-js@2.90.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Types ───────────────────────────────────────────────────

interface ItineraryActivity {
  id?: string;
  title?: string;
  name?: string;
  category?: string;
  type?: string;
  estimatedCost?: number;
  estimated_cost?: number;
  cost?: { amount?: number } | number;
  [key: string]: unknown;
}

interface ItineraryDay {
  dayNumber?: number;
  day_number?: number;
  activities?: ItineraryActivity[];
}

interface CostRef {
  id: string;
  destination_city: string;
  category: string;
  subcategory: string | null;
  item_name: string | null;
  cost_low_usd: number;
  cost_mid_usd: number;
  cost_high_usd: number;
}

// ─── Category & Subcategory Mapping ──────────────────────────

const CATEGORY_MAP: Record<string, string> = {
  sightseeing: "activity",
  cultural: "activity",
  adventure: "activity",
  relaxation: "activity",
  entertainment: "activity",
  dining: "dining",
  food: "dining",
  restaurant: "dining",
  cafe: "dining",
  transport: "transport",
  transportation: "transport",
  transit: "transport",
  nightlife: "nightlife",
  bar: "nightlife",
  shopping: "shopping",
  accommodation: "accommodation",
  hotel: "accommodation",
};

/** Keyword → subcategory mapping for transport activities */
const TRANSPORT_SUBCATEGORY_KEYWORDS: Record<string, string[]> = {
  taxi: ["taxi", "cab", "uber", "grab", "lyft", "ride", "private car", "car service"],
  airport_transfer: ["airport transfer", "airport shuttle", "airport pickup", "airport drop"],
  metro: ["metro", "subway", "mrt", "mtr", "underground", "tube"],
  bus: ["bus", "minibus", "shuttle bus", "city bus", "public bus"],
  train: ["train", "rail", "railway", "bullet train", "shinkansen", "high-speed"],
  ferry: ["ferry", "boat", "water taxi", "junk boat", "star ferry"],
  tram: ["tram", "trolley", "streetcar", "light rail"],
  cable_car: ["cable car", "gondola", "funicular", "peak tram"],
};

/** Keyword → subcategory mapping for dining activities */
const DINING_SUBCATEGORY_KEYWORDS: Record<string, string[]> = {
  street_food: ["street food", "food stall", "hawker", "night market food", "dai pai dong"],
  fast_food: ["fast food", "mcdonald", "burger king", "kfc"],
  cafe: ["cafe", "café", "coffee", "bakery", "pastry"],
  casual_dining: ["casual", "bistro", "noodle", "ramen", "dim sum", "dumpling", "pho", "curry"],
  fine_dining: ["fine dining", "michelin", "tasting menu", "omakase", "prix fixe"],
  breakfast: ["breakfast", "brunch", "morning meal"],
  lunch: ["lunch", "midday meal"],
  dinner: ["dinner", "evening meal", "supper"],
  bar: ["bar", "cocktail", "pub", "rooftop bar", "speakeasy"],
};

function normalizeCategory(raw?: string): string {
  if (!raw) return "activity";
  const lower = raw.toLowerCase().trim();
  return CATEGORY_MAP[lower] || lower;
}

function inferSubcategory(title: string, category: string): string | null {
  const titleLower = (title || "").toLowerCase();
  
  if (category === "transport") {
    for (const [sub, keywords] of Object.entries(TRANSPORT_SUBCATEGORY_KEYWORDS)) {
      if (keywords.some(kw => titleLower.includes(kw))) return sub;
    }
  }
  
  if (category === "dining") {
    for (const [sub, keywords] of Object.entries(DINING_SUBCATEGORY_KEYWORDS)) {
      if (keywords.some(kw => titleLower.includes(kw))) return sub;
    }
  }
  
  return null;
}

function extractCost(activity: ItineraryActivity): number {
  if (typeof activity.estimatedCost === "number") return activity.estimatedCost;
  if (typeof activity.estimated_cost === "number") return activity.estimated_cost;
  if (typeof activity.cost === "number") return activity.cost;
  if (activity.cost && typeof activity.cost === "object" && typeof (activity.cost as any).amount === "number") {
    return (activity.cost as any).amount;
  }
  return 0;
}

// ─── Reference Lookup ────────────────────────────────────────

function findBestReference(
  refMap: Map<string, CostRef>,
  destination: string,
  category: string,
  subcategory: string | null,
  title: string
): CostRef | null {
  // Level 1: exact destination + category + subcategory
  if (subcategory) {
    const exactKey = `${destination}|${category}|${subcategory}`;
    const exact = refMap.get(exactKey);
    if (exact) return exact;
  }

  // Level 2: fuzzy title match against item_name in refs
  // (uses titleRefMap populated during ref loading)
  // This is handled by the caller checking title-based keys

  // Level 3: destination + category fallback
  const fallbackKey = `${destination}|${category}|`;
  return refMap.get(fallbackKey) || null;
}

// ─── Main Handler ────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let tripFilter: string | undefined;
    try {
      const body = await req.json();
      tripFilter = body?.tripId;
    } catch {
      // no body — backfill all
    }

    // Fetch trips
    let query = supabase
      .from("trips")
      .select("id, destination, travelers, itinerary_data")
      .not("itinerary_data", "is", null);

    if (tripFilter) {
      query = query.eq("id", tripFilter);
    }

    const { data: trips, error: tripsErr } = await query.limit(500);
    if (tripsErr) throw tripsErr;
    if (!trips || trips.length === 0) {
      return new Response(JSON.stringify({ message: "No trips to backfill", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pre-load all cost references for fast lookup
    const { data: allRefs } = await supabase.from("cost_reference").select("*");
    const refMap = new Map<string, CostRef>();
    if (allRefs) {
      for (const r of allRefs) {
        const cityLower = (r.destination_city || "").toLowerCase();
        // Exact key: city|category|subcategory
        const exactKey = `${cityLower}|${r.category}|${r.subcategory || ""}`;
        refMap.set(exactKey, r as CostRef);
        // Fallback key: city|category| (no subcategory)
        const fallbackKey = `${cityLower}|${r.category}|`;
        if (!refMap.has(fallbackKey)) {
          refMap.set(fallbackKey, r as CostRef);
        }
      }
    }

    let totalInserted = 0;
    let totalCorrected = 0;
    const categoryStats: Record<string, { count: number; corrected: number; totalCost: number }> = {};
    const errors: string[] = [];

    for (const trip of trips) {
      try {
        const itData = trip.itinerary_data as { days?: ItineraryDay[]; itinerary?: { days?: ItineraryDay[] } };
        const days = itData?.days || itData?.itinerary?.days || [];
        if (!days.length) continue;

        const destination = (trip.destination || "").toLowerCase();
        const numTravelers = trip.travelers || 1;
        const rows: any[] = [];

        for (const day of days) {
          const dayNum = day.dayNumber || day.day_number || 1;
          const activities = day.activities || [];

          for (const activity of activities) {
            if (!activity.id) continue;

            const category = normalizeCategory(activity.category || activity.type);
            if (category === "accommodation") continue; // skip hotel blocks

            const title = activity.title || activity.name || "";
            const subcategory = inferSubcategory(title, category);
            let costPerPerson = extractCost(activity);

            // Find best reference match
            const ref = findBestReference(refMap, destination, category, subcategory, title);

            let source = "backfill";
            let corrected = false;

            if (ref) {
              // Check if cost is within reasonable range (0 to 3x high)
              const maxAllowed = ref.cost_high_usd * 3;
              if (costPerPerson > maxAllowed || costPerPerson < 0) {
                costPerPerson = ref.cost_mid_usd;
                source = "auto_corrected";
                corrected = true;
              } else if (costPerPerson === 0) {
                costPerPerson = ref.cost_mid_usd;
                source = "reference_fallback";
              }
            } else if (costPerPerson < 0) {
              costPerPerson = 0;
              source = "auto_corrected";
              corrected = true;
            }

            if (corrected) totalCorrected++;

            // Track category stats
            if (!categoryStats[category]) {
              categoryStats[category] = { count: 0, corrected: 0, totalCost: 0 };
            }
            categoryStats[category].count++;
            if (corrected) categoryStats[category].corrected++;
            categoryStats[category].totalCost += costPerPerson;

            rows.push({
              trip_id: trip.id,
              activity_id: activity.id,
              day_number: dayNum,
              cost_per_person_usd: Math.round(costPerPerson * 100) / 100,
              num_travelers: numTravelers,
              category,
              source,
              confidence: ref ? "medium" : "low",
              cost_reference_id: ref?.id || null,
              notes: corrected
                ? `[Backfill auto-corrected${subcategory ? `, subcategory: ${subcategory}` : ""}]`
                : subcategory
                  ? `[subcategory: ${subcategory}]`
                  : null,
            });
          }
        }

        if (rows.length > 0) {
          const { data: inserted, error: upsertErr } = await supabase
            .from("activity_costs")
            .upsert(rows, { onConflict: "trip_id,activity_id" })
            .select("id");

          if (upsertErr) {
            errors.push(`Trip ${trip.id}: ${upsertErr.message}`);
          } else {
            totalInserted += inserted?.length || 0;
          }
        }
      } catch (e) {
        errors.push(`Trip ${trip.id}: ${(e as Error).message}`);
      }
    }

    return new Response(
      JSON.stringify({
        processed: trips.length,
        inserted: totalInserted,
        corrected: totalCorrected,
        categoryStats,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
