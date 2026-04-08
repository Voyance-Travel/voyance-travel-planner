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
import { fixPlaceholdersForDay, nuclearPlaceholderSweep } from './fix-placeholders.ts';
import {
  checkAndApplyFreeVenue,
  enforceMarketDiningCap,
  enforceBarNightcapPriceCap,
  enforceCasualVenuePriceCap,
  enforceVenueTypePriceCap,
  enforceTicketedAttractionPricing,
  enforceMichelinPriceFloor,
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
    result = enforceDepartureTiming(result, departureTime);
    console.log(`[QUALITY] After departure filter: ${result.length} activities`);
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

  console.log(`[QUALITY] Day ${dayIndex + 1} complete: ${result.length} activities ======\n`);
  return result;
}

// =============================================================================
// TERMINAL CLEANUP — Run AFTER meal guard to guarantee no placeholders/timing violations
// =============================================================================

export interface TerminalCleanupOptions {
  /** 24h arrival time (Day 1 only), e.g. "13:44" */
  arrivalTime24?: string;
  /** 24h departure time (last day only), e.g. "18:30" */
  departureTime24?: string;
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

  const { arrivalTime24, departureTime24, city, dayNumber, isFirstDay, isLastDay } = options;
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
  {
    const hotelReturnRe = /return\s+to\s+(your\s+)?hotel|back\s+to\s+(the\s+)?hotel|hotel\s+return/i;
    const returnIndices: number[] = [];
    for (let i = 0; i < activities.length; i++) {
      const title = (activities[i].title || '').trim();
      const cat = (activities[i].category || '').toLowerCase();
      if (cat === 'accommodation' && hotelReturnRe.test(title)) {
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
      const latestEnd = depMins - 180; // 3h buffer
      if (latestEnd > 0) {
        const result: any[] = [];
        for (const act of activities) {
          const cat = (act.category || '').toLowerCase();
          if (['transport', 'flight', 'accommodation', 'logistics'].includes(cat)) {
            result.push(act);
            continue;
          }
          const startStr = act.startTime || act.start_time || '';
          const startMins = parseTimeMins(startStr);
          if (startMins !== null && startMins > latestEnd) {
            // Check if it's a departure-related activity (keep those)
            const title = (act.title || '').toLowerCase();
            if (/depart|airport|flight|check.?out/i.test(title)) {
              result.push(act);
              continue;
            }
            console.warn(`[${label}] Removing post-departure activity "${act.title}" at ${startStr} (departure: ${departureTime24})`);
            removed++;
            continue;
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

