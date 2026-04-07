/**
 * Universal Quality Pass — Single orchestrator for all post-generation quality steps.
 *
 * Consolidates 9 scattered enforcement steps into one reusable function:
 * 1. Arrival timing (Day 1 only)
 * 2. Departure timing (Last day only)
 * 3. Fix placeholder meals (AI re-generation)
 * 4. Free venue pricing
 * 5. Market dining cap
 * 6. Universal price caps (bar, casual, venue-type, ticketed, Michelin floor)
 * 7. Cross-day venue dedup
 * 8. Hotel return injection (except departure day)
 * 9. Update used venues set for next day
 */

import { enforceArrivalTiming, enforceDepartureTiming } from './flight-hotel-context.ts';
import { fixPlaceholdersForDay } from './fix-placeholders.ts';
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
import { type DiningConfig } from './dining-config.ts';

// =============================================================================
// OPTIONS INTERFACE
// =============================================================================

export interface UniversalQualityOptions {
  city: string;
  country: string;
  tripType: string;
  dayIndex: number;        // 0-based
  totalDays: number;
  usedVenueNames: Set<string>;
  arrivalTime?: string;    // HH:MM 24h, day 0 only
  departureTime?: string;  // HH:MM 24h, last day only
  dayTitle?: string;
  budgetTier?: string;
  apiKey?: string;
  lockedActivities?: any[];
  usedRestaurants?: string[];
  diningConfig?: DiningConfig;
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
    city, country, tripType, dayIndex, totalDays,
    usedVenueNames, arrivalTime, departureTime,
    dayTitle, budgetTier, apiKey, lockedActivities, usedRestaurants, diningConfig,
  } = options;

  const label = `QUALITY_PASS_D${dayIndex + 1}`;
  console.log(`\n[QUALITY] ====== Day ${dayIndex + 1} of ${totalDays}: ${city}, ${country} (${tripType}) ======`);

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

  // ── Step 3: Fix placeholder meals (AI re-generation) ──
  if (apiKey) {
    await fixPlaceholdersForDay(
      result,
      city,
      country,
      tripType,
      dayIndex,
      usedRestaurants || [],
      budgetTier || 'moderate',
      apiKey,
      lockedActivities || [],
      dayTitle,
      diningConfig,
    );
  }

  // ── Step 4: Free venue pricing ──
  for (const act of result) {
    checkAndApplyFreeVenue(act, label);
  }

  // ── Step 5: Market dining cap ──
  for (const act of result) {
    enforceMarketDiningCap(act, label);
  }

  // ── Step 6: Universal price caps ──
  for (const act of result) {
    enforceBarNightcapPriceCap(act, label);
    enforceCasualVenuePriceCap(act, label);
    enforceVenueTypePriceCap(act, label);
    enforceTicketedAttractionPricing(act, label);
    enforceMichelinPriceFloor(act, label);
  }

  // ── Step 7: Cross-day venue dedup ──
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
