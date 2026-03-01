/**
 * backfill-activity-costs
 * 
 * Reads existing trips' itinerary_data JSON and populates the activity_costs table.
 * Validates costs against cost_reference ranges; auto-corrects outliers.
 * 
 * POST /backfill-activity-costs
 * Body: { tripId?: string }   — optional: backfill a single trip. Omit for all trips.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
  cost_low_usd: number;
  cost_mid_usd: number;
  cost_high_usd: number;
}

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

function normalizeCategory(raw?: string): string {
  if (!raw) return "activity";
  const lower = raw.toLowerCase().trim();
  return CATEGORY_MAP[lower] || lower;
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
        const key = `${(r.destination_city || "").toLowerCase()}|${r.category}|${r.subcategory || ""}`;
        refMap.set(key, r as CostRef);
        // Also store city+category only as fallback
        const fallbackKey = `${(r.destination_city || "").toLowerCase()}|${r.category}|`;
        if (!refMap.has(fallbackKey)) {
          refMap.set(fallbackKey, r as CostRef);
        }
      }
    }

    let totalInserted = 0;
    let totalCorrected = 0;
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

            let costPerPerson = extractCost(activity);

            // Look up reference
            const refKey = `${destination}|${category}|`;
            const ref = refMap.get(refKey);

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

            // Apply category caps (mirror the DB trigger)
            const caps: Record<string, number> = { dining: 500, transport: 300, activity: 1000, nightlife: 200 };
            const cap = caps[category] || 2000;
            if (costPerPerson > cap) {
              costPerPerson = ref ? ref.cost_high_usd : cap;
              source = "auto_corrected";
              corrected = true;
            }

            if (corrected) totalCorrected++;

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
              notes: corrected ? "[Backfill auto-corrected]" : null,
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
