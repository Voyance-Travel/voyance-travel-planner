/**
 * Pipeline Repair — Deterministic repairs keyed to failure codes.
 *
 * Phase 3: Takes a generated day + ValidationResult[], applies repairs in order.
 * Returns mutated day + list of RepairAction records for logging.
 *
 * EXECUTION ORDER MATTERS:
 * 1. PHANTOM_HOTEL (strip fake hotels)
 * 2. CHAIN_RESTAURANT (strip chains)
 * 3. CHRONOLOGY (filter pre-arrival, sort)
 * 4. DUPLICATE_CONCEPT (strip trip-wide dupes, swap meals from pool)
 * 5. WEAK_PERSONALIZATION (strip avoid-list violations)
 * 5a. MEAL_ORDER (relabel or swap meals whose title/venue contradicts their time slot)
 * 5b. MEAL_DUPLICATE (relabel/swap/remove duplicate meals)
 * 6. LOGISTICS_SEQUENCE (departure day reorder — fires for isLastDay OR isLastDayInCity)
 * 7. CHECK-IN GUARANTEE (day 1 / transition day)
 * 8. CHECKOUT GUARANTEE (last day / last day in city)
 * 8b. DEPARTURE TRANSPORT GUARANTEE (inject airport/station transfer if missing)
 * 9. MISSING_SLOT (bookend: inject transits + hotel returns, with departure-day guards)
 * 10. TITLE_LABEL_LEAK (strip label leaks)
 * 11. DEPARTURE SEQUENCE FIX (swap checkout before transport — fires for all departure days)
 * 12. NON-FLIGHT DEPARTURE (strip airport refs)
 */

import { FAILURE_CODES, type ValidationResult, type RepairAction, type FailureCode } from './types.ts';
import type { StrictActivityMinimal, StrictDayMinimal } from '../day-validation.ts';
import {
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
} from '../flight-hotel-context.ts';
import { extractRestaurantVenueName } from '../generation-utils.ts';

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface RepairDayInput {
  day: StrictDayMinimal;
  validationResults: ValidationResult[];
  dayNumber: number;
  isFirstDay: boolean;
  isLastDay: boolean;

  // Flight context for pre-arrival filter and departure sequence
  arrivalTime24?: string;
  returnDepartureTime24?: string;
  departureAirport?: string;

  // Hotel context for bookend validator
  hotelName?: string;
  hotelAddress?: string;
  hasHotel: boolean;

  // Multi-city / transition context (pre-resolved by orchestrator)
  isTransitionDay?: boolean;
  isMultiCity?: boolean;
  isLastDayInCity?: boolean;
  resolvedDestination?: string;
  nextLegTransport?: string;
  nextLegTransportDetails?: { stationName?: string; departureTime?: string; [key: string]: any };
  hotelOverride?: { name?: string; address?: string };

  // Locked activities (never remove)
  lockedActivities: StrictActivityMinimal[];

  // Restaurant pool for meal-swap dedup
  restaurantPool?: Array<{ name: string; address?: string; neighborhood?: string; cuisine?: string; priceRange?: string; mealType: string }>;
  usedRestaurants?: string[];
}

export interface RepairDayResult {
  day: StrictDayMinimal;
  repairs: RepairAction[];
}

// =============================================================================
// MAIN REPAIR FUNCTION
// =============================================================================

export function repairDay(input: RepairDayInput): RepairDayResult {
  const repairs: RepairAction[] = [];
  const { validationResults, dayNumber, isFirstDay, isLastDay,
    arrivalTime24, returnDepartureTime24, departureAirport,
    hotelName, hotelAddress, hasHotel,
    lockedActivities, restaurantPool, usedRestaurants,
    isTransitionDay, isMultiCity, isLastDayInCity,
    resolvedDestination, nextLegTransport, nextLegTransportDetails, hotelOverride } = input;

  // Clone activities array to mutate
  let activities: any[] = [...(input.day.activities || [])];
  const lockedIds = new Set(lockedActivities.map(l => l.id));

  // Group validations by code for efficient dispatch
  const byCode = new Map<FailureCode, ValidationResult[]>();
  for (const vr of validationResults) {
    const list = byCode.get(vr.code) || [];
    list.push(vr);
    byCode.set(vr.code, list);
  }

  // --- 1. PHANTOM_HOTEL ---
  if (byCode.has(FAILURE_CODES.PHANTOM_HOTEL)) {
    const indices = (byCode.get(FAILURE_CODES.PHANTOM_HOTEL) || [])
      .map(vr => vr.activityIndex)
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => b - a); // reverse so splicing doesn't shift indices
    for (const idx of indices) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.PHANTOM_HOTEL,
          activityIndex: idx,
          action: 'stripped_phantom_hotel',
          before: removed?.title,
        });
      }
    }
  }

  // --- 2. CHAIN_RESTAURANT ---
  if (byCode.has(FAILURE_CODES.CHAIN_RESTAURANT)) {
    const indices = (byCode.get(FAILURE_CODES.CHAIN_RESTAURANT) || [])
      .map(vr => vr.activityIndex)
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => b - a);
    for (const idx of indices) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.CHAIN_RESTAURANT,
          activityIndex: idx,
          action: 'removed_chain_restaurant',
          before: removed?.title,
        });
      }
    }
  }

  // --- 3. CHRONOLOGY: filter pre-arrival activities on first day ---
  if (isFirstDay && arrivalTime24) {
    const arrivalMins = parseTimeToMinutes(arrivalTime24);
    if (arrivalMins !== null) {
      const before = activities.length;
      activities = activities.filter((act: any) => {
        const actStart = parseTimeToMinutes(act.startTime || '00:00');
        if (actStart === null) return true;
        const isArrivalActivity = (act.category === 'transport' || act.category === 'logistics') &&
          ((act.title || '').toLowerCase().includes('arrival') || (act.title || '').toLowerCase().includes('airport'));
        if (actStart < arrivalMins && !isArrivalActivity && !lockedIds.has(act.id)) {
          repairs.push({
            code: FAILURE_CODES.CHRONOLOGY,
            action: 'filtered_pre_arrival',
            before: act.title,
          });
          return false;
        }
        return true;
      });
    }
  }

  // Sort by startTime to fix chronology issues
  if (byCode.has(FAILURE_CODES.CHRONOLOGY)) {
    activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
      const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
      return ta - tb;
    });
    repairs.push({ code: FAILURE_CODES.CHRONOLOGY, action: 'sorted_by_time' });
  }

  // --- 4. DUPLICATE_CONCEPT: strip trip-wide duplicates ---
  if (byCode.has(FAILURE_CODES.DUPLICATE_CONCEPT)) {
    const dupeResults = byCode.get(FAILURE_CODES.DUPLICATE_CONCEPT) || [];
    // Normalize used restaurant names for reliable matching
    const normalizeForDedup = extractRestaurantVenueName;
    const usedSet = new Set((usedRestaurants || []).map(n => normalizeForDedup(n)));
    // Track current day dining by location.name (canonical venue identity)
    for (const act of activities) {
      if ((act.category || '').toLowerCase() === 'dining') {
        const locationName = act.location?.name || '';
        if (locationName) usedSet.add(normalizeForDedup(locationName));
        usedSet.add(normalizeForDedup(act.title || ''));
      }
    }

    const indicesToRemove: number[] = [];
    for (const vr of dupeResults) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act || lockedIds.has(act.id)) continue;

      const isDining = (act.category || '').toLowerCase() === 'dining';

      // For dining dupes: try pool swap first
      if (isDining && restaurantPool && restaurantPool.length > 0) {
        const startHour = parseInt((act.startTime || '12:00').split(':')[0], 10);
        const mealType = startHour < 11 ? 'breakfast' : startHour < 15 ? 'lunch' : 'dinner';

        const replacement = restaurantPool.find(r => {
          const rNameNorm = normalizeForDedup(r.name || '');
          if (usedSet.has(rNameNorm)) return false;
          return r.mealType === mealType || r.mealType === 'any';
        });

        if (replacement) {
          const before = act.title;
          act.title = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} at ${replacement.name}`;
          act.description = `${replacement.cuisine || 'Local cuisine'} in ${replacement.neighborhood || 'the city'}. ${replacement.priceRange || '$$'}.`;
          act.location = { name: replacement.name, address: replacement.address || '' };
          act.source = 'pool-dedup-swap';
          usedSet.add(normalizeForDedup(replacement.name));

          // Sync preceding transport card to reference the new restaurant
          const prevIdx = vr.activityIndex - 1;
          if (prevIdx >= 0) {
            const prev = activities[prevIdx];
            if ((prev.category || '').toLowerCase() === 'transport' &&
                !lockedIds.has(prev.id)) {
              const oldTitle = prev.title;
              prev.title = `Travel to ${replacement.name}`;
              prev.location = { name: replacement.name, address: replacement.address || '' };
              if (prev.description) {
                prev.description = prev.description.replace(/to\s+.+\.?$/, `to ${replacement.name}.`);
              }
              repairs.push({
                code: FAILURE_CODES.DUPLICATE_CONCEPT,
                activityIndex: prevIdx,
                action: 'synced_transit_after_swap',
                before: oldTitle,
                after: prev.title,
              });
            }
          }

          repairs.push({
            code: FAILURE_CODES.DUPLICATE_CONCEPT,
            activityIndex: vr.activityIndex,
            action: 'swapped_from_pool',
            before,
            after: act.title,
          });
          continue;
        }
      }

      // Non-dining or no pool replacement: mark for removal
      indicesToRemove.push(vr.activityIndex);
    }

    // Remove in reverse order
    for (const idx of indicesToRemove.sort((a, b) => b - a)) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.DUPLICATE_CONCEPT,
          activityIndex: idx,
          action: 'removed_duplicate',
          before: removed?.title,
        });
      }
    }
  }

  // --- 5. WEAK_PERSONALIZATION: strip critical violations ---
  if (byCode.has(FAILURE_CODES.WEAK_PERSONALIZATION)) {
    const persResults = (byCode.get(FAILURE_CODES.WEAK_PERSONALIZATION) || [])
      .filter(vr => vr.severity === 'error')
      .map(vr => vr.activityIndex)
      .filter((i): i is number => i !== undefined)
      .sort((a, b) => b - a);
    for (const idx of persResults) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.WEAK_PERSONALIZATION,
          activityIndex: idx,
          action: 'removed_avoid_list_violation',
          before: removed?.title,
        });
      }
    }
  }

  // --- 5a. MEAL_ORDER: relabel meals whose title contradicts their time slot ---
  // Enhanced: check venue suitability before relabeling; swap from pool if incompatible
  if (byCode.has(FAILURE_CODES.MEAL_ORDER)) {
    const MEAL_KW_ORDER: Record<string, string[]> = {
      breakfast: ['breakfast', 'brunch'],
      lunch: ['lunch'],
      dinner: ['dinner', 'supper'],
    };

    // Venue keywords that signal incompatibility with a given meal type
    const VENUE_INCOMPATIBLE: Record<string, string[]> = {
      breakfast: ['nobu', 'steakhouse', 'izakaya', 'omakase', 'fine dining', 'cocktail', 'bar & grill', 'bar and grill', 'tapas', 'sushi', 'yakitori', 'robata', 'wagyu', 'kaiseki', 'tasting menu', 'wine bar', 'speakeasy', 'gastropub'],
      lunch: [], // most venues can serve lunch
      dinner: ['bakery', 'café', 'cafe', 'coffee', 'pancake', 'diner', 'bagel', 'doughnut', 'donut', 'juice bar', 'smoothie', 'açaí', 'acai', 'patisserie', 'pâtisserie', 'croissant'],
    };

    const normalizeForSwap = (name: string) => name.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const usedSetOrder = new Set((usedRestaurants || []).map(n => normalizeForSwap(n)));

    const orderResults = byCode.get(FAILURE_CODES.MEAL_ORDER) || [];
    for (const vr of orderResults) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act || lockedIds.has(act.id)) continue;

      const startMins = parseTimeToMinutes(act.startTime || '12:00');
      if (startMins === null) continue;

      // Determine correct meal for time slot
      let correctMeal: string | null = null;
      if (startMins >= 360 && startMins < 660) correctMeal = 'breakfast';
      else if (startMins >= 660 && startMins < 900) correctMeal = 'lunch';
      else if (startMins >= 1020 && startMins < 1380) correctMeal = 'dinner';
      if (!correctMeal) continue;

      // Find current meal label in title
      const title = (act.title || '');
      const titleLower = title.toLowerCase();
      let currentMealKey: string | null = null;
      let currentKeyword: string | null = null;
      for (const [meal, kws] of Object.entries(MEAL_KW_ORDER)) {
        for (const kw of kws) {
          if (titleLower.includes(kw)) {
            currentMealKey = meal;
            currentKeyword = kw;
            break;
          }
        }
        if (currentMealKey) break;
      }

      if (!currentMealKey || currentMealKey === correctMeal) continue;

      // Check venue compatibility with corrected meal type
      const venueText = [act.title, act.name, (act as any).description, (act as any).location?.name].filter(Boolean).join(' ').toLowerCase();
      const incompatibleKeywords = VENUE_INCOMPATIBLE[correctMeal] || [];
      const isVenueIncompatible = incompatibleKeywords.some(kw => venueText.includes(kw));

      if (isVenueIncompatible && restaurantPool && restaurantPool.length > 0) {
        // Try to swap with a suitable venue from the pool
        const replacement = restaurantPool.find(r => {
          if (usedSetOrder.has(normalizeForSwap(r.name))) return false;
          return r.mealType === correctMeal || r.mealType === 'any';
        });

        if (replacement) {
          const before = act.title;
          const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
          act.title = `${correctLabel} at ${replacement.name}`;
          if (act.name) act.name = replacement.name;
          if ((act as any).description) (act as any).description = `${correctLabel} at ${replacement.name}${replacement.cuisine ? ` — ${replacement.cuisine}` : ''}`;
          if ((act as any).location) {
            (act as any).location = {
              ...(act as any).location,
              name: replacement.name,
              ...(replacement.address ? { address: replacement.address } : {}),
              ...(replacement.neighborhood ? { neighborhood: replacement.neighborhood } : {}),
            };
          }
          usedSetOrder.add(normalizeForSwap(replacement.name));

          console.log(`[Repair] MEAL_ORDER+SWAP: "${before}" → "${act.title}" (venue incompatible with ${correctMeal}, swapped from pool)`);
          repairs.push({
            code: FAILURE_CODES.MEAL_ORDER,
            activityIndex: vr.activityIndex,
            action: 'swapped_incompatible_venue',
            before,
            after: act.title,
          });
          continue;
        }
        // No pool match — fall through to relabel-only
      }

      // Relabel: replace meal keyword in title (venue is compatible or no swap available)
      const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
      const before = act.title;
      const regex = new RegExp(`\\b${currentKeyword}\\b`, 'i');
      act.title = act.title.replace(regex, (match: string) =>
        match[0] === match[0].toUpperCase() ? correctLabel : correctLabel.toLowerCase()
      );
      if (act.name) act.name = act.title;

      console.log(`[Repair] MEAL_ORDER: "${before}" → "${act.title}" (time ${act.startTime})`);
      repairs.push({
        code: FAILURE_CODES.MEAL_ORDER,
        activityIndex: vr.activityIndex,
        action: 'relabeled_meal_for_time',
        before,
        after: act.title,
      });
    }
  }

  // --- 5b. MEAL_DUPLICATE: remove or relabel duplicate same-meal activities ---
  if (byCode.has(FAILURE_CODES.MEAL_DUPLICATE)) {
    const dupeResults = byCode.get(FAILURE_CODES.MEAL_DUPLICATE) || [];
    const MEAL_KW: Record<string, string[]> = {
      breakfast: ['breakfast', 'brunch'],
      lunch: ['lunch'],
      dinner: ['dinner', 'supper'],
    };

    // Determine which meal types are present and how many times
    const mealCounts: Record<string, number[]> = { breakfast: [], lunch: [], dinner: [] };
    for (let i = 0; i < activities.length; i++) {
      const title = (activities[i].title || '').toLowerCase();
      const cat = (activities[i].category || '').toLowerCase();
      if (!cat.includes('dining') && !cat.includes('food') && !cat.includes('restaurant')) continue;
      for (const [meal, kws] of Object.entries(MEAL_KW)) {
        if (kws.some(kw => title.includes(kw))) {
          mealCounts[meal].push(i);
        }
      }
    }

    // For each duplicate: try relabeling to the correct meal for its time slot, otherwise remove
    const indicesToRemove: number[] = [];
    for (const vr of dupeResults) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act || lockedIds.has(act.id)) continue;

      const startMins = parseTimeToMinutes(act.startTime || '12:00');
      if (startMins === null) { indicesToRemove.push(vr.activityIndex); continue; }

      // Determine what meal this time slot SHOULD be
      let correctMeal: string | null = null;
      if (startMins >= 360 && startMins < 660) correctMeal = 'breakfast';
      else if (startMins >= 660 && startMins < 900) correctMeal = 'lunch';
      else if (startMins >= 1020 && startMins < 1380) correctMeal = 'dinner';

      // Check current meal label
      const title = (act.title || '').toLowerCase();
      let currentMeal: string | null = null;
      for (const [meal, kws] of Object.entries(MEAL_KW)) {
        if (kws.some(kw => title.includes(kw))) { currentMeal = meal; break; }
      }

      if (correctMeal && correctMeal !== currentMeal && mealCounts[correctMeal].length === 0) {
        // Relabel: this is wrongly labeled for its time slot and the correct meal is missing
        const before = act.title;
        const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
        const currentLabel = currentMeal ? (currentMeal.charAt(0).toUpperCase() + currentMeal.slice(1)) : '';
        if (currentLabel && act.title) {
          act.title = act.title.replace(new RegExp(currentLabel, 'i'), correctLabel);
          if (act.name) act.name = act.title;
        }
        mealCounts[correctMeal].push(vr.activityIndex);
        repairs.push({
          code: FAILURE_CODES.MEAL_DUPLICATE,
          activityIndex: vr.activityIndex,
          action: 'relabeled_meal',
          before,
          after: act.title,
        });
      } else if (restaurantPool && restaurantPool.length > 0 && correctMeal && mealCounts[correctMeal].length === 0) {
        // Swap from pool for the correct meal type
        const normalizeForSwap = (name: string) => name.toLowerCase().replace(/[^\w\s]/g, '').trim();
        const usedSet = new Set((usedRestaurants || []).map(n => normalizeForSwap(n)));
        const replacement = restaurantPool.find(r => {
          if (usedSet.has(normalizeForSwap(r.name))) return false;
          return r.mealType === correctMeal || r.mealType === 'any';
        });
        if (replacement) {
          const before = act.title;
          const correctLabel = correctMeal.charAt(0).toUpperCase() + correctMeal.slice(1);
          act.title = `${correctLabel} at ${replacement.name}`;
          act.description = `${replacement.cuisine || 'Local cuisine'} in ${replacement.neighborhood || 'the city'}.`;
          act.location = { name: replacement.name, address: replacement.address || '' };
          if (act.name) act.name = act.title;
          usedSet.add(normalizeForSwap(replacement.name));
          mealCounts[correctMeal].push(vr.activityIndex);
          repairs.push({
            code: FAILURE_CODES.MEAL_DUPLICATE,
            activityIndex: vr.activityIndex,
            action: 'swapped_duplicate_meal_from_pool',
            before,
            after: act.title,
          });
          continue;
        }
        indicesToRemove.push(vr.activityIndex);
      } else {
        // Can't relabel or swap — remove the duplicate
        indicesToRemove.push(vr.activityIndex);
      }
    }

    // Remove duplicates in reverse order
    for (const idx of [...new Set(indicesToRemove)].sort((a, b) => b - a)) {
      if (idx < activities.length && !lockedIds.has(activities[idx]?.id)) {
        const removed = activities[idx];
        activities.splice(idx, 1);
        repairs.push({
          code: FAILURE_CODES.MEAL_DUPLICATE,
          activityIndex: idx,
          action: 'removed_duplicate_meal',
          before: removed?.title,
        });
      }
    }
  }

  // --- 6. LOGISTICS_SEQUENCE (departure day) ---
  const isDepartureDayForSequence = isLastDay || (isLastDayInCity && !isTransitionDay);
  if (isDepartureDayForSequence && byCode.has(FAILURE_CODES.LOGISTICS_SEQUENCE)) {
    const seqRepairs = repairDepartureSequence(activities, returnDepartureTime24, hotelName, lockedIds);
    repairs.push(...seqRepairs);
    // Re-sort after departure fixes
    activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
      const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
      return ta - tb;
    });
  }

  // --- 7. HOTEL CHECK-IN GUARANTEE (Day 1 or transition day) — moved before bookends ---
  const needsCheckIn = dayNumber === 1 || isTransitionDay;
  if (needsCheckIn && activities.length > 0) {
    const hasCheckIn = activities.some((a: any) => {
      const t = (a.title || a.name || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return cat === 'accommodation' && (
        t.includes('check-in') || t.includes('check in') ||
        t.includes('checkin') || t.includes('settle in') ||
        t.includes('luggage drop')
      );
    });

    if (!hasCheckIn) {
      const hn = hotelName || 'Your Hotel';
      const ha = hotelAddress || '';
      const firstAct = activities[0];
      const firstStartMin = parseTimeToMinutes(firstAct?.startTime || '15:00') ?? (15 * 60);
      const checkInStartMin = Math.max(12 * 60, firstStartMin - 45);
      const checkInStart = minutesToHHMM(checkInStartMin);
      const checkInEnd = minutesToHHMM(checkInStartMin + 30);

      const checkInActivity = {
        id: `day${dayNumber}-checkin-repair-${Date.now()}`,
        title: `Check-in at ${hn}`,
        name: `Check-in at ${hn}`,
        description: dayNumber === 1
          ? 'Check in, freshen up, and get oriented to the area'
          : `Check in to hotel in ${resolvedDestination || 'destination'}, freshen up after travel`,
        startTime: checkInStart,
        endTime: checkInEnd,
        category: 'accommodation',
        type: 'accommodation',
        location: { name: hn, address: ha },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false,
        isLocked: false,
        durationMinutes: 30,
        source: 'repair-checkin-guarantee',
      };

      activities.unshift(checkInActivity);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_checkin_guarantee' });

      // On arrival day, remove any accommodation activities scheduled BEFORE check-in
      // (e.g. "Return to Hotel", "Freshen Up") — logically impossible before you've arrived
      if (dayNumber === 1) {
        const checkInMin = checkInStartMin;
        const preCheckInAccom = activities.filter((a: any) => {
          if (a.id === checkInActivity.id) return false;
          const cat = (a.category || '').toLowerCase();
          const t = (a.title || '').toLowerCase();
          if (cat !== 'accommodation') return false;
          const aMin = parseTimeToMinutes(a.startTime || '') ?? 99999;
          return aMin < checkInMin;
        });
        for (const toRemove of preCheckInAccom) {
          const idx = activities.indexOf(toRemove);
          if (idx >= 0) {
            activities.splice(idx, 1);
            repairs.push({ code: FAILURE_CODES.CHRONOLOGY, action: 'removed_pre_checkin_accommodation', before: toRemove.title });
          }
        }

        // Strip hotel references from meals scheduled before check-in
        // (e.g. "Breakfast at Hotel" → "Breakfast" — you can't eat at a hotel you haven't arrived at)
        for (const act of activities) {
          const t = (act.title || '').toLowerCase();
          const cat = (act.category || '').toLowerCase();
          const aMin = parseTimeToMinutes(act.startTime || '') ?? 99999;
          if (cat === 'dining' && aMin < checkInMin && (t.includes('hotel') || t.includes(hotelName.toLowerCase()))) {
            const oldTitle = act.title;
            act.title = act.title.replace(/\s*(at|@)\s*(the\s+)?hotel.*/i, '').replace(new RegExp(`\\s*(at|@)\\s*(the\\s+)?${hotelName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'), '');
            if (act.name) act.name = act.title;
            repairs.push({ code: FAILURE_CODES.CHRONOLOGY, action: 'stripped_hotel_from_pre_checkin_meal', before: oldTitle, after: act.title });
          }
        }
      }
    }
  }

  // --- 8. HOTEL CHECKOUT GUARANTEE (last day or last day in city) — moved before bookends ---
  const needsCheckout = isLastDay || (isLastDayInCity && !isTransitionDay);
  if (needsCheckout && activities.length > 0) {
    const hasCheckout = activities.some((a: any) => {
      const t = (a.title || a.name || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return cat === 'accommodation' && (
        t.includes('check-out') || t.includes('check out') || t.includes('checkout')
      );
    });

    if (!hasCheckout) {
      const coHotelName = hotelOverride?.name || hotelName || 'Your Hotel';
      const coHotelAddr = hotelOverride?.address || hotelAddress || '';

      let checkoutStartMin: number;
      const depMins = returnDepartureTime24 ? (parseTimeToMinutes(returnDepartureTime24) ?? null) : null;
      if (isLastDay && depMins !== null) {
        checkoutStartMin = Math.max(7 * 60, depMins - 210);
      } else {
        checkoutStartMin = 11 * 60;
      }

      const checkoutStart = minutesToHHMM(checkoutStartMin);
      const checkoutEnd = minutesToHHMM(checkoutStartMin + 30);

      const checkoutActivity = {
        id: `day${dayNumber}-checkout-repair-${Date.now()}`,
        title: `Checkout from ${coHotelName}`,
        name: `Checkout from ${coHotelName}`,
        description: isLastDay
          ? 'Check out, collect luggage, and prepare for departure.'
          : `Check out from ${coHotelName}. Store luggage if needed before continuing your day.`,
        startTime: checkoutStart,
        endTime: checkoutEnd,
        category: 'accommodation',
        type: 'accommodation',
        location: { name: coHotelName, address: coHotelAddr },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false,
        isLocked: false,
        durationMinutes: 30,
        source: 'repair-checkout-guarantee',
      };

      // Insert chronologically
      let insertIdx = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const actStart = parseTimeToMinutes(activities[i].startTime || '') ?? 99999;
        if (checkoutStartMin <= actStart) { insertIdx = i; break; }
      }
      activities.splice(insertIdx, 0, checkoutActivity);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_checkout_guarantee' });
    }
  }

  // --- 8b. DEPARTURE TRANSPORT GUARANTEE ---
  // Ensure every departure day has a transport card to the airport/station.
  const isDepartureDay = isLastDay || (isLastDayInCity && !isTransitionDay);
  if (isDepartureDay && activities.length > 0) {
    const hasDepartureTransport = activities.some((a: any) => {
      const t = (a.title || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      return (cat === 'transport' || cat === 'transit' || cat === 'logistics') && (
        t.includes('airport') || t.includes('transfer to') || t.includes('head to') ||
        t.includes('taxi to') || t.includes('station') || t.includes('departure transfer')
      );
    });

    if (!hasDepartureTransport) {
      let transportTitle: string;
      let transportDesc: string;
      let transportStartMin: number;
      let transportDur = 45;

      if (isLastDay && returnDepartureTime24) {
        // Flight departure: time backward from flight
        const depMins = parseTimeToMinutes(returnDepartureTime24);
        const airportName = departureAirport || 'the Airport';
        transportTitle = `Transfer to ${airportName}`;
        transportDesc = `Depart for ${airportName} ahead of your flight.`;
        transportStartMin = depMins !== null ? Math.max(depMins - 180, 7 * 60) : 12 * 60;
      } else if (isLastDayInCity && nextLegTransport && nextLegTransport !== 'flight') {
        // Non-flight inter-city departure (train/bus)
        const stationName = nextLegTransportDetails?.stationName || 'the Station';
        const legDepTime = nextLegTransportDetails?.departureTime;
        transportTitle = `Transfer to ${stationName}`;
        transportDesc = `Head to ${stationName} for your ${nextLegTransport} to the next city.`;
        transportDur = 30;
        if (legDepTime) {
          const legMins = parseTimeToMinutes(legDepTime);
          transportStartMin = legMins !== null ? Math.max(legMins - 60, 7 * 60) : 12 * 60;
        } else {
          transportStartMin = 12 * 60;
        }
      } else {
        // Last day, no flight data — use nextLegTransport if available for correct labeling
        const fallbackMode = nextLegTransport || 'transfer';
        const modeLabel = fallbackMode.charAt(0).toUpperCase() + fallbackMode.slice(1);
        const hubName = fallbackMode === 'flight'
          ? (nextLegTransportDetails?.departureAirport || nextLegTransportDetails?.stationName || 'the Airport')
          : fallbackMode === 'train'
          ? (nextLegTransportDetails?.departureStation || nextLegTransportDetails?.stationName || 'the Station')
          : fallbackMode === 'ferry'
          ? (nextLegTransportDetails?.departureStation || 'the Ferry Terminal')
          : fallbackMode === 'bus'
          ? (nextLegTransportDetails?.departureStation || 'the Bus Station')
          : 'the departure point';
        transportTitle = fallbackMode === 'transfer' ? 'Departure Transfer' : `Transfer to ${hubName}`;
        transportDesc = fallbackMode === 'transfer'
          ? 'Head to the departure point for your onward journey.'
          : `Head to ${hubName} for your ${modeLabel} home.`;
        // Place after checkout
        const checkoutAct = activities.find((a: any) => {
          const t = (a.title || '').toLowerCase();
          return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
        });
        const checkoutEnd = checkoutAct ? (parseTimeToMinutes(checkoutAct.endTime) ?? 11 * 60 + 30) : 11 * 60 + 30;
        transportStartMin = checkoutEnd + 15;
      }

      const transportCard = {
        id: `day${dayNumber}-departure-transport-${Date.now()}`,
        title: transportTitle,
        name: transportTitle,
        description: transportDesc,
        startTime: minutesToHHMM(transportStartMin),
        endTime: minutesToHHMM(transportStartMin + transportDur),
        category: 'transport',
        type: 'transport',
        location: { name: transportTitle.replace('Transfer to ', ''), address: '' },
        cost: { amount: 0, currency: 'USD' },
        bookingRequired: false,
        isLocked: false,
        durationMinutes: transportDur,
        source: 'repair-departure-transport-guarantee',
      };

      // Insert chronologically
      let insertIdx = activities.length;
      for (let i = 0; i < activities.length; i++) {
        const actStart = parseTimeToMinutes(activities[i].startTime || '') ?? 99999;
        if (transportStartMin <= actStart) { insertIdx = i; break; }
      }
      activities.splice(insertIdx, 0, transportCard);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_departure_transport_guarantee', after: transportTitle });
    }

    // Also ensure a flight card exists on the last day if we have flight data
    if (isLastDay && returnDepartureTime24) {
      const hasFlightCard = activities.some((a: any) => {
        const t = (a.title || '').toLowerCase();
        const cat = (a.category || '').toLowerCase();
        return cat === 'flight' || t.includes('flight departure') || t.includes('departure flight');
      });

      if (!hasFlightCard) {
        const depMins = parseTimeToMinutes(returnDepartureTime24) ?? 15 * 60;
        const flightCard = {
          id: `day${dayNumber}-flight-departure-${Date.now()}`,
          title: 'Departure Flight',
          name: 'Departure Flight',
          description: 'Board your flight home.',
          startTime: minutesToHHMM(depMins),
          endTime: minutesToHHMM(depMins + 120),
          category: 'flight',
          type: 'flight',
          location: { name: departureAirport || 'Airport', address: '' },
          cost: { amount: 0, currency: 'USD' },
          bookingRequired: false,
          isLocked: false,
          durationMinutes: 120,
          source: 'repair-flight-guarantee',
        };
        activities.push(flightCard);
        activities.sort((a: any, b: any) => {
          const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
          const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
          return ta - tb;
        });
        repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_departure_flight_guarantee' });
      }
    }
  }

  // --- 9. MISSING_SLOT: bookend validator (with departure-day guards) ---
  // Always inject hotel bookends — use placeholder if no hotel selected yet.
  // "Your Hotel" placeholders get patched with real names via patchItineraryWithHotel.
  if (activities.length > 0) {
    const effectiveHotelName = hotelName || 'Your Hotel';
    const bookendRepairs = repairBookends(activities, effectiveHotelName, dayNumber, isDepartureDay, isFirstDay);
    activities = bookendRepairs.activities;
    repairs.push(...bookendRepairs.repairs);
  }

  // --- 9b. ACCOMMODATION TITLE NORMALIZATION ---
  // Standardize all accommodation activity titles to canonical format after all sources
  // (AI, repair step 7/8, bookends) have contributed.
  {
    const hn = hotelName || 'Your Hotel';
    for (const act of activities) {
      const cat = (act.category || '').toLowerCase();
      if (cat !== 'accommodation') continue;

      const t = (act.title || act.name || '').toLowerCase();
      let canonical: string | null = null;

      if (t.includes('checkout') || t.includes('check-out') || t.includes('check out')) {
        canonical = `Checkout from ${hn}`;
      } else if (t.includes('freshen up') || t.includes('freshen-up')) {
        canonical = `Freshen Up at ${hn}`;
      } else if (t.includes('return to') || t.includes('back to')) {
        canonical = `Return to ${hn}`;
      } else if (t.includes('luggage drop') || t.includes('drop bags')) {
        canonical = `Luggage Drop at ${hn}`;
      } else if (t.includes('check-in') || t.includes('check in') || t.includes('checkin') || t.includes('settle in') || t.includes('hotel')) {
        canonical = `Check-in at ${hn}`;
      }

      if (canonical && act.title !== canonical) {
        const before = act.title;
        act.title = canonical;
        act.name = canonical;
        // Also ensure location references the resolved hotel
        if (!act.location?.name || act.location.name === 'Your Hotel') {
          act.location = { name: hn, address: act.location?.address || '' };
        }
        repairs.push({
          code: FAILURE_CODES.MISSING_SLOT,
          action: 'normalized_accommodation_title',
          before,
          after: canonical,
        });
      }
    }
  }

  // --- 10. TITLE_LABEL_LEAK ---
  if (byCode.has(FAILURE_CODES.TITLE_LABEL_LEAK)) {
    for (const vr of byCode.get(FAILURE_CODES.TITLE_LABEL_LEAK) || []) {
      if (vr.activityIndex === undefined) continue;
      const act = activities[vr.activityIndex];
      if (!act) continue;
      const before = act.title;
      act.title = act.title
        .replace(/\s*[-–—]?\s*(voyance pick|staff pick|editor'?s? pick|ai pick|top pick|our pick)\s*/gi, '')
        .trim();
      if (act.title !== before) {
        repairs.push({
          code: FAILURE_CODES.TITLE_LABEL_LEAK,
          activityIndex: vr.activityIndex,
          action: 'stripped_label_leak',
          before,
          after: act.title,
        });
      }
    }
  }

  // --- 11. DEPARTURE SEQUENCE FIX (checkout after airport/station swap) ---
  if (isDepartureDay && activities.length > 1) {
    const checkoutIdx = activities.findIndex((a: any) => {
      const t = (a.title || '').toLowerCase();
      return t.includes('checkout') || t.includes('check-out') || t.includes('check out');
    });
    const transportIdx = activities.findIndex((a: any) => {
      const t = (a.title || '').toLowerCase();
      return (t.includes('airport') || t.includes('departure transfer') || t.includes('transfer to') || t.includes('station')) &&
             ((a.category || '').toLowerCase() === 'transport' || t.includes('transfer'));
    });

    if (checkoutIdx !== -1 && transportIdx !== -1 && checkoutIdx > transportIdx) {
      const checkoutAct = activities[checkoutIdx];
      const transportAct = activities[transportIdx];

      const checkoutDur = Math.max(5, ((parseTimeToMinutes(checkoutAct.endTime) ?? 0) - (parseTimeToMinutes(checkoutAct.startTime) ?? 0))) || 15;
      const transferDur = Math.max(10, ((parseTimeToMinutes(transportAct.endTime) ?? 0) - (parseTimeToMinutes(transportAct.startTime) ?? 0))) || 60;

      checkoutAct.startTime = transportAct.startTime;
      checkoutAct.endTime = addMinutesToHHMM(checkoutAct.startTime, checkoutDur);
      transportAct.startTime = checkoutAct.endTime;
      transportAct.endTime = addMinutesToHHMM(transportAct.startTime, transferDur);

      activities[transportIdx] = checkoutAct;
      activities[checkoutIdx] = transportAct;
      activities.sort((a: any, b: any) => {
        const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
        const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
        return ta - tb;
      });
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'swapped_checkout_before_departure_transport' });
    }
  }


  // --- 12. NON-FLIGHT DEPARTURE: strip airport activities ---
  if (isLastDayInCity && !isLastDay && nextLegTransport && nextLegTransport !== 'flight') {
    const beforeCount = activities.length;
    activities = activities.filter((a: any) => {
      const t = (a.title || '').toLowerCase();
      const isAirportRef =
        t.includes('airport') || t.includes('taxi to airport') ||
        t.includes('transfer to airport') || t.includes('departure transfer to airport') ||
        t.includes('flight departure') || t.includes('head to airport');
      return !isAirportRef || lockedIds.has(a.id);
    });
    const removed = beforeCount - activities.length;
    if (removed > 0) {
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: `stripped_${removed}_airport_refs_non_flight_leg` });
    }
  }

  // --- 13. TIME_OVERLAP CASCADE (final pass — catches overlaps from all prior injections) ---
  {
    activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
      const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
      return ta - tb;
    });

    const STRUCTURAL_CATS = ['accommodation', 'transport', 'logistics'];
    const STRUCTURAL_KW = ['checkout', 'check-out', 'check out', 'departure', 'airport', 'flight'];

    const isStructural = (act: any) => {
      const cat = (act.category || '').toLowerCase();
      const title = (act.title || '').toLowerCase();
      return STRUCTURAL_CATS.includes(cat) ||
        STRUCTURAL_KW.some(kw => title.includes(kw)) ||
        lockedIds.has(act.id);
    };

    for (let i = 0; i < activities.length - 1; i++) {
      const prev = activities[i];
      const curr = activities[i + 1];
      const prevEnd = parseTimeToMinutes(prev.endTime || '');
      const currStart = parseTimeToMinutes(curr.startTime || '');
      if (prevEnd === null || currStart === null || currStart >= prevEnd) continue;

      const overlapMins = prevEnd - currStart;

      if (isStructural(curr)) {
        // Truncate prev to end before structural activity
        const oldEnd = prev.endTime;
        prev.endTime = minutesToHHMM(currStart);
        repairs.push({
          code: FAILURE_CODES.TIME_OVERLAP,
          activityIndex: i,
          action: 'truncated_before_structural',
          before: `${prev.title} end ${oldEnd}`,
          after: `${prev.title} end ${prev.endTime}`,
        });
      } else {
        // Shift curr (and all subsequent) forward
        for (let j = i + 1; j < activities.length; j++) {
          const s = parseTimeToMinutes(activities[j].startTime || '');
          const e = parseTimeToMinutes(activities[j].endTime || '');
          if (s !== null) activities[j].startTime = minutesToHHMM(s + overlapMins);
          if (e !== null) activities[j].endTime = minutesToHHMM(e + overlapMins);
        }
        repairs.push({
          code: FAILURE_CODES.TIME_OVERLAP,
          activityIndex: i + 1,
          action: 'shifted_forward',
          before: `${curr.title} start ${minutesToHHMM(currStart)}`,
          after: `${curr.title} start ${minutesToHHMM(currStart + overlapMins)}`,
        });
      }
    }

    // Drop activities pushed past 23:30
    const cutoff = 23 * 60 + 30;
    activities = activities.filter((act: any) => {
      const s = parseTimeToMinutes(act.startTime || '');
      if (s !== null && s > cutoff) {
        repairs.push({
          code: FAILURE_CODES.TIME_OVERLAP,
          action: 'dropped_past_midnight',
          before: act.title,
        });
        return false;
      }
      return true;
    });
  }

  // --- 14. DEPARTURE DAY: prune activities after the last departure card ---
  // The flight/departure-transport card must be the final item on departure days.
  if (isDepartureDay && activities.length > 1) {
    const DEPARTURE_ROLES = new Set(['flight', 'airport-transport', 'airport-security']);
    const classifyDep = (a: any): string => {
      const t = (a.title || '').toLowerCase();
      const cat = (a.category || '').toLowerCase();
      if (cat === 'flight' || t.includes('flight departure') || t.includes('departure flight')) return 'flight';
      if (t.includes('airport departure') || t.includes('airport security') || t.includes('security and boarding') ||
          t.includes('departure and security')) return 'airport-security';
      if ((cat === 'transport' || cat === 'transit' || cat === 'logistics') &&
          (t.includes('airport') || t.includes('transfer to the airport') || t.includes('departure transfer') ||
           t.includes('head to airport') || t.includes('taxi to airport') ||
           t.includes('transfer to') && (t.includes('airport') || t.includes('station') || t.includes('terminal')))) return 'airport-transport';
      // Also catch generic departure cards on last day
      if ((cat === 'transport' || cat === 'transit') &&
          (t.includes('departure') || t.includes('heading home'))) return 'airport-transport';
      return 'other';
    };

    // Find the index of the last departure-related card
    let lastDepartureIdx = -1;
    for (let i = activities.length - 1; i >= 0; i--) {
      if (DEPARTURE_ROLES.has(classifyDep(activities[i]))) {
        lastDepartureIdx = i;
        break;
      }
    }

    if (lastDepartureIdx !== -1 && lastDepartureIdx < activities.length - 1) {
      // There are activities after the last departure card — remove them
      const trailing = activities.slice(lastDepartureIdx + 1);
      const toRemove = trailing.filter(a => {
        const role = classifyDep(a);
        return !DEPARTURE_ROLES.has(role) && !lockedIds.has(a.id);
      });

      for (const act of toRemove) {
        const idx = activities.indexOf(act);
        if (idx !== -1) {
          activities.splice(idx, 1);
          repairs.push({
            code: FAILURE_CODES.LOGISTICS_SEQUENCE,
            action: 'pruned_after_departure_card',
            before: act.title,
          });
        }
      }
    }
  }

  return {
    day: { ...input.day, activities },
    repairs,
  };
}

// =============================================================================
// DEPARTURE SEQUENCE REPAIR
// =============================================================================

function repairDepartureSequence(
  activities: any[],
  depFlight24: string | undefined,
  hotelName: string | undefined,
  lockedIds: Set<string>
): RepairAction[] {
  const repairs: RepairAction[] = [];

  type DvRole = 'breakfast' | 'checkout' | 'airport-transport' | 'airport-security' | 'flight' | 'other';
  const classify = (a: any): DvRole => {
    const t = (a.title || '').toLowerCase();
    const cat = (a.category || '').toLowerCase();

    if (cat === 'flight' || t.includes('flight departure') || t.includes('departure flight')) return 'flight';
    if (t.includes('airport departure') || t.includes('airport security') || t.includes('security and boarding') ||
        t.includes('check-in at airport') || t.includes('departure and security')) return 'airport-security';
    if ((cat === 'transport' || cat === 'transit') &&
        (t.includes('airport') || t.includes('head to airport') || t.includes('taxi to airport'))) return 'airport-transport';
    if (t.includes('checkout') || t.includes('check-out') || t.includes('check out')) return 'checkout';
    if ((cat === 'dining' || cat === 'restaurant' || cat === 'food') &&
        (t.includes('breakfast') || t.includes('morning meal'))) return 'breakfast';
    return 'other';
  };

  const breakfastItems = activities.filter(a => classify(a) === 'breakfast');
  const checkoutItems = activities.filter(a => classify(a) === 'checkout');
  const flightItems = activities.filter(a => classify(a) === 'flight');
  const securityItems = activities.filter(a => classify(a) === 'airport-security');

  // R1: Move breakfast before checkout
  if (breakfastItems.length > 0 && checkoutItems.length > 0) {
    const bIdx = activities.indexOf(breakfastItems[0]);
    const cIdx = activities.indexOf(checkoutItems[0]);
    if (bIdx > cIdx) {
      const [breakfast] = activities.splice(bIdx, 1);
      const newCIdx = activities.indexOf(checkoutItems[0]);
      activities.splice(newCIdx, 0, breakfast);

      const checkoutStart = parseTimeToMinutes(checkoutItems[0].startTime) ?? 480;
      const breakfastStart = checkoutStart - 60;
      breakfast.startTime = minutesToHHMM(Math.max(breakfastStart, 360));
      breakfast.endTime = minutesToHHMM(Math.max(breakfastStart, 360) + 45);
      checkoutItems[0].startTime = breakfast.endTime;
      checkoutItems[0].endTime = addMinutesToHHMM(breakfast.endTime, 15);

      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'moved_breakfast_before_checkout' });
    }
  }

  // R4: Remove duplicate airport transports
  const airportTransports = activities.filter(a => classify(a) === 'airport-transport');
  if (airportTransports.length > 1) {
    const toKeep = airportTransports[airportTransports.length - 1];
    for (const item of airportTransports) {
      if (item !== toKeep && !lockedIds.has(item.id)) {
        const idx = activities.indexOf(item);
        if (idx !== -1) {
          activities.splice(idx, 1);
          repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'removed_duplicate_airport_transport', before: item.title });
        }
      }
    }
  }

  // Remove nonsensical walk-to-airport
  for (let i = activities.length - 1; i >= 0; i--) {
    const a = activities[i];
    const t = (a.title || '').toLowerCase();
    const cat = (a.category || '').toLowerCase();
    if ((cat === 'transport' || cat === 'transit') && t.includes('walk') &&
        (t.includes('airport') || (a.location?.name || '').toLowerCase().includes('airport'))) {
      const dur = a.durationMinutes || 0;
      if ((dur <= 15 || t.includes('walk to')) && !lockedIds.has(a.id)) {
        activities.splice(i, 1);
        repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'removed_walk_to_airport', before: a.title });
      }
    }
  }

  // R2: Move security before flight
  if (securityItems.length > 0 && flightItems.length > 0) {
    const secAct = securityItems[0];
    const flightAct = flightItems[0];
    const secIdx = activities.indexOf(secAct);
    const flightIdx = activities.indexOf(flightAct);
    if (secIdx !== -1 && flightIdx !== -1 && secIdx !== flightIdx - 1) {
      activities.splice(secIdx, 1);
      const newFlightIdx = activities.indexOf(flightAct);
      activities.splice(newFlightIdx, 0, secAct);
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'moved_security_before_flight' });
    }
  }

  // R3: Move activities after security to before airport transport
  if (securityItems.length > 0) {
    const secAct = securityItems[0];
    const secIdx = activities.indexOf(secAct);
    if (secIdx !== -1) {
      const afterSecurity = activities.slice(secIdx + 1);
      const misplaced = afterSecurity.filter(a => {
        const role = classify(a);
        return role !== 'flight' && role !== 'airport-transport' && role !== 'airport-security';
      });
      for (const mis of misplaced) {
        if (lockedIds.has(mis.id)) continue;
        const misIdx = activities.indexOf(mis);
        if (misIdx !== -1) {
          activities.splice(misIdx, 1);
          const atIdx = activities.findIndex(a => classify(a) === 'airport-transport');
          const insertAt = atIdx !== -1 ? atIdx : Math.max(0, activities.indexOf(checkoutItems[0]) || 0);
          activities.splice(insertAt, 0, mis);
          repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'moved_before_airport_transport', before: mis.title });
        }
      }
    }
  }

  // R5: Time window enforcement
  if (depFlight24 && checkoutItems.length > 0) {
    const depMins = parseTimeToMinutes(depFlight24);
    if (depMins !== null) {
      const airportBuffer = 150;
      const arriveAirportBy = depMins - airportBuffer;
      const transportCard = activities.find(a => classify(a) === 'airport-transport');
      const transportDuration = transportCard?.durationMinutes || 45;
      const latestCheckoutMins = arriveAirportBy - transportDuration - 30;

      // Re-anchor checkout if too late
      const checkoutMins = parseTimeToMinutes(checkoutItems[0].startTime) ?? 0;
      if (checkoutMins > latestCheckoutMins) {
        const before = checkoutItems[0].startTime;
        checkoutItems[0].startTime = minutesToHHMM(Math.max(latestCheckoutMins, 360));
        checkoutItems[0].endTime = addMinutesToHHMM(checkoutItems[0].startTime, 15);
        repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 're_anchored_checkout', before, after: checkoutItems[0].startTime });

        if (breakfastItems.length > 0) {
          const newCkMins = parseTimeToMinutes(checkoutItems[0].startTime) ?? 480;
          breakfastItems[0].startTime = minutesToHHMM(Math.max(newCkMins - 60, 360));
          breakfastItems[0].endTime = minutesToHHMM(Math.max(newCkMins - 15, 405));
          repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 're_anchored_breakfast' });
        }
      }

      // Remove activities that don't fit
      const cIdx = activities.indexOf(checkoutItems[0]);
      const tIdx = transportCard ? activities.indexOf(transportCard) : -1;
      if (cIdx !== -1 && tIdx !== -1 && tIdx > cIdx + 1) {
        const between = activities.slice(cIdx + 1, tIdx);
        let currentTime = parseTimeToMinutes(checkoutItems[0].endTime) ?? latestCheckoutMins;
        for (let j = between.length - 1; j >= 0; j--) {
          const act = between[j];
          const actDur = act.durationMinutes || 60;
          if (currentTime + actDur > arriveAirportBy - transportDuration) {
            const idx = activities.indexOf(act);
            if (idx !== -1 && !lockedIds.has(act.id)) {
              activities.splice(idx, 1);
              repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'removed_doesnt_fit_departure_window', before: act.title });
            }
          } else {
            currentTime += actDur + 15;
          }
        }
      }
    }
  }

  // R6: Breakfast location — override if not near hotel
  if (breakfastItems.length > 0 && hotelName) {
    const bAct = breakfastItems[0];
    const bLoc = (bAct.location?.name || '').toLowerCase();
    const hotelLower = hotelName.toLowerCase();
    const isNearHotel = bLoc.includes(hotelLower) || bLoc.includes('hotel') || bLoc.includes('lobby') || hotelLower.includes(bLoc);
    if (!isNearHotel && bLoc.length > 0) {
      const before = bAct.location?.name;
      bAct.location = { name: `Near ${hotelName}`, address: bAct.location?.address || '' };
      repairs.push({ code: FAILURE_CODES.LOGISTICS_SEQUENCE, action: 'override_breakfast_location', before, after: bAct.location.name });
    }
  }

  return repairs;
}

// =============================================================================
// BOOKEND REPAIR (transport gaps + hotel returns)
// =============================================================================

function repairBookends(
  activities: any[],
  hotelName: string,
  dayNumber: number,
  isDepartureDay: boolean,
  isFirstDay: boolean = false,
): { activities: any[]; repairs: RepairAction[] } {
  const repairs: RepairAction[] = [];

  const isTransport = (a: any) => (a.category || '').toLowerCase() === 'transport';
  const isAccom = (a: any) => (a.category || '').toLowerCase() === 'accommodation';
  const isHotelRelated = (a: any) => {
    const t = (a.title || '').toLowerCase();
    const l = (a.location?.name || '').toLowerCase();
    const hn = hotelName.toLowerCase();
    return t.includes(hn) || l.includes(hn) || t.includes('hotel') || t.includes('return to') || t.includes('freshen up');
  };

  const offset = (ts: string, min: number): string => {
    if (!ts) return '';
    const p = ts.split(':');
    if (p.length < 2) return ts;
    const tot = parseInt(p[0], 10) * 60 + parseInt(p[1], 10) + min;
    return `${String(Math.floor(tot / 60) % 24).padStart(2, '0')}:${String(tot % 60).padStart(2, '0')}`;
  };

  const makeAccomCard = (label: string, st: string, dur: number) => ({
    id: `bookend-${label.replace(/\s/g, '-').toLowerCase()}-${dayNumber}-${Date.now()}`,
    title: `${label} ${hotelName}`,
    category: 'accommodation',
    description: `Time at ${hotelName} to rest and refresh.`,
    startTime: st, endTime: offset(st, dur), durationMinutes: dur,
    location: { name: hotelName, address: '' },
    cost: { amount: 0, currency: 'USD' }, isLocked: false,
    tags: ['hotel', 'rest'], source: 'bookend-validator',
  });

  const makeTransCard = (from: string, to: string, st: string) => ({
    id: `transport-gap-${dayNumber}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: `Travel to ${to}`, category: 'transport',
    description: `Transit from ${from} to ${to}.`,
    startTime: st, endTime: offset(st, 15), durationMinutes: 15,
    location: { name: to, address: '' },
    cost: { amount: 0, currency: 'USD' }, isLocked: false,
    tags: ['transport'], transportation: { method: 'walking', duration: '15 min' },
    source: 'bookend-validator',
  });

  // 1. Mid-day hotel transports without accommodation card
  for (let i = 0; i < activities.length - 1; i++) {
    if (isTransport(activities[i]) && isHotelRelated(activities[i]) && !isAccom(activities[i + 1])) {
      // Skip if departure day and checkout already exists (traveler has left the hotel)
      if (isDepartureDay) {
        const hasCheckout = activities.some((a: any) => (a.title || '').toLowerCase().includes('checkout') || (a.title || '').toLowerCase().includes('check-out'));
        const checkoutIdx = activities.findIndex((a: any) => (a.title || '').toLowerCase().includes('checkout') || (a.title || '').toLowerCase().includes('check-out'));
        if (hasCheckout && i >= checkoutIdx) continue;
      }
      const card = makeAccomCard('Freshen up at', activities[i].endTime || offset(activities[i].startTime || '14:00', 15), 30);
      activities.splice(i + 1, 0, card);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_hotel_freshen_up' });
    }
  }

  // 1b. Mid-day hotel return guarantee — SKIP on departure days AND on first day before check-in
  if (!isDepartureDay) {
    // On first day, find the check-in activity to ensure mid-day return only happens AFTER check-in
    const checkInIdx = isFirstDay
      ? activities.findIndex((a: any) => {
          const t = (a.title || '').toLowerCase();
          return isAccom(a) && (t.includes('check-in') || t.includes('check in') || t.includes('checkin'));
        })
      : -1;

    const lunchIdx = activities.findIndex(a => (a.category === 'dining') && /\b(lunch|midday meal)\b/i.test(a.title || ''));
    const dinnerIdx = activities.findIndex(a => (a.category === 'dining') && /\b(dinner|evening meal)\b/i.test(a.title || ''));
    if (lunchIdx >= 0 && dinnerIdx > lunchIdx) {
      // On first day, skip mid-day hotel return if lunch is before check-in (can't return to a place you haven't been)
      const skipBecausePreCheckIn = isFirstDay && checkInIdx >= 0 && lunchIdx < checkInIdx;
      if (!skipBecausePreCheckIn) {
        const hasMidDayAccom = activities.slice(lunchIdx + 1, dinnerIdx).some(a => isAccom(a));
        if (!hasMidDayAccom) {
          let insertIdx = dinnerIdx;
          for (let j = dinnerIdx - 1; j > lunchIdx; j--) {
            if (!isTransport(activities[j])) { insertIdx = j + 1; break; }
          }
          const prevEnd = activities[insertIdx - 1]?.endTime || '16:00';
          const transportCard = makeTransCard(activities[insertIdx - 1]?.location?.name || 'venue', hotelName, prevEnd);
          const accomCard = makeAccomCard('Freshen up at', offset(prevEnd, 15), 30);
          activities.splice(insertIdx, 0, transportCard, accomCard);
          repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_midday_hotel_return' });
        }
      }
    }
  }

  // 2. End-of-day hotel return — SKIP on departure days (traveler is at the airport/departed)
  if (!isDepartureDay) {
    // On first day, only inject "Return to Hotel" if check-in has already happened
    const hasCheckedIn = !isFirstDay || activities.some((a: any) => {
      const t = (a.title || '').toLowerCase();
      return isAccom(a) && (t.includes('check-in') || t.includes('check in') || t.includes('checkin'));
    });

    if (hasCheckedIn) {
      const visible = activities.filter(a => !isTransport(a));
      const last = visible[visible.length - 1];
      if (last && !isAccom(last)) {
        const et = last.endTime || '22:00';
        activities.push(makeTransCard(last.location?.name || last.title || 'venue', hotelName, et));
        activities.push(makeAccomCard('Return to', offset(et, 20), 15));
        repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_hotel_return' });
      }
    }
  }

  // 3. Transit gaps between non-adjacent visible activities (with guards)
  const rebuilt: any[] = [];
  for (let i = 0; i < activities.length; i++) {
    rebuilt.push(activities[i]);
    if (i < activities.length - 1) {
      const curr = activities[i], next = activities[i + 1];
      if (isTransport(curr) || isTransport(next)) continue;
      const cLoc = (curr.location?.name || curr.title || '').toLowerCase();
      const nLoc = (next.location?.name || next.title || '').toLowerCase();
      // Guard: skip if same location (e.g. hotel accommodation → hotel freshen-up)
      if (!cLoc || !nLoc || cLoc === nLoc) continue;
      // Guard: skip if a transport to nLoc already exists in previous 2 positions
      const recentTransport = rebuilt.slice(-2).some(
        a => isTransport(a) && (a.location?.name || '').toLowerCase() === nLoc
      );
      if (recentTransport) continue;
      rebuilt.push(makeTransCard(curr.location?.name || curr.title, next.location?.name || next.title, curr.endTime || ''));
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_transit_gap' });
    }
  }

  // 4. Final consolidation — collapse consecutive transports from ALL sources
  {
    const consolidated: any[] = [];
    for (let i = 0; i < rebuilt.length; i++) {
      if (isTransport(rebuilt[i])) {
        let j = i;
        while (j + 1 < rebuilt.length && isTransport(rebuilt[j + 1])) j++;
        if (j > i) {
          const first = rebuilt[i];
          const last = rebuilt[j];
          const merged = {
            ...last,
            startTime: first.startTime || last.startTime,
            description: `Transit to ${last.location?.name || last.title}`,
          };
          consolidated.push(merged);
          repairs.push({
            code: FAILURE_CODES.LOGISTICS_SEQUENCE,
            action: 'collapsed_consecutive_transport',
            before: `${j - i + 1} transport cards`,
            after: merged.title,
          });
          i = j;
        } else {
          consolidated.push(rebuilt[i]);
        }
      } else {
        consolidated.push(rebuilt[i]);
      }
    }

    // 4b. Remove orphaned transports where destination matches the immediately next activity's location
    const deduped: any[] = [];
    for (let i = 0; i < consolidated.length; i++) {
      if (isTransport(consolidated[i]) && i + 1 < consolidated.length) {
        const transportDest = (consolidated[i].location?.name || '').toLowerCase();
        const nextLoc = (consolidated[i + 1]?.location?.name || '').toLowerCase();
        // If previous non-transport activity is at the same location as transport destination, skip
        if (transportDest && nextLoc && deduped.length > 0) {
          const prevNonTransport = [...deduped].reverse().find(a => !isTransport(a));
          if (prevNonTransport && (prevNonTransport.location?.name || '').toLowerCase() === transportDest) {
            repairs.push({
              code: FAILURE_CODES.LOGISTICS_SEQUENCE,
              action: 'removed_orphaned_transport',
              before: consolidated[i].title,
              after: 'removed (same location)',
            });
            continue;
          }
        }
      }
      deduped.push(consolidated[i]);
    }

    return { activities: deduped, repairs };
  }
}
