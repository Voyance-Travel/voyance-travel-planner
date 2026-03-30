/**
 * Pipeline: Enrichment + Opening Hours Validation
 *
 * Enriches newly generated activities with Google Maps data (ratings,
 * photos, coordinates) and validates/shifts activities against venue
 * opening hours. Extracted from action-generate-day.ts (Phase 6).
 */

import type { StrictActivity } from '../generation-types.ts';
import { enrichActivityWithRetry } from '../venue-enrichment.ts';
import { parseTimeToMinutes } from '../flight-hotel-context.ts';

// =============================================================================
// Types
// =============================================================================

export interface EnrichDayInput {
  activities: any[];
  destination: string;
  date?: string;
  supabaseUrl: string;
  supabaseKey: string;
  googleMapsApiKey: string;
  lovableApiKey: string;
  hotelCoordinates?: { lat: number; lng: number };
}

// =============================================================================
// Enrichment
// =============================================================================

async function enrichActivities(
  activities: any[],
  destination: string,
  supabaseUrl: string,
  supabaseKey: string,
  googleMapsApiKey: string,
  lovableApiKey: string,
): Promise<any[]> {
  // Only enrich unlocked (newly generated) activities
  const activitiesToEnrich = activities.filter((a: any) => !a.isLocked);
  const alreadyEnriched = activities.filter((a: any) => a.isLocked);

  if (activitiesToEnrich.length === 0 || !googleMapsApiKey) {
    if (!googleMapsApiKey) {
      console.log('[enrich-day] Skipping enrichment: GOOGLE_MAPS_API_KEY not configured');
    }
    return activities;
  }

  console.log(`[enrich-day] Enriching ${activitiesToEnrich.length} new activities with ratings/photos...`);

  // Time budget: cap enrichment so the overall request stays within edge runtime limits.
  const ENRICHMENT_TIME_BUDGET_MS = 25_000;
  const enrichStartedAt = Date.now();

  // Enrich in parallel batches of 3 to avoid rate limits
  const batchSize = 3;
  const enrichedActivities: StrictActivity[] = [];
  let enrichmentBudgetExceeded = false;

  for (let i = 0; i < activitiesToEnrich.length; i += batchSize) {
    // Check time budget before starting next batch
    const elapsed = Date.now() - enrichStartedAt;
    if (elapsed >= ENRICHMENT_TIME_BUDGET_MS) {
      console.warn(`[enrich-day] Enrichment time budget reached (${elapsed}ms). Skipping remaining ${activitiesToEnrich.length - i} activities.`);
      enrichedActivities.push(...activitiesToEnrich.slice(i));
      enrichmentBudgetExceeded = true;
      break;
    }

    const batch = activitiesToEnrich.slice(i, i + batchSize);
    const enrichedBatch = await Promise.all(
      batch.map(async (act: StrictActivity) => {
        try {
          const result = await enrichActivityWithRetry(
            act,
            destination,
            supabaseUrl,
            supabaseKey,
            googleMapsApiKey,
            lovableApiKey,
            1 // maxRetries
          );
          return result.activity;
        } catch (e) {
          console.log(`[enrich-day] Enrichment failed for "${act.title}":`, e);
          return act; // Return original if enrichment fails
        }
      })
    );
    enrichedActivities.push(...enrichedBatch);
  }

  if (enrichmentBudgetExceeded) {
    console.log(`[enrich-day] Enrichment partial: ${enrichedActivities.filter((a: any) => a.rating).length} enriched, rest returned as-is`);
  }

  // Merge enriched activities back with locked ones and sort by time
  const merged = [...enrichedActivities, ...alreadyEnriched];
  merged.sort((a: any, b: any) => {
    const aTime = parseTimeToMinutes(a.startTime || '00:00') ?? 0;
    const bTime = parseTimeToMinutes(b.startTime || '00:00') ?? 0;
    return aTime - bTime;
  });

  const enrichedWithRatings = enrichedActivities.filter((a: any) => a.rating).length;
  console.log(`[enrich-day] Enrichment complete: ${enrichedWithRatings}/${activitiesToEnrich.length} activities got ratings`);

  return merged;
}

// =============================================================================
// Opening Hours Validation
// =============================================================================

async function validateOpeningHours(activities: any[], date: string): Promise<any[]> {
  const dayDate = new Date(date);
  const dayOfWeek = dayDate.getDay();
  const { isVenueOpenOnDay, isVenueClosedAllDay } = await import('../truth-anchors.ts');

  const activitiesToRemove: string[] = [];

  for (const act of activities) {
    if (!act.openingHours || act.openingHours.length === 0) continue;
    const skipCats = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
    if (skipCats.includes(act.category?.toLowerCase() || '')) continue;

    const result = isVenueOpenOnDay(act.openingHours, dayOfWeek, act.startTime);
    if (!result.isOpen) {
      const closedAllDay = isVenueClosedAllDay(act.openingHours, dayOfWeek);
      if (closedAllDay) {
        // Confirmed closed → remove
        console.log(`[enrich-day] ✗ "${act.title}" — REMOVED (confirmed closed all day)`);
        activitiesToRemove.push(act.id);
      } else {
        // Time conflict only → try shifting into venue's open window
        const didFix = tryShiftActivity(act, activities, dayOfWeek, activitiesToRemove, result.reason);
        if (!didFix) {
          // Couldn't parse hours → fall back to warning tag
          console.warn(`[enrich-day] ⚠️ "${act.title}" time conflict (unparseable hours): ${result.reason}`);
          (act as any).closedRisk = true;
          (act as any).closedRiskReason = result.reason;
        }
      }
    }
  }

  if (activitiesToRemove.length > 0) {
    const filtered = activities.filter((a: any) => !activitiesToRemove.includes(a.id));
    console.log(`[enrich-day] Removed ${activitiesToRemove.length} confirmed-closed activities`);
    return filtered;
  }

  return activities;
}

/**
 * Attempt to shift an activity into its venue's open window on the given day.
 * Mutates the activity in-place if successful.
 * Returns true if the activity was handled (shifted or removed), false if unresolved.
 */
function tryShiftActivity(
  act: any,
  allActivities: any[],
  dayOfWeek: number,
  activitiesToRemove: string[],
  _reason: string,
): boolean {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = DAY_NAMES[dayOfWeek];
  const dayEntry = act.openingHours.find((h: string) => h.toLowerCase().startsWith(dayName.toLowerCase()));

  if (!dayEntry || !act.startTime) return false;

  const entryLower = dayEntry.toLowerCase();

  // Parse opening time
  let venueOpenMins = -1;
  let venueCloseMins = -1;
  const timeMatch = entryLower.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (timeMatch) {
    let oh = parseInt(timeMatch[1]);
    const om = parseInt(timeMatch[2]);
    const op = timeMatch[3]?.toUpperCase();
    if (op === 'PM' && oh !== 12) oh += 12;
    if (op === 'AM' && oh === 12) oh = 0;
    venueOpenMins = oh * 60 + om;
  }
  const closeMatch = entryLower.match(/[–\-−to]+\s*(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (closeMatch) {
    let ch = parseInt(closeMatch[1]);
    const cm = parseInt(closeMatch[2]);
    const cp = closeMatch[3]?.toUpperCase();
    if (cp === 'PM' && ch !== 12) ch += 12;
    if (cp === 'AM' && ch === 12) ch = 0;
    venueCloseMins = ch * 60 + cm;
    if (venueCloseMins === 0) venueCloseMins = 1440;
  }

  if (venueOpenMins < 0 || venueCloseMins <= 0) return false;

  const oldMins = parseInt(act.startTime.split(':')[0]) * 60 + parseInt(act.startTime.split(':')[1]);
  const duration = act.endTime
    ? (parseInt(act.endTime.split(':')[0]) * 60 + parseInt(act.endTime.split(':')[1])) - oldMins
    : 60;
  let newStartMins = -1;

  if (oldMins < venueOpenMins) {
    newStartMins = venueOpenMins + 10;
  } else if (oldMins >= venueCloseMins || (oldMins + duration) > venueCloseMins) {
    const latestStart = venueCloseMins - duration - 15;
    if (latestStart >= venueOpenMins + 10) {
      newStartMins = latestStart;
    } else {
      // Duration doesn't fit → remove
      console.log(`[enrich-day] ✗ "${act.title}" — REMOVED (duration ${duration}min doesn't fit in venue hours)`);
      activitiesToRemove.push(act.id);
      return true;
    }
  }

  if (newStartMins >= 0 && newStartMins !== oldMins) {
    // Hard-constraint check: don't shift if it squeezes against checkout/departure
    const dayHasFlightDep = allActivities.some((fa: any) => {
      const ftL = (fa.title || fa.name || '').toLowerCase();
      const fcL = (fa.category || '').toLowerCase();
      return fcL === 'transport' && (ftL.includes('airport') || ftL.includes('flight'));
    });

    const hardStopAct = allActivities.find((ha: any) => {
      const hCat = (ha.category || '').toLowerCase();
      const hTitle = (ha.title || ha.name || '').toLowerCase();
      const isCheckout = hCat === 'accommodation' && (hTitle.includes('check') || hTitle.includes('checkout'));
      if (isCheckout && !dayHasFlightDep) return false;
      return isCheckout
        || (hCat === 'transport' && (hTitle.includes('depart') || hTitle.includes('airport') || hTitle.includes('flight') || hTitle.includes('train')));
    });

    if (hardStopAct && hardStopAct.startTime) {
      const hardStopMins = parseInt(hardStopAct.startTime.split(':')[0]) * 60 + parseInt(hardStopAct.startTime.split(':')[1]);
      const estimatedEnd = newStartMins + duration + 20;
      if (estimatedEnd > hardStopMins) {
        console.log(`[enrich-day] ✗ "${act.title}" — REMOVED (shifted time would exceed hard stop at ${hardStopMins}min)`);
        activitiesToRemove.push(act.id);
        return true;
      }
    }

    if (newStartMins >= 0 && newStartMins !== oldMins) {
      const newST = `${Math.floor(newStartMins / 60).toString().padStart(2, '0')}:${(newStartMins % 60).toString().padStart(2, '0')}`;
      const newEndMins = newStartMins + duration;
      act.startTime = newST;
      if (act.endTime) {
        act.endTime = `${Math.floor(newEndMins / 60).toString().padStart(2, '0')}:${(newEndMins % 60).toString().padStart(2, '0')}`;
      }
      console.log(`[enrich-day] ✓ "${act.title}" shifted to ${newST} (venue hours: ${Math.floor(venueOpenMins / 60).toString().padStart(2, '0')}:${(venueOpenMins % 60).toString().padStart(2, '0')}–${Math.floor(venueCloseMins / 60).toString().padStart(2, '0')}:${(venueCloseMins % 60).toString().padStart(2, '0')})`);
      return true;
    }
  }

  return false;
}

// =============================================================================
// Main function
// =============================================================================

/**
 * Enrich activities with Google Maps data and validate against venue opening hours.
 * Returns the processed activities array.
 */
export async function enrichAndValidateHours(input: EnrichDayInput): Promise<any[]> {
  let activities = input.activities;

  // Step 1: Google Maps enrichment (ratings, photos, coordinates)
  activities = await enrichActivities(
    activities,
    input.destination,
    input.supabaseUrl,
    input.supabaseKey,
    input.googleMapsApiKey,
    input.lovableApiKey,
  );

  // Step 2: Opening hours validation (shift/remove activities at closed venues)
  if (input.date) {
    activities = await validateOpeningHours(activities, input.date);
  }

  return activities;
}
