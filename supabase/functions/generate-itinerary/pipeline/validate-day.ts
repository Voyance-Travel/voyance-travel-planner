/**
 * Pipeline Validator — Structured day validation returning typed ValidationResult[].
 *
 * Phase 3: Pure inspection, no mutations. Classifies every issue by FailureCode.
 * Consumes facts from compile-day-facts and the generated day output.
 */

import { FAILURE_CODES, type ValidationResult, type FailureCode } from './types.ts';
import { extractRestaurantVenueName } from '../generation-utils.ts';
import { isPlaceholderWellness, matchesAIStubVenue } from '../fix-placeholders.ts';
import {
  CHAIN_RESTAURANT_BLOCKLIST,
  isChainRestaurant,
  detectMealSlots,
  type StrictActivityMinimal,
  type StrictDayMinimal,
} from '../day-validation.ts';
import type { RequiredMeal } from '../meal-policy.ts';
import { hasBodyPromptLeak, hasTitleLeak, buildDayScheduleSummary, detectPhantomEventRefs } from '../../_shared/prompt-leak-scrub.ts';
import { WALK_HARD_DISTANCE_METERS, WALK_HARD_DURATION_MINUTES } from '../../_shared/transit-mode.ts';
import { isTransitActivity } from '../../_shared/transit-detect.ts';
import {
  CATEGORY_PRICE_CEILINGS,
  inferSubcategory,
  extractPerPersonPrice,
  shouldSkipPriceSanity,
} from '../_shared/category-price-bounds.ts';

// =============================================================================
// GENERIC VENUE PATTERNS — placeholders the AI sometimes generates
// =============================================================================

const GENERIC_VENUE_PATTERNS = [
  /^local restaurant$/i,
  /^a nice caf[eé]$/i,
  /^nearby restaurant$/i,
  /^local caf[eé]$/i,
  /^a local spot$/i,
  /^restaurant$/i,
  /^cafe$/i,
  /^a restaurant$/i,
  /^dining spot$/i,
  /^dinner spot$/i,
  /^lunch spot$/i,
  /^breakfast spot$/i,
  // "Breakfast in Lisbon", "Lunch in Rome", "Dinner in Tokyo" — city-name-only placeholders
  /^(breakfast|brunch|lunch|dinner|supper)\s+in\s+\S/i,
  // "Breakfast at a local spot" — vague fallback
  /^(breakfast|brunch|lunch|dinner|supper|meal)\s+at\s+(a|an|the)\s+/i,
];

const LABEL_LEAK_PATTERNS = [
  /voyance pick/i,
  /staff pick/i,
  /editor'?s? pick/i,
  /ai pick/i,
  /top pick/i,
  /our pick/i,
];

// =============================================================================
// INPUT TYPES
// =============================================================================

export interface ValidateDayInput {
  /** The generated day to validate */
  day: StrictDayMinimal;
  dayNumber: number;
  isFirstDay: boolean;
  isLastDay: boolean;
  totalDays: number;

  /** Hotel context */
  hasHotel: boolean;
  hotelName?: string;

  /** Flight context */
  arrivalTime24?: string;
  returnDepartureTime24?: string;

  /** Required meals for this day */
  requiredMeals: RequiredMeal[];

  /** Activities from previous days for trip-wide dedup */
  previousDays: StrictDayMinimal[];

  /** User's avoid list and dietary restrictions */
  avoidList?: string[];
  dietaryRestrictions?: string[];

  /** Must-do activities */
  mustDoActivities?: string[];

  /** Hotel change context */
  isHotelChange?: boolean;
  previousHotelName?: string;

  /** Destination city for demonym validation */
  destination?: string;
}

// =============================================================================
// MAIN VALIDATE FUNCTION
// =============================================================================

/**
 * Validate a generated day. Returns ValidationResult[] — pure inspection, no mutations.
 */
export function validateDay(input: ValidateDayInput): ValidationResult[] {
  const results: ValidationResult[] = [];

  const { day, dayNumber, isFirstDay, isLastDay, hasHotel, hotelName,
    arrivalTime24, returnDepartureTime24, requiredMeals, previousDays,
    avoidList, dietaryRestrictions, mustDoActivities,
    isHotelChange, previousHotelName, destination } = input;

  const activities = day.activities || [];

  // --- PHANTOM_HOTEL ---
  checkPhantomHotel(activities, hasHotel, results);

  // --- CHAIN_RESTAURANT ---
  checkChainRestaurants(activities, results);

  // --- GENERIC_VENUE ---
  checkGenericVenues(activities, results, destination);

  // --- GENERIC_WELLNESS (spa/wellness placeholders like "Private Wellness Refresh") ---
  checkGenericWellness(activities, results, destination, hotelName);

  // --- TITLE_LABEL_LEAK ---
  checkLabelLeaks(activities, results);

  // --- CHRONOLOGY ---
  checkChronology(activities, results);

  // --- TIME_OVERLAP ---
  checkTimeOverlap(activities, results);

  // --- MEAL_ORDER ---
  checkMealOrder(activities, results);

  // --- MEAL_MISSING ---
  checkMealMissing(activities, requiredMeals, results);

  // --- MEAL_DUPLICATE ---
  checkMealDuplicate(activities, results);

  // --- LOGISTICS_SEQUENCE (departure day only) ---
  if (isLastDay) {
    checkLogisticsSequence(activities, returnDepartureTime24, results);
    checkDepartureChronology(activities, isLastDay, results);
  }

  // --- DUPLICATE_CONCEPT (trip-wide) ---
  if (previousDays.length > 0) {
    checkDuplicateConcept(activities, previousDays, mustDoActivities || [], results);
  }

  // --- WEAK_PERSONALIZATION ---
  if ((avoidList && avoidList.length > 0) || (dietaryRestrictions && dietaryRestrictions.length > 0)) {
    checkPersonalization(activities, avoidList || [], dietaryRestrictions || [], results);
  }

  // --- PRE-CHECKOUT DINING AT WRONG HOTEL (hotel-change days) ---
  if (isHotelChange && previousHotelName && hotelName) {
    checkPreCheckoutDiningHotel(activities, hotelName, previousHotelName, results);
  }

  // --- WRONG CITY DEMONYM IN DAY TITLE ---
  if (destination) {
    checkWrongCityDemonym(day, destination, results);
  }

  // --- SEMANTIC GATE CHECKS (validation-gate companion) ---
  checkPunctuationOnlyFields(activities, results);
  checkSentenceCompleteness(activities, results);
  checkPriceDuplication(activities, results);
  checkWalkOverThreshold(activities, results);
  checkCategoryVenueCoherence(activities, results);
  checkPhantomEventRefs(activities, results);

  // --- PRICE SANITY (B3, Barcelona Diagnosis) ---
  checkPlausiblePricing(activities, results);

  // --- CROSS-DAY: previous day ended with checkout, this day has hotel-bound activities ---
  if (previousDays.length > 0 && !isFirstDay) {
    checkCrossDayCheckoutHotelLeak(activities, previousDays[previousDays.length - 1], results);
  }

  return results;
}

/**
 * B3 — Per-category price sanity. Flags activities whose per-person price
 * falls outside CATEGORY_PRICE_CEILINGS for their inferred subcategory.
 * Respects Universal Locking, manual edits, and Walking Is Free.
 */
function checkPlausiblePricing(activities: any[], results: ValidationResult[]): void {
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    if (shouldSkipPriceSanity(act)) continue;
    const subcat = inferSubcategory(act);
    if (!subcat) continue;
    const bound = CATEGORY_PRICE_CEILINGS[subcat];
    if (!bound) continue;
    const price = extractPerPersonPrice(act);
    if (price === null) continue;
    if (price < bound.min) {
      const isPaidFloor = bound.min > 0;
      results.push({
        code: FAILURE_CODES.PRICE_TOO_LOW,
        severity: isPaidFloor ? 'error' : 'warning',
        message: `Price $${price}/pp below typical floor $${bound.min} for ${subcat} ("${act.title || act.name || ''}")`,
        activityIndex: i,
        field: 'cost',
        autoRepairable: isPaidFloor,
      });
    } else if (price > bound.max) {
      results.push({
        code: FAILURE_CODES.PRICE_IMPLAUSIBLE,
        severity: 'error',
        message: `Price $${price}/pp exceeds ceiling $${bound.max} for ${subcat} ("${act.title || act.name || ''}") — likely hallucinated or cross-contaminated venue data.`,
        activityIndex: i,
        field: 'cost',
        autoRepairable: true,
      });
    }
  }
}

// =============================================================================
// INDIVIDUAL CHECK FUNCTIONS
// =============================================================================

function parseTime(timeStr: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  if (!period && hours >= 24) return null;
  return hours * 60 + mins;
}

/**
 * Check for phantom hotel references.
 * When no hotel is selected, we ALLOW generic placeholder cards
 * (e.g. "Your Hotel", "Hotel Check-in", "Return to Hotel") but strip
 * cards that reference a specific fabricated hotel name the AI invented.
 */
function checkPhantomHotel(activities: StrictActivityMinimal[], hasHotel: boolean, results: ValidationResult[]): void {
  if (hasHotel) return;

  // Generic hotel titles that are valid placeholders — never strip these
  const GENERIC_HOTEL_PATTERNS = [
    'your hotel', 'hotel check-in', 'hotel checkout', 'check-in at your hotel',
    'checkout from your hotel', 'return to your hotel', 'freshen up at your hotel',
    'return to hotel', 'freshen up at hotel', 'hotel check-in & refresh',
    'settle in', 'check-in & refresh', 'checkout & departure', 'checkout',
    'check-in', 'check in', 'check out', 'check-out',
  ];

  for (let i = 0; i < activities.length; i++) {
    const cat = (activities[i].category || '').toLowerCase();
    if (cat !== 'accommodation') continue;

    const title = (activities[i].title || '').toLowerCase().trim();

    // Allow generic/placeholder accommodation cards
    const isGeneric = GENERIC_HOTEL_PATTERNS.some(p => title.includes(p)) ||
      /^(hotel|your hotel|accommodation)\b/i.test(title);
    if (isGeneric) continue;

    // This is an accommodation card with a specific hotel name the AI fabricated
    results.push({
      code: FAILURE_CODES.PHANTOM_HOTEL,
      severity: 'error',
      message: `Activity "${activities[i].title}" references a specific hotel but none is booked`,
      activityIndex: i,
      field: 'category',
      autoRepairable: true,
    });
  }
}

function checkChainRestaurants(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  for (let i = 0; i < activities.length; i++) {
    const cat = (activities[i].category || '').toLowerCase();
    if (!cat.includes('dining') && !cat.includes('restaurant') && !cat.includes('food')) continue;
    if (isChainRestaurant(activities[i].title)) {
      results.push({
        code: FAILURE_CODES.CHAIN_RESTAURANT,
        severity: 'error',
        message: `"${activities[i].title}" is a chain restaurant`,
        activityIndex: i,
        field: 'title',
        autoRepairable: true,
      });
    }
  }
}

function checkGenericVenues(activities: StrictActivityMinimal[], results: ValidationResult[], destination?: string): void {
  const destLower = (destination || '').toLowerCase().trim();

  for (let i = 0; i < activities.length; i++) {
    const title = activities[i].title || '';
    const cat = (activities[i].category || '').toLowerCase();
    const isDining = cat.includes('dining') || cat.includes('restaurant') || cat.includes('food');

    // Also check venue/location name for placeholder patterns
    const locationName = ((activities[i] as any).location?.name || '').trim().toLowerCase();
    const description = ((activities[i] as any).description || '').toLowerCase();

    // Catch city-name-only venues (e.g., "Paris", "Rome") and placeholder descriptions
    const isCityNameOnly = destLower && locationName === destLower;
    const hasPlaceholderDescription = description.includes('get a restaurant recommendation') ||
      description.includes('ask for recommendations') ||
      description.includes('ask your concierge');

    const hasPlaceholderLocation = locationName === 'the destination' || locationName === '' ||
      isCityNameOnly || hasPlaceholderDescription ||
      /^(a |the )?(local |nearby )?(spot|place|restaurant|caf[eé]|cafe|eatery|bistro|establishment)/i.test(locationName);

    const isAIStub = matchesAIStubVenue(title) || matchesAIStubVenue(locationName);

    if (GENERIC_VENUE_PATTERNS.some(re => re.test(title.trim())) || isAIStub) {
      // Escalate ALL dining generic venues to error (they should trigger repair)
      const shouldEscalate = isDining || isAIStub || /^(breakfast|brunch|lunch|dinner|supper)\s+(in|at)\s+/i.test(title.trim());
      const stubLabel = isAIStub ? ' — AI-generated stub name (e.g. "Café Matinal", "Table du Quartier")' : '';
      results.push({
        code: FAILURE_CODES.GENERIC_VENUE,
        severity: shouldEscalate ? 'error' : 'warning',
        message: `"${title}" is a generic placeholder venue name${shouldEscalate ? ' — meal cards must use real restaurant names' : ''}${stubLabel}`,
        activityIndex: i,
        field: 'title',
        autoRepairable: true,
      });
    } else if (isDining && hasPlaceholderLocation) {
      // Dining activity with a valid-looking title but placeholder location name
      results.push({
        code: FAILURE_CODES.GENERIC_VENUE,
        severity: 'error',
        message: `Dining activity "${title}" has placeholder location "${locationName || '(empty)'}" — must use a real venue name`,
        activityIndex: i,
        field: 'location',
        autoRepairable: true,
      });
    }
  }
}

function checkGenericWellness(
  activities: StrictActivityMinimal[],
  results: ValidationResult[],
  destination?: string,
  hotelName?: string,
): void {
  for (let i = 0; i < activities.length; i++) {
    const a: any = activities[i];
    if (isPlaceholderWellness(a, destination || '', hotelName)) {
      results.push({
        code: FAILURE_CODES.GENERIC_VENUE,
        severity: 'error',
        message: `"${a.title}" is a generic wellness/spa placeholder — must name a real, bookable venue`,
        activityIndex: i,
        field: 'title',
        autoRepairable: true,
      });
    }
  }
}

function checkLabelLeaks(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  for (let i = 0; i < activities.length; i++) {
    const title = activities[i].title || '';
    if (LABEL_LEAK_PATTERNS.some(re => re.test(title))) {
      results.push({
        code: FAILURE_CODES.TITLE_LABEL_LEAK,
        severity: 'warning',
        message: `"${title}" contains an internal label that should not be user-facing`,
        activityIndex: i,
        field: 'title',
        autoRepairable: true,
      });
    }
    // Body-field prompt-leak (Reservation Urgency: ., Booking Window: ., etc.)
    const bodyHit = hasBodyPromptLeak(activities[i] as any);
    if (bodyHit) {
      results.push({
        code: FAILURE_CODES.TITLE_LABEL_LEAK,
        severity: 'warning',
        message: `Activity "${title}" has prompt-template label leak in ${bodyHit.field}`,
        activityIndex: i,
        field: bodyHit.field,
        autoRepairable: true,
      });
    }
    // Title-side prompt-leak (Reservation Urgency: . in title/name/subtitle/reservationUrgency)
    const titleHit = hasTitleLeak(activities[i] as any);
    if (titleHit) {
      results.push({
        code: FAILURE_CODES.TITLE_LABEL_LEAK,
        severity: 'warning',
        message: `Activity "${title}" has prompt-template label leak in ${titleHit.field}`,
        activityIndex: i,
        field: titleHit.field,
        autoRepairable: true,
      });
    }
  }
}

function checkChronology(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  let prevMins: number | null = null;
  for (let i = 0; i < activities.length; i++) {
    const mins = parseTime(activities[i].startTime);
    if (mins === null) continue;
    if (prevMins !== null && mins < prevMins) {
      results.push({
        code: FAILURE_CODES.CHRONOLOGY,
        severity: 'error',
        message: `Activity "${activities[i].title}" at ${activities[i].startTime} is before the previous activity ending`,
        activityIndex: i,
        field: 'startTime',
        autoRepairable: true,
      });
    }
    prevMins = parseTime(activities[i].endTime) ?? mins;
  }
}

function checkTimeOverlap(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  for (let i = 1; i < activities.length; i++) {
    const prevEnd = parseTime(activities[i - 1].endTime);
    const currStart = parseTime(activities[i].startTime);
    if (prevEnd !== null && currStart !== null && currStart < prevEnd) {
      // Allow small overlaps for transport cards (≤5 min)
      if (prevEnd - currStart <= 5) continue;
      results.push({
        code: FAILURE_CODES.TIME_OVERLAP,
        severity: 'warning',
        message: `"${activities[i].title}" overlaps with "${activities[i - 1].title}" by ${prevEnd - currStart} minutes`,
        activityIndex: i,
        field: 'startTime',
        autoRepairable: true,
      });
    }
  }
}

function checkMealOrder(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  for (let i = 0; i < activities.length; i++) {
    const title = (activities[i].title || '').toLowerCase();
    const cat = (activities[i].category || '').toLowerCase();
    const startMins = parseTime(activities[i].startTime);
    if (startMins === null) continue;

    const isDining = cat.includes('dining') || cat.includes('restaurant') || cat.includes('food');
    if (!isDining) continue;

    // Breakfast after 14:00
    if ((title.includes('breakfast') || title.includes('brunch')) && startMins > 14 * 60) {
      results.push({
        code: FAILURE_CODES.MEAL_ORDER,
        severity: 'error',
        message: `Breakfast "${activities[i].title}" scheduled at ${activities[i].startTime} (after 14:00)`,
        activityIndex: i,
        field: 'startTime',
        autoRepairable: true,
      });
    }

    // Lunch before 11:00 → should be breakfast
    if (title.includes('lunch') && startMins < 11 * 60) {
      results.push({
        code: FAILURE_CODES.MEAL_ORDER,
        severity: 'error',
        message: `Lunch "${activities[i].title}" scheduled at ${activities[i].startTime} (before 11:00 — should be breakfast)`,
        activityIndex: i,
        field: 'startTime',
        autoRepairable: true,
      });
    }

    // Lunch after 17:00
    if (title.includes('lunch') && startMins > 17 * 60) {
      results.push({
        code: FAILURE_CODES.MEAL_ORDER,
        severity: 'error',
        message: `Lunch "${activities[i].title}" scheduled at ${activities[i].startTime} (after 17:00)`,
        activityIndex: i,
        field: 'startTime',
        autoRepairable: true,
      });
    }

    // Dinner before 15:00 → should be lunch or breakfast
    if ((title.includes('dinner') || title.includes('supper')) && startMins < 15 * 60) {
      results.push({
        code: FAILURE_CODES.MEAL_ORDER,
        severity: 'error',
        message: `Dinner "${activities[i].title}" scheduled at ${activities[i].startTime} (before 15:00 — wrong meal label)`,
        activityIndex: i,
        field: 'startTime',
        autoRepairable: true,
      });
    }
  }
}

function checkMealMissing(activities: StrictActivityMinimal[], requiredMeals: RequiredMeal[], results: ValidationResult[]): void {
  if (requiredMeals.length === 0) return;
  const detected = detectMealSlots(activities);
  for (const meal of requiredMeals) {
    if (!detected.includes(meal)) {
      results.push({
        code: FAILURE_CODES.MEAL_MISSING,
        severity: 'error',
        message: `Required meal "${meal}" is not present in the day`,
        autoRepairable: true,
      });
    }
  }
}

function checkMealDuplicate(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  const MEAL_KEYWORDS: Record<string, string[]> = {
    breakfast: ['breakfast', 'brunch'],
    lunch: ['lunch'],
    dinner: ['dinner', 'supper'],
  };

  // Check for back-to-back same-meal duplicates
  for (let i = 1; i < activities.length; i++) {
    const prevTitle = (activities[i - 1].title || '').toLowerCase();
    const currTitle = (activities[i].title || '').toLowerCase();
    const prevCat = (activities[i - 1].category || '').toLowerCase();
    const currCat = (activities[i].category || '').toLowerCase();

    if (!currCat.includes('dining') && !prevCat.includes('dining')) continue;

    for (const [meal, keywords] of Object.entries(MEAL_KEYWORDS)) {
      const prevIs = keywords.some(kw => prevTitle.includes(kw));
      const currIs = keywords.some(kw => currTitle.includes(kw));
      if (prevIs && currIs) {
        results.push({
          code: FAILURE_CODES.MEAL_DUPLICATE,
          severity: 'error',
          message: `Back-to-back ${meal} activities: "${activities[i - 1].title}" and "${activities[i].title}"`,
          activityIndex: i,
          autoRepairable: true,
        });
      }
    }
  }

  // Check for non-adjacent same-meal duplicates (e.g. two dinners at different times)
  const mealIndices: Record<string, number[]> = { breakfast: [], lunch: [], dinner: [] };
  for (let i = 0; i < activities.length; i++) {
    const title = (activities[i].title || '').toLowerCase();
    const cat = (activities[i].category || '').toLowerCase();
    if (!cat.includes('dining') && !cat.includes('food') && !cat.includes('restaurant')) continue;

    for (const [meal, keywords] of Object.entries(MEAL_KEYWORDS)) {
      if (keywords.some(kw => title.includes(kw))) {
        mealIndices[meal].push(i);
      }
    }
  }

  for (const [meal, indices] of Object.entries(mealIndices)) {
    if (indices.length > 1) {
      // Already reported back-to-back above; report non-adjacent duplicates
      for (let j = 1; j < indices.length; j++) {
        const alreadyReported = indices[j] - indices[j - 1] === 1; // already caught by back-to-back check
        if (!alreadyReported) {
          results.push({
            code: FAILURE_CODES.MEAL_DUPLICATE,
            severity: 'error',
            message: `Duplicate ${meal}: "${activities[indices[0]].title}" and "${activities[indices[j]].title}"`,
            activityIndex: indices[j],
            autoRepairable: true,
          });
        }
      }
    }
  }
}

/**
 * NEW.3 — Post-checkout chronology validator.
 * Mirrors `_shared/post-checkout-prune.ts::pruneNonLogisticsAfterCheckout` and
 * repair-day §14b. Emits LOGISTICS_SEQUENCE so the existing repair + save-time
 * sweep handle it, while giving telemetry/health-score visibility upstream.
 */
function checkDepartureChronology(activities: StrictActivityMinimal[], isLastDay: boolean, results: ValidationResult[]): void {
  if (!isLastDay || !Array.isArray(activities) || activities.length < 2) return;

  // Find the LAST checkout row (accommodation + checkout title)
  let checkoutIdx = -1;
  for (let i = activities.length - 1; i >= 0; i--) {
    const a: any = activities[i];
    const t = String(a?.title || a?.name || '').toLowerCase();
    const cat = String(a?.category || '').toLowerCase();
    if (cat === 'accommodation' && /check[\s-]?out|checkout/.test(t)) {
      checkoutIdx = i;
      break;
    }
  }
  if (checkoutIdx === -1) return;

  for (let i = checkoutIdx + 1; i < activities.length; i++) {
    const a: any = activities[i];
    // Universal locking — skip locked/user/manual/extracted/pinned rows
    if (a?.isLocked || a?.userAdded || a?.userEdited || a?.extracted || a?.pinned || a?.isManual) continue;

    const title = String(a?.title || a?.name || '').toLowerCase();
    const cat = String(a?.category || '').toLowerCase();
    const isDepartureLogistics =
      /airport|station|terminal|departure|flight|train|return\s+home|heading\s+home/i.test(title) ||
      cat === 'transport' || cat === 'transit' || cat === 'logistics' || cat === 'flight';

    if (!isDepartureLogistics) {
      results.push({
        code: FAILURE_CODES.LOGISTICS_SEQUENCE,
        severity: 'critical',
        message: `Activity "${a?.title || a?.name}" is scheduled after final checkout — should be removed or moved before checkout`,
        activityIndex: i,
        field: 'startTime',
        autoRepairable: true,
      });
    }
  }
}

function checkLogisticsSequence(activities: StrictActivityMinimal[], depTime24: string | undefined, results: ValidationResult[]): void {
  type DvRole = 'breakfast' | 'checkout' | 'airport-transport' | 'airport-security' | 'flight' | 'other';

  const classify = (a: StrictActivityMinimal): DvRole => {
    const t = (a.title || '').toLowerCase();
    const cat = (a.category || '').toLowerCase();

    if (cat === 'flight' || t.includes('flight departure') || t.includes('departure flight')) return 'flight';
    if (t.includes('airport departure') || t.includes('airport security') || t.includes('security and boarding')) return 'airport-security';
    if ((cat === 'transport' || cat === 'transit') && (t.includes('airport') || t.includes('head to airport'))) return 'airport-transport';
    if (t.includes('checkout') || t.includes('check-out') || t.includes('check out')) return 'checkout';
    if ((cat === 'dining' || cat === 'restaurant' || cat === 'food') && (t.includes('breakfast') || t.includes('morning meal'))) return 'breakfast';
    return 'other';
  };

  const roles = activities.map((a, i) => ({ act: a, role: classify(a), idx: i }));
  const breakfast = roles.find(r => r.role === 'breakfast');
  const checkout = roles.find(r => r.role === 'checkout');
  const security = roles.find(r => r.role === 'airport-security');
  const flight = roles.find(r => r.role === 'flight');

  // R1: Breakfast must be before checkout
  if (breakfast && checkout && breakfast.idx > checkout.idx) {
    results.push({
      code: FAILURE_CODES.LOGISTICS_SEQUENCE,
      severity: 'error',
      message: 'Breakfast is scheduled after checkout',
      activityIndex: breakfast.idx,
      autoRepairable: true,
    });
  }

  // R2: Security must be immediately before flight
  if (security && flight && security.idx !== flight.idx - 1) {
    results.push({
      code: FAILURE_CODES.LOGISTICS_SEQUENCE,
      severity: 'error',
      message: 'Airport security is not immediately before flight',
      activityIndex: security.idx,
      autoRepairable: true,
    });
  }

  // R3: No non-transport activities after security
  if (security) {
    for (let i = security.idx + 1; i < activities.length; i++) {
      const role = classify(activities[i]);
      if (role !== 'flight' && role !== 'airport-transport' && role !== 'airport-security') {
        results.push({
          code: FAILURE_CODES.LOGISTICS_SEQUENCE,
          severity: 'error',
          message: `"${activities[i].title}" is scheduled after airport security`,
          activityIndex: i,
          autoRepairable: true,
        });
      }
    }
  }

  // R3b: No non-departure activities after airport transport
  // (covers the common case where there's no explicit "security" card)
  const airportTransport = roles.find(r => r.role === 'airport-transport');
  if (airportTransport && (!security || airportTransport.idx < security.idx)) {
    for (let i = airportTransport.idx + 1; i < activities.length; i++) {
      const role = classify(activities[i]);
      if (role === 'flight' || role === 'airport-transport' || role === 'airport-security') continue;
      results.push({
        code: FAILURE_CODES.LOGISTICS_SEQUENCE,
        severity: 'error',
        message: `"${activities[i].title}" is scheduled after the airport transfer`,
        activityIndex: i,
        autoRepairable: true,
      });
    }
  }

  // R4: Multiple airport transports
  const transports = roles.filter(r => r.role === 'airport-transport');
  if (transports.length > 1) {
    for (let i = 0; i < transports.length - 1; i++) {
      results.push({
        code: FAILURE_CODES.LOGISTICS_SEQUENCE,
        severity: 'warning',
        message: `Duplicate airport transport: "${transports[i].act.title}"`,
        activityIndex: transports[i].idx,
        autoRepairable: true,
      });
    }
  }

  // R5: Departure transport must have explicit startTime AND endTime
  // (catches "Transfer to Airport" rows the model emits without timing).
  const isValidHHMM = (s: any) => typeof s === 'string' && /^\d{1,2}:\d{2}$/.test(s);
  for (const t of transports) {
    const a: any = t.act;
    if (!isValidHHMM(a?.startTime) || !isValidHHMM(a?.endTime)) {
      results.push({
        code: FAILURE_CODES.DEPARTURE_TRANSPORT_UNTIMED,
        severity: 'error',
        message: `Departure transport "${a?.title}" is missing startTime/endTime`,
        activityIndex: t.idx,
        autoRepairable: true,
      });
    }
  }
}

function normalizeText(input: string): string {
  return (input || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const STRIP_VERBS_RE = /\b(guided|visit|explore|discover|tour|walk|stroll|head|go|return|morning|afternoon|evening|a|an|the|to|of|at|in|on|and|with|for)\b/g;

function conceptSimilarity(a: string, b: string): boolean {
  if (!a || !b || a.length < 5 || b.length < 5) return false;
  if (a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;

  const aVenue = a.replace(STRIP_VERBS_RE, '').replace(/\s+/g, ' ').trim();
  const bVenue = b.replace(STRIP_VERBS_RE, '').replace(/\s+/g, ' ').trim();
  if (aVenue.length > 5 && bVenue.length > 5 && (aVenue.includes(bVenue) || bVenue.includes(aVenue))) return true;

  const aWords = new Set(a.split(/\s+/));
  const bWords = new Set(b.split(/\s+/));
  const intersection = [...aWords].filter(w => bWords.has(w) && w.length > 3);
  const minLen = Math.min(aWords.size, bWords.size);
  return minLen > 0 && intersection.length / minLen > 0.6;
}

function extractConcept(title: string): string {
  const normalized = normalizeText(title);

  // For dining titles ("Breakfast at X", "Dinner at X"), the concept
  // is the VENUE (after "at"), not the meal keyword (before "at")
  const mealAtVenue = normalized.match(
    /^(?:breakfast|brunch|lunch|dinner|supper)\s+(?:at|@)\s+(.+)/i
  );
  if (mealAtVenue && mealAtVenue[1].trim().length > 2) {
    return mealAtVenue[1].trim();
  }

  const conceptPart = normalized.split(/\s+at\s+|\s+with\s+|\s+@\s+|\s+in\s+/i)[0];
  return conceptPart
    .replace(/\b(class|tour|experience|visit|workshop|session|lesson|masterclass)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function checkDuplicateConcept(
  activities: StrictActivityMinimal[],
  previousDays: StrictDayMinimal[],
  mustDoActivities: string[],
  results: ValidationResult[]
): void {
  const previousConcepts = new Set<string>();
  const previousLocations = new Set<string>();
  const previousDiningVenues = new Set<string>();

  for (const prevDay of previousDays) {
    for (const prevAct of prevDay.activities || []) {
      const concept = extractConcept(normalizeText(prevAct.title || ''));
      if (concept.length > 3) previousConcepts.add(concept);
      const locName = normalizeText(prevAct.location?.name || '');
      if (locName.length > 5) previousLocations.add(locName);

      // Build dining venue set for precise restaurant dedup
      if ((prevAct.category || '').toLowerCase().includes('dining')) {
        const venue = extractRestaurantVenueName(prevAct.title || '');
        if (venue.length > 2) previousDiningVenues.add(venue);
        const locVenue = extractRestaurantVenueName(prevAct.location?.name || '');
        if (locVenue.length > 2) previousDiningVenues.add(locVenue);
      }
    }
  }

  const mustDoSet = new Set(mustDoActivities.map(s => s.toLowerCase()));

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const cat = (act.category || '').toLowerCase();
    if (cat === 'transport' || cat === 'accommodation') continue;

    // Skip must-do activities
    const actTitleLower = (act.title || '').toLowerCase();
    if (mustDoSet.has(actTitleLower)) continue;

    const actConcept = extractConcept(normalizeText(act.title || ''));
    const actLocName = normalizeText(act.location?.name || '');

    // Short-name exact match guard (1-2 word venues like "Belcanto", "Skinlife Wellness")
    const actConceptWords = actConcept.split(/\s+/).filter(Boolean);
    if (actConceptWords.length <= 2 && actConcept.length >= 4) {
      const isExactDup = previousConcepts.has(actConcept) ||
        (cat.includes('dining') && previousDiningVenues.has(actConcept));
      if (isExactDup) {
        results.push({
          code: FAILURE_CODES.DUPLICATE_CONCEPT,
          severity: 'error',
          message: `"${act.title}" exactly matches a venue from a previous day`,
          activityIndex: i,
          autoRepairable: true,
        });
        continue;
      }
    }

    // Dining venue dedup — precise identity check using normalized venue names
    if (cat.includes('dining')) {
      const venueFromTitle = extractRestaurantVenueName(act.title || '');
      const venueFromLoc = extractRestaurantVenueName(act.location?.name || '');
      if ((venueFromTitle.length > 2 && previousDiningVenues.has(venueFromTitle)) ||
          (venueFromLoc.length > 2 && previousDiningVenues.has(venueFromLoc))) {
        results.push({
          code: FAILURE_CODES.DUPLICATE_CONCEPT,
          severity: 'error',
          message: `"${act.title}" repeats a restaurant from a previous day`,
          activityIndex: i,
          autoRepairable: true,
        });
        continue;
      }
    }

    // Location dedup
    if (actLocName.length > 5 && previousLocations.has(actLocName)) {
      results.push({
        code: FAILURE_CODES.DUPLICATE_CONCEPT,
        severity: 'error',
        message: `"${act.title}" visits the same location as a previous day`,
        activityIndex: i,
        autoRepairable: true,
      });
      continue;
    }

    // Concept dedup
    for (const prevConcept of previousConcepts) {
      if (conceptSimilarity(actConcept, prevConcept)) {
        const isDining = cat.includes('dining');
        results.push({
          code: FAILURE_CODES.DUPLICATE_CONCEPT,
          severity: isDining ? 'error' : 'error',
          message: `"${act.title}" is too similar to a previous day's activity`,
          activityIndex: i,
          autoRepairable: true,
        });
        break;
      }
    }
  }
}

function checkPersonalization(
  activities: StrictActivityMinimal[],
  avoidList: string[],
  dietaryRestrictions: string[],
  results: ValidationResult[]
): void {
  const avoidLower = avoidList.map(s => s.toLowerCase());
  const dietaryLower = dietaryRestrictions.map(s => s.toLowerCase());

  for (let i = 0; i < activities.length; i++) {
    const title = (activities[i].title || '').toLowerCase();
    const desc = (activities[i].description || '').toLowerCase();
    const cat = (activities[i].category || '').toLowerCase();

    // Check avoid list
    for (const avoid of avoidLower) {
      if (avoid.length < 3) continue;
      if (title.includes(avoid) || desc.includes(avoid)) {
        results.push({
          code: FAILURE_CODES.WEAK_PERSONALIZATION,
          severity: 'error',
          message: `"${activities[i].title}" matches avoid-list item "${avoid}"`,
          activityIndex: i,
          autoRepairable: true,
        });
        break;
      }
    }

    // Check dietary restrictions on dining activities
    if (cat.includes('dining') || cat.includes('restaurant') || cat.includes('food')) {
      for (const restriction of dietaryLower) {
        if (restriction.length < 3) continue;
        // Check if a non-compliant food type appears
        if (title.includes(restriction) || desc.includes(restriction)) {
          results.push({
            code: FAILURE_CODES.WEAK_PERSONALIZATION,
            severity: 'warning',
            message: `"${activities[i].title}" may conflict with dietary restriction "${restriction}"`,
            activityIndex: i,
            autoRepairable: false,
          });
        }
      }
    }
  }
}

// =============================================================================
// PRE-CHECKOUT DINING AT WRONG HOTEL (hotel-change days)
// =============================================================================

function checkPreCheckoutDiningHotel(
  activities: StrictActivityMinimal[],
  newHotelName: string,
  previousHotelName: string,
  results: ValidationResult[],
): void {
  // Find checkout index
  const checkoutIdx = activities.findIndex((a) => {
    const t = (a.title || '').toLowerCase();
    const c = (a.category || '').toLowerCase();
    return c === 'accommodation' &&
      (t.includes('checkout') || t.includes('check-out') || t.includes('check out'));
  });
  if (checkoutIdx < 0) return;

  const newHotelLower = newHotelName.toLowerCase();
  // Extract core name (e.g. "Palácio Ludovice" from "Hotel Palácio Ludovice")
  const newHotelCore = newHotelLower.replace(/^(hotel|the)\s+/i, '').trim();

  for (let i = 0; i < checkoutIdx; i++) {
    const act = activities[i];
    const cat = (act.category || '').toLowerCase();
    const titleLower = (act.title || '').toLowerCase();
    const isDining = cat === 'dining' || cat === 'restaurant' || cat === 'food' || cat === 'meal'
      || /\b(?:breakfast|brunch)\b/i.test(titleLower);
    if (!isDining) continue;

    const locName = (act.location?.name || '').toLowerCase();
    const refsNewHotel = titleLower.includes(newHotelLower) ||
      (newHotelCore.length >= 3 && titleLower.includes(newHotelCore)) ||
      locName.includes(newHotelLower) ||
      (newHotelCore.length >= 3 && locName.includes(newHotelCore));

    if (refsNewHotel) {
      results.push({
        code: FAILURE_CODES.LOGISTICS_SEQUENCE,
        severity: 'error',
        message: `Pre-checkout dining "${act.title}" references the new hotel "${newHotelName}" — should reference "${previousHotelName}"`,
        activityIndex: i,
        field: 'title',
        autoRepairable: true,
      });
    }
  }
}

// =============================================================================
// WRONG CITY DEMONYM — catches AI hallucinating wrong city references in titles
// =============================================================================

const CITY_DEMONYMS: Record<string, string[]> = {
  'paris': ['parisian', 'parisien', 'parisienne'],
  'rome': ['roman', 'romano', 'romana'],
  'berlin': ['berliner', 'berlinian'],
  'vienna': ['viennese', 'wiener'],
  'london': ['londoner', 'london-based'],
  'madrid': ['madrileño', 'madrilenian', 'madrileñan'],
  'barcelona': ['barcelonan', 'barcelonese'],
  'lisbon': ['lisboan', 'lisboeta'],
  'prague': ['prague-based', 'praguian'],
  'amsterdam': ['amsterdammer'],
  'tokyo': ['tokyoite'],
  'new york': ['new yorker', 'new york-style'],
  'florence': ['florentine'],
  'venice': ['venetian'],
  'naples': ['neapolitan'],
  'milan': ['milanese'],
  'istanbul': ['istanbulite'],
  'budapest': ['budapestian'],
  'athens': ['athenian'],
  'munich': ['municher', 'münchner'],
};

function checkWrongCityDemonym(
  day: StrictDayMinimal,
  destination: string,
  results: ValidationResult[],
): void {
  const dayTitle = (day as any).theme || (day as any).title || (day as any).dayTitle || '';
  if (!dayTitle) return;

  const destLower = destination.toLowerCase().trim();
  const titleLower = dayTitle.toLowerCase();

  // Build set of demonyms that SHOULD NOT appear (all cities except destination)
  for (const [city, demonyms] of Object.entries(CITY_DEMONYMS)) {
    // Skip if destination matches this city
    if (destLower.includes(city) || city.includes(destLower)) continue;

    for (const demonym of demonyms) {
      if (titleLower.includes(demonym)) {
        results.push({
          code: FAILURE_CODES.TITLE_LABEL_LEAK,
          severity: 'warning',
          message: `Day title "${dayTitle}" contains "${demonym}" which refers to ${city}, not ${destination}`,
          field: 'theme',
          autoRepairable: true,
        });
        return; // One warning per day is enough
      }
    }
  }
}

// =============================================================================
// SEMANTIC GATE CHECKS — 4 new pure inspectors for the validation gate
// =============================================================================

const PUNCT_ONLY_RE = /^\s*[.\-:,;·•…]+\s*$/;
/** Fields whose value should never be just punctuation. */
const SCALAR_TEXT_FIELDS = [
  'title', 'name', 'description', 'tips', 'notes',
  'reservationUrgency', 'bookingWindow', 'leadTime', 'bookingUrgency',
  'subtitle', 'summary', 'whyItFits',
] as const;

function checkPunctuationOnlyFields(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  activities.forEach((act, i) => {
    for (const field of SCALAR_TEXT_FIELDS) {
      const v = (act as any)?.[field];
      if (typeof v === 'string' && v.length > 0 && PUNCT_ONLY_RE.test(v)) {
        results.push({
          code: FAILURE_CODES.PUNCTUATION_ONLY_FIELD,
          severity: 'critical',
          message: `Activity "${act.title}" has punctuation-only ${field}: ${JSON.stringify(v)}`,
          activityIndex: i,
          field,
          autoRepairable: true,
        });
      }
    }
  });
}

const SENTENCE_END_RE = /[.!?…)"'’”\]]\s*$/;
const BULLET_RE = /^\s*[-•*]/m;

function checkSentenceCompleteness(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  activities.forEach((act, i) => {
    for (const field of ['description', 'tips', 'notes'] as const) {
      const raw = (act as any)?.[field];
      if (typeof raw !== 'string') continue;
      const v = raw.trim();
      if (v.length < 40) continue;
      if (BULLET_RE.test(v)) continue; // skip bullet lists
      if (SENTENCE_END_RE.test(v)) continue;
      // Last 80 chars for log preview
      const tail = v.slice(-80);
      results.push({
        code: FAILURE_CODES.TRUNCATED_SENTENCE,
        severity: 'critical',
        message: `Activity "${act.title}" ${field} appears truncated mid-sentence: "…${tail}"`,
        activityIndex: i,
        field,
        autoRepairable: true,
      });
    }
  });
}

function getActivityCostAmount(act: any): number | null {
  const c = act?.cost ?? act?.estimatedCost;
  if (!c || typeof c !== 'object') return null;
  const amt = Number(c.amount);
  return Number.isFinite(amt) && amt > 0 ? amt : null;
}

function checkPriceDuplication(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  for (let i = 1; i < activities.length; i++) {
    const prev = activities[i - 1] as any;
    const curr = activities[i] as any;
    const prevAmt = getActivityCostAmount(prev);
    const currAmt = getActivityCostAmount(curr);
    if (prevAmt === null || currAmt === null || prevAmt !== currAmt) continue;
    const prevCur = prev?.cost?.currency || prev?.estimatedCost?.currency;
    const currCur = curr?.cost?.currency || curr?.estimatedCost?.currency;
    if (prevCur !== currCur) continue;
    const prevCat = String(prev?.category || '').toLowerCase();
    const currCat = String(curr?.category || '').toLowerCase();
    if (!prevCat || prevCat !== currCat) continue;
    // Skip deterministic overrides
    const prevSrc = String(prev?.cost?.source || prev?.cost?.basis || '');
    const currSrc = String(curr?.cost?.source || curr?.cost?.basis || '');
    if (/bar_cap_repair|fine_dining_floor|user|user_override|booked/i.test(prevSrc + currSrc)) continue;
    results.push({
      code: FAILURE_CODES.SUSPICIOUS_DUPLICATE_PRICE,
      severity: 'critical',
      message: `Adjacent activities "${prev.title}" and "${curr.title}" have identical ${prevCur} ${prevAmt} cost (same category "${prevCat}")`,
      activityIndex: i,
      field: 'cost.amount',
      autoRepairable: true,
    });
  }
}

/**
 * WALK_OVER_THRESHOLD — any transit card with method=walk/walking that
 * exceeds 30 min OR 1500 m. Critical so validation-gate fires even if
 * repair-day is bypassed.
 */
function checkWalkOverThreshold(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i] as any;
    if (!isTransitActivity(act)) continue;
    const t = act?.transportation || {};
    const method = String(t.method || '').toLowerCase().trim();
    // Title fallback — mirrors sanitizer's `titleStartsWalk` so a "Walk to X" card
    // with empty/missing transportation.method (recurring LLM omission) still
    // gets evaluated. Without this, the method gate silently bypassed e.g.
    // "Walk to DiverXO" (Madrid Day 1, ~3.5km / 1h27m).
    const titleStartsWalk = /^\s*(?:walk|walking|stroll)\b/i.test(act.title || act.name || '');
    const isWalkLike = method === 'walk' || method === 'walking' || (method === '' && titleStartsWalk);
    if (!isWalkLike) continue;
    let dur = Number(t.durationMinutes);
    let dist = Number(t.distanceMeters);
    // Parse string durations like "1h 6m", "66 min", "1:06" — try transport
    // block first, then top-level duration fields the LLM sometimes uses.
    if (!Number.isFinite(dur) || dur <= 0) {
      const durStr = String(
        t.duration || act.durationMinutes || act.duration_minutes || act.duration || act.durationLabel || ''
      );
      const numericDur = Number(durStr);
      if (Number.isFinite(numericDur) && numericDur > 0) {
        dur = numericDur;
      } else {
        const hMatch = durStr.match(/(\d+)\s*h/i);
        const mMatch = durStr.match(/(\d+)\s*m/i);
        const colonMatch = durStr.match(/^(\d+):(\d+)$/);
        if (hMatch || mMatch) {
          dur = (hMatch ? parseInt(hMatch[1]) * 60 : 0) + (mMatch ? parseInt(mMatch[1]) : 0);
        } else if (colonMatch) {
          dur = parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
        }
      }
    }
    // If still no duration, infer from start/end timestamps
    if (!Number.isFinite(dur) || dur <= 0) {
      const startMatch = String(act.startTime || '').match(/(\d{1,2}):(\d{2})/);
      const endMatch = String(act.endTime || '').match(/(\d{1,2}):(\d{2})/);
      if (startMatch && endMatch) {
        const startMin = parseInt(startMatch[1]) * 60 + parseInt(startMatch[2]);
        const endMin = parseInt(endMatch[1]) * 60 + parseInt(endMatch[2]);
        if (endMin > startMin) dur = endMin - startMin;
      }
    }
    if (!Number.isFinite(dist) || dist < 0) dist = 0;
    // Both unknown — can't evaluate. Default to NOT firing (conservative).
    if ((!Number.isFinite(dur) || dur <= 0) && dist <= 0) continue;
    if (dur <= WALK_HARD_DURATION_MINUTES && dist <= WALK_HARD_DISTANCE_METERS) continue;
    results.push({
      code: FAILURE_CODES.WALK_OVER_THRESHOLD,
      severity: 'critical',
      message: `Transit "${act.title}" is walk for ${dur}min / ${dist}m — exceeds ${WALK_HARD_DURATION_MINUTES}min/${WALK_HARD_DISTANCE_METERS}m threshold`,
      activityIndex: i,
      field: 'transportation',
      autoRepairable: true,
    });
  }
}
let _fineDiningMap: Record<string, number> | null = null;
async function getFineDiningMap(): Promise<Record<string, number>> {
  if (_fineDiningMap) return _fineDiningMap;
  try {
    const mod = await import('../sanitization.ts');
    _fineDiningMap = (mod as any).KNOWN_FINE_DINING_STARS || {};
  } catch {
    _fineDiningMap = {};
  }
  return _fineDiningMap!;
}

// Cheap synchronous lookup using cached map (populated lazily; first call may miss).
function checkCategoryVenueCoherence(activities: StrictActivityMinimal[], results: ValidationResult[]): void {
  // Kick off load (no-await) so subsequent calls have the map ready.
  if (!_fineDiningMap) { void getFineDiningMap(); return; }
  const map = _fineDiningMap;
  const keys = Object.keys(map);
  if (keys.length === 0) return;
  activities.forEach((act, i) => {
    const cat = String(act?.category || '').toLowerCase();
    if (cat !== 'dining' && cat !== 'restaurant' && cat !== 'food') return;
    const title = String(act.title || '');
    if (!CASUAL_VIBE_RE.test(title)) return;
    const venue = String(act?.location?.name || '').toLowerCase();
    if (!venue) return;
    const matched = keys.find(k => venue.includes(k));
    if (!matched) return;
    results.push({
      code: FAILURE_CODES.CATEGORY_VENUE_MISMATCH,
      severity: 'error',
      message: `Activity "${title}" labels venue "${venue}" (${map[matched]}-star fine dining) as casual`,
      activityIndex: i,
      field: 'title',
      autoRepairable: true,
    });
  });
}

const CHECKOUT_RE = /\b(check\s*-?\s*out|checkout|departure|fly home|return flight|train home)\b/i;
const HOTEL_BOUND_RE = /\b(hotel\s+spa|hotel\s+restaurant|in[- ]room|room\s+service|hotel\s+bar|hotel\s+gym|hotel\s+pool|spa\s+at\s+(the\s+)?hotel)\b/i;

function checkCrossDayCheckoutHotelLeak(
  activities: StrictActivityMinimal[],
  prevDay: StrictDayMinimal,
  results: ValidationResult[],
): void {
  const prevActs = prevDay?.activities || [];
  if (prevActs.length === 0) return;
  // Find the LAST event of previous day
  const last = prevActs[prevActs.length - 1] as any;
  const lastTitle = String(last?.title || '');
  const lastCat = String(last?.category || '').toLowerCase();
  const isCheckout = lastCat === 'accommodation' && CHECKOUT_RE.test(lastTitle);
  if (!isCheckout) return;

  activities.forEach((act, i) => {
    const title = String(act.title || '');
    const venue = String(act?.location?.name || '');
    if (HOTEL_BOUND_RE.test(title) || HOTEL_BOUND_RE.test(venue)) {
      results.push({
        code: FAILURE_CODES.CHECKOUT_HOTEL_LEAK,
        severity: 'critical',
        message: `Activity "${title}" is hotel-bound but previous day ended with checkout "${lastTitle}"`,
        activityIndex: i,
        field: 'title',
        autoRepairable: true,
      });
    }
  });
}
