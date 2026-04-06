/**
 * ACTION: repair-trip-costs
 * Fix corrupted/missing activity_costs for a trip.
 */

import { type ActionContext, verifyTripAccess, okJson, errorJson } from './action-types.ts';
import { ALWAYS_FREE_VENUE_PATTERNS } from './sanitization.ts';

export async function handleRepairTripCosts(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId } = params;

  if (!tripId) {
    return errorJson("tripId is required", 400);
  }

  const tripAccessResult = await verifyTripAccess(supabase, tripId, userId, false);
  if (!tripAccessResult.allowed) {
    return errorJson(tripAccessResult.reason || "Trip not found or access denied", 403);
  }

  console.log(`[repair-trip-costs] Starting repair for trip ${tripId}, user ${userId}`);

  const { data: tripData, error: tripErr } = await supabase
    .from("trips")
    .select("id, destination, travelers, itinerary_data")
    .eq("id", tripId)
    .single();

  if (tripErr || !tripData) {
    return errorJson("Trip not found", 404);
  }

  const itData = tripData.itinerary_data as any;
  const days = itData?.days || itData?.itinerary?.days || [];
  if (!days.length) {
    return okJson({ message: "No itinerary data to repair", repaired: 0 });
  }

  // Load cost references
  const { data: allRefs } = await supabase.from("cost_reference").select("*");
  const refMap = new Map<string, any>();
  if (allRefs) {
    for (const r of allRefs) {
      const cityLower = (r.destination_city || "").toLowerCase();
      const exactKey = `${cityLower}|${r.category}|${r.subcategory || ""}`;
      refMap.set(exactKey, r);
      const fallbackKey = `${cityLower}|${r.category}|`;
      if (!refMap.has(fallbackKey)) refMap.set(fallbackKey, r);
    }
  }

  const catMap: Record<string, string> = {
    sightseeing: "activity", cultural: "activity", adventure: "activity",
    relaxation: "activity", entertainment: "activity", dining: "dining",
    food: "dining", restaurant: "dining", cafe: "dining", transport: "transport",
    transportation: "transport", transit: "transport", nightlife: "nightlife",
    bar: "nightlife", shopping: "shopping",
  };
  const transportKw: Record<string, string[]> = {
    taxi: ["taxi", "cab", "uber", "grab", "lyft", "ride", "private car"],
    airport_transfer: ["airport transfer", "airport shuttle"],
    metro: ["metro", "subway", "mrt", "mtr", "underground"],
    bus: ["bus", "shuttle bus", "city bus"],
    train: ["train", "rail", "shinkansen"],
    ferry: ["ferry", "boat", "water taxi", "star ferry", "junk boat"],
  };
  const diningKw: Record<string, string[]> = {
    street_food: ["street food", "hawker", "night market food", "dai pai dong"],
    cafe: ["cafe", "café", "coffee", "bakery"],
    casual_dining: ["noodle", "ramen", "dim sum", "dumpling", "pho"],
    fine_dining: ["fine dining", "michelin", "omakase", "tasting menu"],
  };

  function normCat(raw?: string): string {
    if (!raw) return "activity";
    return catMap[raw.toLowerCase().trim()] || raw.toLowerCase().trim();
  }

  function inferSub(title: string, cat: string): string | null {
    const t = (title || "").toLowerCase();
    if (cat === "transport") {
      for (const [sub, kws] of Object.entries(transportKw)) {
        if (kws.some(kw => t.includes(kw))) return sub;
      }
    }
    if (cat === "dining") {
      for (const [sub, kws] of Object.entries(diningKw)) {
        if (kws.some(kw => t.includes(kw))) return sub;
      }
    }
    return null;
  }

  const destination = (tripData.destination || "").toLowerCase();
  const numTravelers = tripData.travelers || 1;
  const rows: any[] = [];
  let corrected = 0;

  for (const day of days) {
    const dayNum = day.dayNumber || day.day_number || 1;
    for (const activity of (day.activities || [])) {
      if (!activity.id) continue;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(activity.id)) {
        console.warn(`[repair-trip-costs] Skipping non-UUID activity_id: "${activity.id}"`);
        continue;
      }
      const category = normCat(activity.category || activity.type);
      if (category === "accommodation") continue;

      const title = activity.title || activity.name || "";
      const subcategory = inferSub(title, category);
      let costPerPerson = typeof activity.estimatedCost === "number" ? activity.estimatedCost
        : typeof activity.estimated_cost === "number" ? activity.estimated_cost
        : typeof activity.cost === "number" ? activity.cost
        : (activity.cost && typeof activity.cost === "object") ? (activity.cost.amount || 0)
        : 0;

      // Tier 1 free venue check — uses shared ALWAYS_FREE_VENUE_PATTERNS
      const allText = [
        title,
        activity.description || '',
        activity.venue_name || '',
        activity.place_name || '',
        activity.location || '',
        activity.address || '',
        activity.restaurant?.name || '',
      ].join(' ');

      const isPaidExperience = activity.booking_required ||
        /\b(tour|guided|ticket|admission|entry|botanical|bot[âa]nico)\b/i.test(allText);

      if (ALWAYS_FREE_VENUE_PATTERNS.test(allText) && !isPaidExperience) {
        console.log(`[repair-trip-costs] FREE VENUE CHECK: "${title}" — forcing $0`);
        rows.push({
          trip_id: tripId,
          activity_id: activity.id,
          day_number: dayNum,
          cost_per_person_usd: 0,
          num_travelers: numTravelers,
          category,
          source: 'free_venue',
          confidence: 'high',
          cost_reference_id: null,
          notes: '[Free venue - Tier 1]',
        });
        continue;
      }

      let ref: any = null;
      if (subcategory) {
        ref = refMap.get(`${destination}|${category}|${subcategory}`);
      }
      if (!ref) {
        ref = refMap.get(`${destination}|${category}|`);
      }

      let source = "repair";
      let wasCorrected = false;

      if (ref) {
        const maxAllowed = ref.cost_high_usd * 3;
        if (costPerPerson > maxAllowed || costPerPerson < 0) {
          costPerPerson = ref.cost_mid_usd;
          source = "auto_corrected";
          wasCorrected = true;
        } else if (costPerPerson === 0) {
          costPerPerson = ref.cost_mid_usd;
          source = "reference_fallback";
        }
      } else if (costPerPerson < 0) {
        costPerPerson = 0;
        source = "auto_corrected";
        wasCorrected = true;
      }

      if (wasCorrected) corrected++;

      rows.push({
        trip_id: tripId,
        activity_id: activity.id,
        day_number: dayNum,
        cost_per_person_usd: Math.round(costPerPerson * 100) / 100,
        num_travelers: numTravelers,
        category,
        source,
        confidence: ref ? "medium" : "low",
        cost_reference_id: ref?.id || null,
        notes: wasCorrected ? `[Repair auto-corrected${subcategory ? `, ${subcategory}` : ""}]` : null,
      });
    }
  }

  let inserted = 0;
  if (rows.length > 0) {
    const { data: upserted, error: upsertErr } = await supabase
      .from("activity_costs")
      .upsert(rows, { onConflict: "trip_id,activity_id" })
      .select("id");

    if (upsertErr) {
      console.error(`[repair-trip-costs] Upsert error:`, upsertErr);
      return errorJson(upsertErr.message, 500);
    }
    inserted = upserted?.length || 0;
  }

  console.log(`[repair-trip-costs] Done: ${inserted} rows upserted, ${corrected} corrected`);

  return okJson({ success: true, repaired: inserted, corrected, totalActivities: rows.length });
}
