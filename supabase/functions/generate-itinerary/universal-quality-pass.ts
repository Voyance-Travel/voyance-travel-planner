/**
 * Universal Quality Pass — Single orchestrator for all post-generation quality steps.
 *
 * Consolidates scattered enforcement steps into one reusable function:
 * 1. Arrival timing (Day 1 only)
 * 2. Departure timing (Last day only)
 * 3. Cross-day venue dedup
 * 4. Fix placeholder meals (AI re-generation)
 * 4b. Nuclear placeholder sweep (synchronous last-resort)
 * 5. Free venue pricing
 * 6. Market dining cap
 * 7. Universal price caps (bar, casual, venue-type, ticketed, Michelin floor)
 * 8. Hotel return injection (except departure day)
 * 9. Update used venues set for next day
 * 10. Terminal cleanup (placeholder + timing scrub) — exported for use after meal guards
 */

import { enforceArrivalTiming, enforceDepartureTiming } from './flight-hotel-context.ts';
import { fixPlaceholdersForDay, nuclearPlaceholderSweep, nuclearWellnessSweep } from './fix-placeholders.ts';
import {
  checkAndApplyFreeVenue,
  enforceMarketDiningCap,
  enforceBarNightcapPriceCap,
  enforceCasualVenuePriceCap,
  enforceVenueTypePriceCap,
  enforceTicketedAttractionPricing,
  enforceMichelinPriceFloor,
  enforceHighCostBookingGuidance,
} from './sanitization.ts';
import { normalizeVenueName, venueNamesMatch } from './generation-utils.ts';
import { getDiningConfig } from './dining-config.ts';

// =============================================================================
// OPTIONS INTERFACE
// =============================================================================

export interface UniversalQualityOptions {
  city: string;
  country: string;
  dnaTier?: string;        // Explorer, Connector, Achiever, Restorer, Curator, Transformer
  dnaArchetype?: string;   // "The Luxury Luminary", "The Urban Nomad", etc.
  dayIndex: number;        // 0-based
  totalDays: number;
  usedVenueNames: Set<string>;
  arrivalTime?: string;    // HH:MM 24h, day 0 only
  departureTime?: string;  // HH:MM 24h, last day only
  departureTransportType?: string; // 'train', 'flight', etc. — controls buffer size
  dayTitle?: string;
  budgetTier?: string;
  apiKey?: string;
  lockedActivities?: any[];
  usedRestaurants?: string[];
}

// Categories to skip for cross-day venue dedup (these repeat legitimately)
const DEDUP_SKIP_CATS = new Set([
  'stay', 'transport', 'travel', 'logistics', 'flight', 'accommodation',
]);

// =============================================================================
// MAIN ORCHESTRATOR
// =============================================================================

export async function universalQualityPass(
  activities: any[],
  options: UniversalQualityOptions,
): Promise<any[]> {
  const {
    city, country, dnaTier, dnaArchetype, dayIndex, totalDays,
    usedVenueNames, arrivalTime, departureTime, departureTransportType,
    dayTitle, budgetTier, apiKey, lockedActivities, usedRestaurants,
  } = options;

  // Compute DNA-aware dining config internally
  const diningConfig = getDiningConfig(dnaTier || 'Explorer', dnaArchetype || '');

  const label = `QUALITY_PASS_D${dayIndex + 1}`;
  console.log(`\n[QUALITY] ====== Day ${dayIndex + 1} of ${totalDays}: ${city}, ${country} | ${dnaArchetype || 'default'} (${dnaTier || 'Explorer'}) ======`);

  let result = [...activities];

  // ── Step 1: Arrival timing (Day 1 only) ──
  if (dayIndex === 0 && arrivalTime) {
    result = enforceArrivalTiming(result, arrivalTime);
    console.log(`[QUALITY] After arrival filter: ${result.length} activities`);
  }

  // ── Step 2: Departure timing (last day only) ──
  if (dayIndex === totalDays - 1 && departureTime) {
    result = enforceDepartureTiming(result, departureTime, departureTransportType);
    console.log(`[QUALITY] After departure filter: ${result.length} activities (transport: ${departureTransportType || 'flight'})`);
  }

  // ── Step 3: Cross-day venue dedup (before placeholder fixing — no point fixing a dupe) ──
  if (usedVenueNames.size > 0) {
    result = result.filter(a => {
      const cat = (a.category || '').toLowerCase();
      if (DEDUP_SKIP_CATS.has(cat)) return true;
      // Don't dedup dining — it's handled separately by restaurant dedup
      if (cat === 'dining' || cat === 'restaurant') return true;

      const candidates = [
        a.location?.name || '',
        a.venue_name || '',
        a.title || '',
      ].map(s => s.trim()).filter(s => s.length > 3 && !/your hotel/i.test(s));

      for (const raw of candidates) {
        const norm = normalizeVenueName(raw);
        if (!norm) continue;
        for (const used of usedVenueNames) {
          if (venueNamesMatch(norm, used)) {
            console.warn(`[QUALITY] DEDUP: "${a.title}" at "${a.venue_name || a.location?.name || ''}" repeats from previous day — REMOVING`);
            return false;
          }
        }
      }
      return true;
    });
  }

  // ── Step 3b: Venue-meal-type guard — prevent lunch/snack spots from being dinner ──
  // Runs BEFORE placeholder fixing so flagged venues get replaced by the AI or nuclear sweep
  {
    const NOT_DINNER_VENUES: Record<string, string> = {
      'petit bon': 'lunch',
      'angelina': 'breakfast',
      'stohrer': 'breakfast',
      'ladurée': 'breakfast',
      'laduree': 'breakfast',
      'du pain et des idées': 'breakfast',
      'du pain et des idees': 'breakfast',
    };

    for (const act of result) {
      const cat = (act.category || '').toUpperCase();
      if (cat !== 'DINING' && cat !== 'RESTAURANT') continue;

      const venueName = (act.venue_name || act.title || '').toLowerCase().trim();
      const startStr = act.startTime || act.start_time || '';
      const startMins = parseTimeMins(startStr);

      for (const [venueKey, correctMeal] of Object.entries(NOT_DINNER_VENUES)) {
        if (venueName.includes(venueKey) && startMins !== null && startMins >= 17 * 60) {
          console.warn(`[${label}] VENUE-MEAL GUARD: "${act.title}" is a ${correctMeal} venue scheduled at dinner time (${startStr}) — flagging for replacement`);
          act.title = `Dinner at a Local Restaurant`;
          act.venue_name = '';
          act.description = `[Auto-replaced: ${venueName} is a ${correctMeal}/snack venue, not suitable for dinner]`;
          break;
        }
      }
    }
  }

  // ── Step 4: Fix placeholder meals (DNA-aware AI re-generation) ──
  // Runs even without apiKey — the fast DB path works without it; only AI fallback needs the key
  await fixPlaceholdersForDay(
    result,
    city,
    country,
    dnaTier || 'Explorer',
    dayIndex,
    usedRestaurants || [],
    budgetTier || 'moderate',
    apiKey || '',
    lockedActivities || [],
    dayTitle,
    diningConfig,
  );

  // ── Step 4b: Nuclear placeholder sweep (synchronous, zero-API last resort) ──
  const nuclearCount = nuclearPlaceholderSweep(result, city, diningConfig);
  if (nuclearCount > 0) {
    console.warn(`[QUALITY] Nuclear sweep replaced ${nuclearCount} surviving placeholder(s) in Day ${dayIndex + 1}`);
  }

  // ── Step 5: Free venue pricing ──
  for (const act of result) {
    checkAndApplyFreeVenue(act, label);
  }

  // ── Step 6: Market dining cap ──
  for (const act of result) {
    enforceMarketDiningCap(act, label);
  }

  // ── Step 7: Universal price caps ──
  for (const act of result) {
    enforceBarNightcapPriceCap(act, label);
    enforceCasualVenuePriceCap(act, label);
    enforceVenueTypePriceCap(act, label);
    enforceTicketedAttractionPricing(act, label);
    enforceMichelinPriceFloor(act, label);
    enforceHighCostBookingGuidance(act, label);
  }

  // ── Step 7b: Day 1 dining tier mismatch (luxury food audiences) ──
  // Flag the dinner with `needs_elevation: true` if Day 1 lunch + dinner are
  // both at/below the configured lunch midpoint — repair pass picks this up.
  if (dayIndex === 0) {
    const isLuxuryFood =
      dnaTier === 'Curator' ||
      dnaArchetype === 'The Luxury Luminary' ||
      dnaArchetype === 'The Culinary Cartographer' ||
      dnaArchetype === 'The VIP Voyager';

    if (isLuxuryFood && (diningConfig.michelinPolicy === 'required' || diningConfig.michelinPolicy === 'encouraged')) {
      const lunchMid = (diningConfig.priceRange.lunch[0] + diningConfig.priceRange.lunch[1]) / 2;
      const isMeal = (a: any) => {
        const cat = (a.category || '').toUpperCase();
        return cat === 'DINING' || cat === 'RESTAURANT' || cat === 'FOOD';
      };
      const priceOf = (a: any): number =>
        Number(a.cost_per_person ?? a.price_per_person ?? a.cost?.amount ?? a.estimatedCost?.amount ?? 0);
      const startMins = (a: any): number => {
        const t = String(a.startTime || a.start_time || '');
        const m = t.match(/(\d{1,2}):(\d{2})/);
        if (!m) return 0;
        let h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        if (/pm/i.test(t) && h < 12) h += 12;
        if (/am/i.test(t) && h === 12) h = 0;
        return h * 60 + mm;
      };
      const meals = result.filter(isMeal).sort((a, b) => startMins(a) - startMins(b));
      const lunch = meals.find(a => { const s = startMins(a); return s >= 11 * 60 && s < 16 * 60; });
      const dinner = meals.find(a => startMins(a) >= 18 * 60);
      if (lunch && dinner && priceOf(lunch) > 0 && priceOf(dinner) > 0
          && priceOf(lunch) <= lunchMid && priceOf(dinner) <= lunchMid) {
        (dinner as any).tags = Array.from(new Set([...(dinner.tags || []), 'needs_elevation', 'grand_entrance']));
        (dinner as any).needs_elevation = true;
        console.warn(`[${label}] Day 1 dining tier mismatch: lunch €${priceOf(lunch)} + dinner €${priceOf(dinner)} both ≤ lunch-mid €${lunchMid}. Tagged dinner "${dinner.title}" for elevation.`);
      }

      // Arrival Cultural Anchor check — Day 1 must have ≥2 non-meal experiential beats.
      const experientialCats = new Set(['ATTRACTION', 'CULTURE', 'MUSEUM', 'OUTDOOR', 'ENTERTAINMENT', 'SIGHTSEEING', 'NIGHTLIFE', 'EXPERIENCE']);
      const experientialCount = result.filter(a => experientialCats.has(String(a.category || '').toUpperCase())).length;
      if (experientialCount < 2) {
        (result as any).__missingArrivalAnchor = true;
        console.warn(`[${label}] Day 1 missing Arrival Cultural Anchor: only ${experientialCount} experiential activity(ies). Flagged for repair.`);
      }
    }
  }

  // ── Step 8: Ensure hotel return at end of day (except departure day) ──
  if (dayIndex < totalDays - 1 && result.length > 0) {
    const lastActivity = result[result.length - 1];
    const lastCat = (lastActivity?.category || '').toUpperCase();
    if (lastCat !== 'STAY' && !/return.*hotel|back.*hotel/i.test(lastActivity?.title || '')) {
      result.push({
        title: 'Return to Your Hotel',
        venue_name: 'Your Hotel',
        category: 'STAY',
        start_time: lastActivity?.end_time || lastActivity?.endTime || '10:30 PM',
        startTime: lastActivity?.end_time || lastActivity?.endTime || '22:30',
        cost_per_person: 0,
        cost: { amount: 0, currency: 'USD' },
        description: 'Return to your hotel for a restful night.',
        is_free: true,
        price_per_person: 0,
      });
      console.log(`[QUALITY] Added hotel return at end of Day ${dayIndex + 1}`);
    }
  }

  // ── Step 9: Update used venues for next day ──
  for (const a of result) {
    const candidates = [
      a.location?.name || '',
      a.venue_name || '',
    ];
    for (const raw of candidates) {
      const venue = raw.trim().toLowerCase();
      if (venue && venue !== 'your hotel' && venue.length > 3) {
        usedVenueNames.add(normalizeVenueName(venue) || venue);
      }
    }
  }

  // NOTE: Timing overlap resolution is now handled exclusively by pipeline/repair-day.ts.
  // The cascading overlap fixer was removed from here to prevent stacked timing passes
  // that push activities into pre-dawn hours (the AM/PM timing collapse bug).

  console.log(`[QUALITY] Day ${dayIndex + 1} complete: ${result.length} activities ======\n`);
  return result;
}

/** Convert minutes to HH:MM format */
function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// =============================================================================
// TERMINAL CLEANUP — Run AFTER meal guard to guarantee no placeholders/timing violations
// =============================================================================

export interface TerminalCleanupOptions {
  /** 24h arrival time (Day 1 only), e.g. "13:44" */
  arrivalTime24?: string;
  /** 24h departure time (last day only), e.g. "18:30" */
  departureTime24?: string;
  /** Transport type for departure (train, flight, etc.) — controls buffer */
  departureTransportType?: string;
  /** City name for placeholder replacement context */
  city?: string;
  /** Day number (1-based) */
  dayNumber?: number;
  /** Is this the first day? */
  isFirstDay?: boolean;
  /** Is this the last day? */
  isLastDay?: boolean;
}

/**
 * Terminal cleanup pass — the absolute last line of defense.
 * Runs AFTER any meal guard to guarantee:
 * 1. No placeholder meals survive (uses nuclearPlaceholderSweep)
 * 2. No activities before arrival time (Day 1)
 * 3. No activities after departure buffer (last day)
 * 
 * This function modifies activities IN PLACE and returns the cleaned array.
 */
export function terminalCleanup(
  activities: any[],
  options: TerminalCleanupOptions,
): any[] {
  if (!activities || activities.length === 0) return activities;

  const { arrivalTime24, departureTime24, departureTransportType, city, dayNumber, isFirstDay, isLastDay } = options;
  const label = `TERMINAL_D${dayNumber || '?'}`;
  let removed = 0;

  // ── 1. Nuclear placeholder sweep (zero API, synchronous) ──
  // Uses imports already available at module level
  try {
    const diningConfig = getDiningConfig('Explorer', '');
    const nuclearCount = nuclearPlaceholderSweep(activities, city || '', diningConfig);
    if (nuclearCount > 0) {
      console.warn(`[${label}] Terminal nuclear sweep replaced ${nuclearCount} placeholder(s)`);
    }
  } catch (e) {
    // Fallback: inline placeholder check
    const PLACEHOLDER_RE = /\b(at a |at an |neighborhood caf[eé]|local restaurant|local bistro|a bistro|a brasserie|a trattoria)\b/i;
    for (const act of activities) {
      const cat = (act.category || '').toUpperCase();
      if (cat !== 'DINING' && cat !== 'RESTAURANT') continue;
      const title = act.title || '';
      if (PLACEHOLDER_RE.test(title)) {
        console.error(`[${label}] PLACEHOLDER SURVIVED ALL PASSES: "${title}" — this should never happen`);
      }
    }
  }

  // ── 1b. Deduplicate "Return to Hotel" entries — keep only the LAST one ──
  // Also recategorize mismatched hotel returns so repairBookends sees them correctly
  {
    const hotelReturnRe = /return\s+to\s+(your\s+)?hotel|back\s+to\s+(the\s+)?hotel|hotel\s+return/i;
    const returnIndices: number[] = [];
    for (let i = 0; i < activities.length; i++) {
      const title = (activities[i].title || '').trim();
      if (hotelReturnRe.test(title)) {
        // Recategorize mismatched hotel returns so downstream passes treat them correctly
        const cat = (activities[i].category || '').toLowerCase();
        if (cat !== 'accommodation' && cat !== 'stay') {
          console.log(`[${label}] Recategorized hotel return "${title}" from "${cat}" to "accommodation"`);
          (activities[i] as any).category = 'accommodation';
        }
        returnIndices.push(i);
      }
    }
    if (returnIndices.length > 1) {
      // Keep only the last one, remove earlier duplicates
      const toRemove = new Set(returnIndices.slice(0, -1));
      const before = activities.length;
      const filtered = activities.filter((_, idx) => !toRemove.has(idx));
      activities.length = 0;
      activities.push(...filtered);
      console.warn(`[${label}] Deduped ${before - activities.length} duplicate "Return to Hotel" entries (kept last)`);
      removed += before - activities.length;
    }
  }

  // ── 2. Pre-arrival filter (Day 1) ──
  if (isFirstDay && arrivalTime24) {
    const arrivalMins = parseTimeMins(arrivalTime24);
    if (arrivalMins !== null) {
      // Activities must start after arrival (no buffer here — universalQualityPass already applied 2h buffer)
      const result: any[] = [];
      for (const act of activities) {
        const cat = (act.category || '').toLowerCase();
        // Always keep structural activities
        if (['stay', 'transport', 'flight', 'accommodation', 'logistics'].includes(cat)) {
          result.push(act);
          continue;
        }
        const startStr = act.startTime || act.start_time || '';
        const startMins = parseTimeMins(startStr);
        if (startMins !== null && startMins < arrivalMins) {
          console.warn(`[${label}] Removing pre-arrival activity "${act.title}" at ${startStr} (arrival: ${arrivalTime24})`);
          removed++;
          continue;
        }
        result.push(act);
      }
      activities.length = 0;
      activities.push(...result);
    }
  }

  // ── 3. Post-departure filter (last day) ──
  if (isLastDay && departureTime24) {
    const depMins = parseTimeMins(departureTime24);
    if (depMins !== null) {
      const isTrain = departureTransportType && /train|rail|eurostar|tgv|thalys/i.test(departureTransportType);
      const bufferMins = isTrain ? 120 : 180;
      const latestEnd = depMins - bufferMins;

      // Any departure-bound logistics card (airport transfer, "depart for flight",
      // "head to airport", security/boarding, the flight itself) is a HARD BARRIER.
      // Once the traveler is heading to the airport/station, the only valid
      // follow-ups are more logistics — never a stroll, lunch, museum, etc.
      const DEPARTURE_TITLE_RE = /\b(airport|head\s+to\s+airport|taxi\s+to\s+airport|transfer\s+to\b|depart(?:ure|ing|s|\b)|heading?\s+home|to\s+the\s+(?:airport|station|terminal)|security|boarding|check.?in\s+(?:at\s+)?(?:the\s+)?(?:airport|terminal))\b/i;
      const isDepartureBarrier = (act: any): boolean => {
        const cat = (act.category || '').toLowerCase();
        const t = (act.title || '').toLowerCase();
        if (cat === 'flight') return true;
        if ((cat === 'transport' || cat === 'transit' || cat === 'logistics') &&
            DEPARTURE_TITLE_RE.test(t)) return true;
        return false;
      };
      let departureBarrierStart: number | null = null;
      for (const act of activities) {
        if (isDepartureBarrier(act)) {
          const m = parseTimeMins(act.startTime || act.start_time || '');
          if (m !== null && (departureBarrierStart === null || m < departureBarrierStart)) {
            departureBarrierStart = m;
          }
        }
      }

      if (latestEnd > 0 || departureBarrierStart !== null) {
        const result: any[] = [];
        for (const act of activities) {
          // Always preserve user-locked items — never silently delete them.
          if (act.locked || act.isLocked) { result.push(act); continue; }
          const cat = (act.category || '').toLowerCase();
          // Keep all true logistics categories
          if (['transport', 'transit', 'flight', 'accommodation', 'logistics'].includes(cat)) {
            result.push(act);
            continue;
          }
          const startStr = act.startTime || act.start_time || '';
          const startMins = parseTimeMins(startStr);
          const title = (act.title || '').toLowerCase();
          const isDepartureRelated = /depart|airport|flight|check.?out|heading?\s+home|security|boarding/i.test(title);

          if (startMins !== null) {
            const tooLateForBuffer = latestEnd > 0 && startMins > latestEnd;
            const afterBarrier = departureBarrierStart !== null && startMins >= departureBarrierStart;
            if (tooLateForBuffer || afterBarrier) {
              if (isDepartureRelated) {
                result.push(act);
                continue;
              }
              const reason = afterBarrier
                ? 'after departure barrier (heading to airport/station)'
                : `past departure buffer (departure: ${departureTime24})`;
              console.warn(`[${label}] Removing post-departure activity "${act.title}" at ${startStr} — ${reason}`);
              removed++;
              continue;
            }
          }
          result.push(act);
        }
        activities.length = 0;
        activities.push(...result);
      }
    }
  }

  if (removed > 0) {
    console.log(`[${label}] Terminal cleanup removed ${removed} timing-violating activities`);
  }

  return activities;
}

/** Simple time parser for terminal cleanup */
function parseTimeMins(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + mins;
}

