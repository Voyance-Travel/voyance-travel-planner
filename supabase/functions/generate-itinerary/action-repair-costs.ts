/**
 * ACTION: repair-trip-costs
 * Fix corrupted/missing activity_costs for a trip.
 */

import { type ActionContext, verifyTripAccess, okJson, errorJson } from './action-types.ts';
import { ALWAYS_FREE_VENUE_PATTERNS, KNOWN_FINE_DINING_STARS, FINE_DINING_MIN_PRICE_BY_STARS, FINE_DINING_MIN_PRICE_DEFAULT, KNOWN_MICHELIN_HIGH, KNOWN_MICHELIN_MID, KNOWN_UPSCALE, MICHELIN_FLOOR, KNOWN_TICKETED_ATTRACTIONS } from './sanitization.ts';

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

      // Declare source/wasCorrected BEFORE any branch that uses them
      let source = "repair";
      let wasCorrected = false;

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

      // Categories that are NEVER free regardless of name patterns.
      // A restaurant called "La Fontaine de Belleville" must not be tagged a free
      // fountain venue; "Lunch at Chez Janou" must not be tagged free because of
      // "place" wording, etc. Dining is always paid.
      const PAID_CATEGORIES = new Set([
        'dining', 'restaurant', 'breakfast', 'brunch', 'lunch', 'dinner',
        'cafe', 'coffee', 'bar', 'nightlife', 'spa', 'wellness',
      ]);
      const isPaidCategory = PAID_CATEGORIES.has(category);

      if (ALWAYS_FREE_VENUE_PATTERNS.some(p => p.test(allText)) && !isPaidExperience && !isPaidCategory) {
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

      // Tier 1b: Known ticketed attraction override — restore min price if zeroed
      const titleLower = title.toLowerCase();
      const venueNameLower2 = (activity.venue_name || '').toLowerCase();
      const sortedTicketedKeys = Object.keys(KNOWN_TICKETED_ATTRACTIONS).sort((a, b) => b.length - a.length);
      let ticketedMatch: { key: string; minPrice: number } | null = null;
      for (const key of sortedTicketedKeys) {
        if (titleLower.includes(key) || venueNameLower2.includes(key)) {
          ticketedMatch = { key, minPrice: KNOWN_TICKETED_ATTRACTIONS[key] };
          break;
        }
      }
      if (ticketedMatch && costPerPerson < ticketedMatch.minPrice) {
        console.warn(`[repair-trip-costs] TICKETED ATTRACTION FIX: "${title}" at $${costPerPerson} → raised to $${ticketedMatch.minPrice} (${ticketedMatch.key})`);
        costPerPerson = ticketedMatch.minPrice;
        source = 'ticketed_attraction_floor';
        wasCorrected = true;
        corrected++;
      }

      let ref: any = null;
      if (subcategory) {
        ref = refMap.get(`${destination}|${category}|${subcategory}`);
      }
      if (!ref) {
        ref = refMap.get(`${destination}|${category}|`);
      }

      if (ref) {
        const maxAllowed = ref.cost_high_usd * 3;
        if (costPerPerson > maxAllowed || costPerPerson < 0) {
          costPerPerson = ref.cost_mid_usd;
          source = "auto_corrected";
          wasCorrected = true;
        } else if (costPerPerson === 0 && !wasCorrected) {
          costPerPerson = ref.cost_mid_usd;
          source = "reference_fallback";
        }
      } else if (costPerPerson < 0) {
        costPerPerson = 0;
        source = "auto_corrected";
        wasCorrected = true;
      }

      if (wasCorrected && source !== 'ticketed_attraction_floor') corrected++;

      // ── Michelin / fine dining floor enforcement ──
      // Uses the shared KNOWN_FINE_DINING_STARS map for explicit star lookups
      const combinedText = [
        title,
        activity.description || '',
        activity.venue_name || '',
        activity.place_name || '',
        (activity as any).restaurant?.name || '',
        (activity as any).restaurant?.description || '',
      ].join(' ').toLowerCase();

      // Strip meal prefix for matching: "Dinner at Eleven Restaurant" → "eleven restaurant"
      const strippedTitle = title.toLowerCase().replace(/^(breakfast|lunch|dinner|brunch|meal)\s*(at|:|-|–)\s*/i, '').trim();
      const venueNameLower = (activity.venue_name || (activity as any).restaurant?.name || '').toLowerCase();

      let michelinFloor = 0;
      let michelinReason = '';

      // Strategy 1: Explicit star map lookup
      for (const [key, stars] of Object.entries(KNOWN_FINE_DINING_STARS)) {
        if (
          title.toLowerCase().includes(key) ||
          strippedTitle.includes(key) ||
          venueNameLower.includes(key)
        ) {
          const starFloor = FINE_DINING_MIN_PRICE_BY_STARS[stars] || FINE_DINING_MIN_PRICE_DEFAULT;
          if (starFloor > michelinFloor) {
            michelinFloor = starFloor;
            michelinReason = `Known ${stars}-star Michelin restaurant (${key})`;
          }
          break;
        }
      }

      // Strategy 2: Keyword-based star detection
      if (michelinFloor === 0) {
        if (/michelin\s*3|3[\s-]*star/i.test(combinedText)) {
          michelinFloor = 250; michelinReason = 'Michelin 3-star';
        } else if (/michelin\s*2|2[\s-]*star/i.test(combinedText)) {
          michelinFloor = MICHELIN_FLOOR.high; michelinReason = 'Michelin 2-star';
        } else if (/michelin\s*1|1[\s-]*star|michelin[\s-]*starred/i.test(combinedText)) {
          michelinFloor = MICHELIN_FLOOR.mid; michelinReason = 'Michelin 1-star';
        } else if (/tasting menu|fine dining|haute cuisine|degustation|omakase/i.test(combinedText)) {
          michelinFloor = MICHELIN_FLOOR.mid; michelinReason = 'Fine dining / tasting menu';
        }
      }

      // Strategy 3: Regex bucket fallback
      if (michelinFloor < MICHELIN_FLOOR.high && KNOWN_MICHELIN_HIGH.test(combinedText)) {
        michelinFloor = MICHELIN_FLOOR.high; michelinReason = 'Known top-tier Michelin restaurant';
      } else if (michelinFloor < MICHELIN_FLOOR.mid && KNOWN_MICHELIN_MID.test(combinedText)) {
        michelinFloor = MICHELIN_FLOOR.mid; michelinReason = 'Known Michelin-starred restaurant';
      } else if (michelinFloor < MICHELIN_FLOOR.upscale && KNOWN_UPSCALE.test(combinedText)) {
        michelinFloor = MICHELIN_FLOOR.upscale; michelinReason = 'Known upscale restaurant';
      }

      if (michelinFloor > 0 && costPerPerson < michelinFloor) {
        console.warn(`[repair-trip-costs] MICHELIN PRICE FLOOR: "${title}" at €${costPerPerson} → raised to €${michelinFloor} (${michelinReason})`);
        costPerPerson = michelinFloor;
        source = 'michelin_floor';
        wasCorrected = true;
        corrected++;
      }

      // Write-time guard: free venues and walking transport must be $0.
      // The DB trigger enforces this too, but normalizing here keeps the
      // returned payload consistent and avoids a useless DB round-trip.
      const titleLowerForGuard = (title || '').toLowerCase().trim();
      const isWalkingTransport = category === 'transport' && /^walk\b/.test(titleLowerForGuard);
      const notesStr = wasCorrected ? `[Repair auto-corrected${subcategory ? `, ${subcategory}` : ""}]` : null;
      const isFreeVenueNote = (notesStr || '').toLowerCase().includes('free venue');
      let finalCost = Math.round(costPerPerson * 100) / 100;
      let finalSource = source;
      let finalNotes = notesStr;
      if (isWalkingTransport || isFreeVenueNote) {
        if (finalCost !== 0) {
          console.warn(`[repair-trip-costs] FREE-VENUE/WALK GUARD: "${title}" $${finalCost} → $0`);
        }
        finalCost = 0;
        finalSource = 'free_venue';
        finalNotes = isWalkingTransport ? '[Walking - free]' : '[Free venue - Tier 1]';
      }

      rows.push({
        trip_id: tripId,
        activity_id: activity.id,
        day_number: dayNum,
        cost_per_person_usd: finalCost,
        num_travelers: numTravelers,
        category,
        source: finalSource,
        confidence: ref ? "medium" : "low",
        cost_reference_id: ref?.id || null,
        notes: finalNotes,
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

  // ── JSONB WRITEBACK ──────────────────────────────────────────────
  // Per Table-Driven Cost Architecture: activity_costs is the source of truth,
  // but the trips.itinerary_data JSONB is rendered directly by the UI for cost
  // chips on activity cards. If we corrected a Michelin floor in activity_costs
  // without also patching the JSONB, the user sees the wrong (low) price in the
  // itinerary view. Write the corrected per-activity cost (cost_per_person_usd
  // × num_travelers) back into JSONB.cost.amount and JSONB.estimatedCost.amount.
  let jsonbPatched = 0;
  const correctedById = new Map<string, { totalUsd: number; reason: string }>();
  for (const r of rows) {
    if (r.source === 'michelin_floor' || r.source === 'ticketed_attraction_floor' || r.source === 'auto_corrected') {
      correctedById.set(r.activity_id, {
        totalUsd: Math.round((r.cost_per_person_usd || 0) * (r.num_travelers || 1)),
        reason: r.source,
      });
    }
  }
  if (correctedById.size > 0) {
    const patchedDays = days.map((day: any) => ({
      ...day,
      activities: (day.activities || []).map((a: any) => {
        const fix = correctedById.get(a.id);
        if (!fix) return a;
        jsonbPatched++;
        return {
          ...a,
          cost: { amount: fix.totalUsd, currency: 'USD' },
          estimatedCost: { amount: fix.totalUsd, currency: 'USD' },
        };
      }),
    }));
    const { error: writeErr } = await supabase
      .from('trips')
      .update({ itinerary_data: { ...itData, days: patchedDays } })
      .eq('id', tripId);
    if (writeErr) {
      console.error(`[repair-trip-costs] JSONB writeback error:`, writeErr);
      // Non-fatal: activity_costs is still corrected
    } else {
      console.log(`[repair-trip-costs] JSONB writeback: ${jsonbPatched} activities patched in trips.itinerary_data`);
    }
  }

  console.log(`[repair-trip-costs] Done: ${inserted} rows upserted, ${corrected} corrected, ${jsonbPatched} JSONB-patched`);

  return okJson({ success: true, repaired: inserted, corrected, jsonbPatched, totalActivities: rows.length });
}
