/**
 * ACTION: repair-trip-costs
 * Fix corrupted/missing activity_costs for a trip.
 */

import { type ActionContext, verifyTripAccess, okJson, errorJson } from './action-types.ts';
import { ALWAYS_FREE_VENUE_PATTERNS, KNOWN_FINE_DINING_STARS, FINE_DINING_MIN_PRICE_BY_STARS, FINE_DINING_MIN_PRICE_DEFAULT, KNOWN_MICHELIN_HIGH, KNOWN_MICHELIN_MID, KNOWN_UPSCALE, MICHELIN_FLOOR, KNOWN_TICKETED_ATTRACTIONS } from './sanitization.ts';
import { isPlaceholderWellness } from './fix-placeholders.ts';

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
    .select("id, destination, travelers, itinerary_data, budget_total_cents, budget_allocations, flight_selection, hotel_selection")
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
  const changeLog: Array<{ activity_id: string; activity_title: string | null; previous_cents: number; new_cents: number; reason: string }> = [];
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

      // Placeholder departure transfer (no mode chosen): write $0, do not estimate.
      const _titleForPlaceholder = (activity.title || activity.name || "");
      const _descForPlaceholder = (activity.description || "");
      const PLACEHOLDER_DEPARTURE_RE = /^(?:transfer|travel|head|go|depart|leave)\s+(?:to|for)\s+(?:the\s+)?(?:airport|station|terminal|port|train\s+station|bus\s+station)\b/i;
      const PLACEHOLDER_LUGGAGE_RE = /^collect\s+luggage\s*(?:&|and)\s*transfer\b/i;
      const TRANSPORT_MODE_RE = /\b(?:taxi|cab|uber|lyft|rideshare|private\s+car|car\s+service|metro|subway|train|rer|tgv|shuttle|bus|tram|ferry|boat)\b/i;
      const isPlaceholderDeparture = category === "transport"
        && (PLACEHOLDER_DEPARTURE_RE.test(_titleForPlaceholder) || PLACEHOLDER_LUGGAGE_RE.test(_titleForPlaceholder))
        && !TRANSPORT_MODE_RE.test(_titleForPlaceholder)
        && !TRANSPORT_MODE_RE.test(_descForPlaceholder)
        && activity.booking_required !== true
        && (activity.cost?.basis !== 'user' && activity.cost?.basis !== 'user_override');
      if (isPlaceholderDeparture) {
        rows.push({
          trip_id: tripId,
          activity_id: activity.id,
          day_number: dayNum,
          cost_per_person_usd: 0,
          num_travelers: numTravelers,
          category: 'transport',
          source: 'placeholder_departure',
          confidence: 'low',
          cost_reference_id: null,
          notes: '[Departure transfer — choose a mode]',
        });
        continue;
      }

      // Unconfirmed intra-city taxi/rideshare — AI named the leg "Taxi to X"
      // but the user never picked taxi as their mode. Treat as $0 until they
      // explicitly confirm (cost.basis === 'user' | 'user_override') or it's
      // a booked ride (booking_required === true). The leg still appears on
      // the day card with a "choose a mode" hint; it just doesn't inflate the
      // Payments total. Mirrors the placeholder_departure rule above.
      const UNCONFIRMED_TAXI_RE = /^\s*(?:taxi|cab|uber|lyft|rideshare|private\s+car|car\s+service)\b.*\bto\b/i;
      const isUserConfirmedCost = activity.cost?.basis === 'user' || activity.cost?.basis === 'user_override';
      const isUnconfirmedTaxi = category === 'transport'
        && UNCONFIRMED_TAXI_RE.test(_titleForPlaceholder)
        && !isUserConfirmedCost
        && activity.booking_required !== true;
      if (isUnconfirmedTaxi) {
        rows.push({
          trip_id: tripId,
          activity_id: activity.id,
          day_number: dayNum,
          cost_per_person_usd: 0,
          num_travelers: numTravelers,
          category: 'transport',
          source: 'unconfirmed_transit',
          confidence: 'low',
          cost_reference_id: null,
          notes: '[Choose a mode — taxi/metro/walk]',
        });
        continue;
      }

      // Generic unconfirmed transit — any transport leg whose title/desc has
      // NO mode keyword (e.g. "Travel to Four Seasons", "Transfer to Hotel").
      // Catches the long tail of mode-less hops the prior two rules miss.
      const isGenericUnconfirmedTransit = category === 'transport'
        && !TRANSPORT_MODE_RE.test(_titleForPlaceholder)
        && !TRANSPORT_MODE_RE.test(_descForPlaceholder)
        && !isUserConfirmedCost
        && activity.booking_required !== true;
      if (isGenericUnconfirmedTransit) {
        rows.push({
          trip_id: tripId,
          activity_id: activity.id,
          day_number: dayNum,
          cost_per_person_usd: 0,
          num_travelers: numTravelers,
          category: 'transport',
          source: 'unconfirmed_transit',
          confidence: 'low',
          cost_reference_id: null,
          notes: '[Choose a mode — taxi/metro/walk]',
        });
        continue;
      }


      const title = activity.title || activity.name || "";

      // ── UNVERIFIED WELLNESS GATE ──
      // Spa/wellness items without a real, named venue must never snapshot a
      // non-zero cost — they're not bookable, so charging the budget for them
      // is misleading. Force $0 with an explicit basis so UI can flag them.
      if (category === 'wellness' || category === 'spa') {
        const flaggedByMeta = !!activity?.metadata?.needs_venue_replacement
          || !!activity?.metadata?.unverified_venue;
        const flaggedByDetector = isPlaceholderWellness(activity, destination, undefined);
        if (flaggedByMeta || flaggedByDetector) {
          console.warn(`[repair-trip-costs] UNVERIFIED WELLNESS: "${title}" — forcing $0 (meta=${flaggedByMeta}, detector=${flaggedByDetector})`);
          rows.push({
            trip_id: tripId,
            activity_id: activity.id,
            day_number: dayNum,
            cost_per_person_usd: 0,
            num_travelers: numTravelers,
            category,
            source: 'unverified_venue',
            confidence: 'low',
            cost_reference_id: null,
            notes: '[Unverified wellness venue — name a real spa to enable pricing]',
          });
          continue;
        }
      }

      const subcategory = inferSub(title, category);
      let costPerPerson = typeof activity.estimatedCost === "number" ? activity.estimatedCost
        : typeof activity.estimated_cost === "number" ? activity.estimated_cost
        : typeof activity.cost === "number" ? activity.cost
        : (activity.cost && typeof activity.cost === "object") ? (activity.cost.amount || 0)
        : 0;

      // Snapshot pre-repair price so we can record any uplift to cost_change_log.
      const originalPerPerson = costPerPerson;

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

      // Record any price uplift to cost_change_log so the UI can attribute
      // sudden total jumps. Only log when the new per-person cost is HIGHER
      // than what was on the activity before (raises are what surprise users).
      const prevCents = Math.round(originalPerPerson * numTravelers * 100);
      const newCents = Math.round(finalCost * numTravelers * 100);
      const isFloorReason = finalSource === 'michelin_floor'
        || finalSource === 'ticketed_attraction_floor'
        || finalSource === 'auto_corrected'
        || finalSource === 'reference_fallback';
      if (isFloorReason && newCents > prevCents) {
        changeLog.push({
          activity_id: activity.id,
          activity_title: title || null,
          previous_cents: prevCents,
          new_cents: newCents,
          reason: finalSource,
        });
      }

    }
  }

  // ─── TRANSIT CAP PASS ─────────────────────────────────────────────
  // Demote excess taxi rows to public-transit pricing when the day's
  // transit total exceeds the user's allocated transit budget × 1.25.
  try {
    const totalCents = (tripData as any).budget_total_cents || 0;
    const alloc: any = (tripData as any).budget_allocations || {};
    const transitPct = typeof alloc.transit_percent === 'number' ? alloc.transit_percent : 0;
    const totalDays = days.length || 1;
    if (totalCents > 0 && transitPct > 0) {
      const flightCents = (tripData as any).flight_selection?.legs
        ? ((tripData as any).flight_selection.legs as any[]).reduce((s: number, l: any) => s + (l.price || 0), 0) * 100
        : 0;
      const hotelCents = (tripData as any).hotel_selection?.pricePerNight
        ? Math.round((tripData as any).hotel_selection.pricePerNight * totalDays * 100)
        : 0;
      const discretionary = Math.max(0, totalCents - flightCents - hotelCents);
      // When fixed costs swallow the budget, fall back to the full total ×
      // transit_percent — matches the UI's underwater allocation basis so the
      // cap stays meaningful (and isn't $0/day for luxury hotel trips).
      const allocBase = discretionary > 0 ? discretionary : totalCents;
      const dailyTransitCapPP = (allocBase * (transitPct / 100)) / totalDays / numTravelers / 100;
      // Allow 1.5× headroom so we only demote the genuinely outsized days.
      const cap = dailyTransitCapPP * 1.5;

      const metroRef = refMap.get(`${destination}|transport|metro`)
        || refMap.get(`${destination}|transport|bus`)
        || refMap.get(`${destination}|transport|`);
      const metroFare = metroRef?.cost_low_usd ?? metroRef?.cost_mid_usd ?? 3;

      const actById = new Map<string, any>();
      for (const day of days) for (const a of (day.activities || [])) actById.set(a.id, a);

      const byDay = new Map<number, any[]>();
      for (const r of rows) {
        if (r.category !== 'transport') continue;
        const arr = byDay.get(r.day_number) || [];
        arr.push(r);
        byDay.set(r.day_number, arr);
      }

      const AIRPORT_RE = /\b(airport|terminal|cdg|orly|jfk|lhr|gare|station)\b/i;
      for (const [dayNum, dayRows] of byDay.entries()) {
        let dayTotal = dayRows.reduce((s, r) => s + (r.cost_per_person_usd || 0), 0);
        if (dayTotal <= cap) continue;

        const candidates = dayRows
          .map(r => ({ r, act: actById.get(r.activity_id) }))
          .filter(({ r, act }) => {
            if (!act) return false;
            if (act.isLocked || act.booking_required) return false;
            if (act.cost?.basis === 'user' || act.cost?.basis === 'user_override') return false;
            const text = `${act.title || ''} ${act.description || ''}`;
            if (AIRPORT_RE.test(text)) return false;
            if ((r.cost_per_person_usd || 0) <= metroFare * 1.5) return false;
            return true;
          })
          .sort((a, b) => (b.r.cost_per_person_usd || 0) - (a.r.cost_per_person_usd || 0));

        for (const { r } of candidates) {
          if (dayTotal <= cap) break;
          const prev = r.cost_per_person_usd || 0;
          const prevCents = Math.round(prev * numTravelers * 100);
          const newCost = Math.round(metroFare * 100) / 100;
          dayTotal -= (prev - newCost);
          r.cost_per_person_usd = newCost;
          r.source = 'transit_cap_repair';
          r.confidence = 'medium';
          r.cost_reference_id = metroRef?.id || null;
          r.notes = `[Capped to public transit — was $${prev.toFixed(0)}/pp]`;
          changeLog.push({
            activity_id: r.activity_id,
            activity_title: actById.get(r.activity_id)?.title || null,
            previous_cents: prevCents,
            new_cents: Math.round(newCost * numTravelers * 100),
            reason: 'transit_cap_repair',
          });
          corrected++;
        }
        console.log(`[repair-trip-costs] Transit cap day ${dayNum}: cap=$${cap.toFixed(0)}/pp, final=$${dayTotal.toFixed(0)}/pp`);
      }
    }
  } catch (e) {
    console.warn('[repair-trip-costs] transit cap pass failed:', e);
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
    if (r.source === 'michelin_floor' || r.source === 'ticketed_attraction_floor' || r.source === 'auto_corrected' || r.source === 'transit_cap_repair') {
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
          cost: { amount: fix.totalUsd, currency: 'USD', basis: 'repair_floor', source: fix.reason },
          estimatedCost: { amount: fix.totalUsd, currency: 'USD', basis: 'repair_floor', source: fix.reason },
          costBasis: 'repair_floor',
          costSource: fix.reason,
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

  // Persist change-log so the client can attribute total deltas.
  if (changeLog.length > 0) {
    const { error: logErr } = await supabase
      .from('cost_change_log')
      .insert(changeLog.map(c => ({ ...c, trip_id: tripId })));
    if (logErr) console.warn('[repair-trip-costs] cost_change_log insert failed:', logErr);
  }

  // Stamp the trip so we don't auto-repair again on every page load.
  await supabase
    .from('trips')
    .update({ last_cost_repair_at: new Date().toISOString() })
    .eq('id', tripId);

  console.log(`[repair-trip-costs] Done: ${inserted} rows upserted, ${corrected} corrected, ${jsonbPatched} JSONB-patched, ${changeLog.length} changes logged`);

  return okJson({ success: true, repaired: inserted, corrected, jsonbPatched, totalActivities: rows.length, changes: changeLog.length });
}
