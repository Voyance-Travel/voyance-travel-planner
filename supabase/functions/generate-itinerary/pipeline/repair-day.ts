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
 * 6. LOGISTICS_SEQUENCE (departure day reorder)
 * 7. MISSING_SLOT (bookend: inject transits + hotel returns)
 * 8. MEAL_MISSING (final guard — inject fallback meals)
 */

import { FAILURE_CODES, type ValidationResult, type RepairAction, type FailureCode } from './types.ts';
import type { StrictActivityMinimal, StrictDayMinimal } from '../day-validation.ts';
import {
  parseTimeToMinutes,
  minutesToHHMM,
  addMinutesToHHMM,
} from '../flight-hotel-context.ts';

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
    arrivalTime24, returnDepartureTime24, hotelName, hasHotel,
    lockedActivities, restaurantPool, usedRestaurants } = input;

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
    const usedSet = new Set((usedRestaurants || []).map(n => n.toLowerCase()));
    // Track current day dining as used
    for (const act of activities) {
      if ((act.category || '').toLowerCase() === 'dining') {
        usedSet.add((act.title || '').toLowerCase());
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
          const rName = (r.name || '').toLowerCase();
          if (usedSet.has(rName)) return false;
          return r.mealType === mealType || r.mealType === 'any';
        });

        if (replacement) {
          const before = act.title;
          act.title = `${mealType.charAt(0).toUpperCase() + mealType.slice(1)} at ${replacement.name}`;
          act.description = `${replacement.cuisine || 'Local cuisine'} in ${replacement.neighborhood || 'the city'}. ${replacement.priceRange || '$$'}.`;
          act.location = { name: replacement.name, address: replacement.address || '' };
          act.source = 'pool-dedup-swap';
          usedSet.add(replacement.name.toLowerCase());
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

  // --- 6. LOGISTICS_SEQUENCE (departure day) ---
  if (isLastDay && byCode.has(FAILURE_CODES.LOGISTICS_SEQUENCE)) {
    const seqRepairs = repairDepartureSequence(activities, returnDepartureTime24, hotelName, lockedIds);
    repairs.push(...seqRepairs);
    // Re-sort after departure fixes
    activities.sort((a: any, b: any) => {
      const ta = parseTimeToMinutes(a.startTime || '') ?? 99999;
      const tb = parseTimeToMinutes(b.startTime || '') ?? 99999;
      return ta - tb;
    });
  }

  // --- 7. MISSING_SLOT: bookend validator ---
  if (hotelName && hasHotel && activities.length > 0) {
    const bookendRepairs = repairBookends(activities, hotelName, dayNumber);
    activities = bookendRepairs.activities;
    repairs.push(...bookendRepairs.repairs);
  }

  // --- 8. TITLE_LABEL_LEAK ---
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
      const card = makeAccomCard('Freshen up at', activities[i].endTime || offset(activities[i].startTime || '14:00', 15), 30);
      activities.splice(i + 1, 0, card);
      repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_hotel_freshen_up' });
    }
  }

  // 2. End-of-day hotel return
  const visible = activities.filter(a => !isTransport(a));
  const last = visible[visible.length - 1];
  if (last && !isAccom(last)) {
    const et = last.endTime || '22:00';
    activities.push(makeTransCard(last.location?.name || last.title || 'venue', hotelName, et));
    activities.push(makeAccomCard('Return to', offset(et, 20), 15));
    repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_hotel_return' });
  }

  // 3. Transit gaps between non-adjacent visible activities
  const rebuilt: any[] = [];
  for (let i = 0; i < activities.length; i++) {
    rebuilt.push(activities[i]);
    if (i < activities.length - 1) {
      const curr = activities[i], next = activities[i + 1];
      if (isTransport(curr) || isTransport(next)) continue;
      const cLoc = (curr.location?.name || curr.title || '').toLowerCase();
      const nLoc = (next.location?.name || next.title || '').toLowerCase();
      if (cLoc && nLoc && cLoc !== nLoc) {
        rebuilt.push(makeTransCard(curr.location?.name || curr.title, next.location?.name || next.title, curr.endTime || ''));
        repairs.push({ code: FAILURE_CODES.MISSING_SLOT, action: 'injected_transit_gap' });
      }
    }
  }

  return { activities: rebuilt, repairs };
}
