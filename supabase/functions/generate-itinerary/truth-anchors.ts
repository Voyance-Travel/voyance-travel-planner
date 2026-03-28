/**
 * TRUTH ANCHORS - Prevent Hallucination with Verifiable Venue Data
 * 
 * Every activity recommendation must have verifiable data anchors:
 * - Provider ID (Google Places, Foursquare, Viator)
 * - Address/coordinates
 * - Hours/reservation requirements
 * - Price level
 * - Confidence score
 * 
 * If a place can't be verified, it shouldn't appear as a confident recommendation.
 */

// =============================================================================
// TYPES
// =============================================================================

export interface TruthAnchor {
  providerId?: string;         // External ID (e.g., Google Place ID, Viator product code)
  provider?: 'google_places' | 'foursquare' | 'viator' | 'tripadvisor' | 'internal_db' | 'ai_generated';
  address: string;
  coordinates?: { lat: number; lng: number };
  openingHours?: string[];     // Array of "Monday: 9:00 AM – 5:00 PM" style strings
  reservationRequired?: boolean;
  priceLevel?: 1 | 2 | 3 | 4;  // 1 = budget, 4 = luxury
  priceEstimate?: { min: number; max: number; currency: string };
  rating?: { value: number; totalReviews: number };
  confidence: number;          // 0-1, lower triggers safer picks
  verifiedAt?: string;         // ISO timestamp
  verificationMethod?: 'api_lookup' | 'database_cache' | 'ai_inference' | 'user_provided';
}

export interface AnchoredActivity {
  id: string;
  title: string;
  category: string;
  anchor: TruthAnchor;
  // Fallback indicators
  isUnverified?: boolean;
  fallbackReason?: string;
}

export interface VerificationResult {
  isVerified: boolean;
  confidence: number;
  anchor?: TruthAnchor;
  warnings: string[];
  shouldFallback: boolean;
  fallbackStrategy?: 'use_category' | 'use_neighborhood' | 'ask_clarification' | 'reduce_day';
}

// =============================================================================
// CONFIDENCE SCORING
// =============================================================================

/**
 * Calculate confidence score based on verification data quality
 */
export function calculateConfidence(anchor: Partial<TruthAnchor>): number {
  let score = 0;
  const weights = {
    hasProviderId: 25,
    hasCoordinates: 20,
    hasAddress: 15,
    hasHours: 15,
    hasRating: 10,
    hasPriceLevel: 10,
    recentVerification: 5
  };
  
  if (anchor.providerId) score += weights.hasProviderId;
  if (anchor.coordinates?.lat && anchor.coordinates?.lng) score += weights.hasCoordinates;
  if (anchor.address && anchor.address.length > 10) score += weights.hasAddress;
  if (anchor.openingHours && anchor.openingHours.length > 0) score += weights.hasHours;
  if (anchor.rating?.value && anchor.rating?.totalReviews > 10) score += weights.hasRating;
  if (anchor.priceLevel) score += weights.hasPriceLevel;
  
  // Recency bonus
  if (anchor.verifiedAt) {
    const daysSinceVerification = (Date.now() - new Date(anchor.verifiedAt).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceVerification < 7) score += weights.recentVerification;
    else if (daysSinceVerification < 30) score += weights.recentVerification * 0.5;
  }
  
  return Math.min(100, score) / 100; // Normalize to 0-1
}

/**
 * Determine if activity needs fallback based on confidence
 */
export function needsFallback(confidence: number, category: string): boolean {
  // Higher bar for dining (people really care about restaurant recommendations)
  const thresholds: Record<string, number> = {
    dining: 0.6,
    activity: 0.4,
    sightseeing: 0.3,
    transport: 0.2, // Low bar - just need basic info
    accommodation: 0.5,
    default: 0.4
  };
  
  const threshold = thresholds[category?.toLowerCase()] ?? thresholds.default;
  return confidence < threshold;
}

// =============================================================================
// VERIFICATION RESULT BUILDING
// =============================================================================

/**
 * Build verification result from Google Places data
 */
export function verifyFromGooglePlaces(
  placeData: {
    place_id?: string;
    formatted_address?: string;
    geometry?: { location: { lat: number; lng: number } };
    opening_hours?: { weekday_text?: string[] };
    price_level?: number;
    rating?: number;
    user_ratings_total?: number;
    business_status?: string;
  } | null
): VerificationResult {
  const warnings: string[] = [];
  
  if (!placeData) {
    return {
      isVerified: false,
      confidence: 0,
      warnings: ['No Google Places data found'],
      shouldFallback: true,
      fallbackStrategy: 'use_category'
    };
  }
  
  // Check if business is operational
  if (placeData.business_status && placeData.business_status !== 'OPERATIONAL') {
    warnings.push(`Business status: ${placeData.business_status}`);
  }
  
  // Low rating warning
  if (placeData.rating && placeData.rating < 4.0) {
    warnings.push(`Low rating: ${placeData.rating} stars`);
  }
  
  const anchor: TruthAnchor = {
    providerId: placeData.place_id,
    provider: 'google_places',
    address: placeData.formatted_address || '',
    coordinates: placeData.geometry?.location ? {
      lat: placeData.geometry.location.lat,
      lng: placeData.geometry.location.lng
    } : undefined,
    openingHours: placeData.opening_hours?.weekday_text,
    priceLevel: placeData.price_level as 1 | 2 | 3 | 4 | undefined,
    rating: placeData.rating && placeData.user_ratings_total ? {
      value: placeData.rating,
      totalReviews: placeData.user_ratings_total
    } : undefined,
    confidence: 0,
    verifiedAt: new Date().toISOString(),
    verificationMethod: 'api_lookup'
  };
  
  anchor.confidence = calculateConfidence(anchor);
  
  return {
    isVerified: anchor.confidence >= 0.4,
    confidence: anchor.confidence,
    anchor,
    warnings,
    shouldFallback: needsFallback(anchor.confidence, 'activity')
  };
}

/**
 * Build verification result from Viator product data
 */
export function verifyFromViator(
  productData: {
    productCode?: string;
    title?: string;
    pricing?: { summary?: { fromPrice?: number } };
    reviews?: { combinedAverageRating?: number; totalReviews?: number };
    logistics?: { meetingPoint?: { address?: string; coordinates?: { latitude: number; longitude: number } } };
    bookingRequirements?: { requiresReservation?: boolean };
  } | null
): VerificationResult {
  if (!productData) {
    return {
      isVerified: false,
      confidence: 0,
      warnings: ['No Viator product data found'],
      shouldFallback: true,
      fallbackStrategy: 'use_category'
    };
  }
  
  const warnings: string[] = [];
  
  if (productData.reviews?.combinedAverageRating && productData.reviews.combinedAverageRating < 4.0) {
    warnings.push(`Rating below 4 stars: ${productData.reviews.combinedAverageRating}`);
  }
  
  const anchor: TruthAnchor = {
    providerId: productData.productCode,
    provider: 'viator',
    address: productData.logistics?.meetingPoint?.address || '',
    coordinates: productData.logistics?.meetingPoint?.coordinates ? {
      lat: productData.logistics.meetingPoint.coordinates.latitude,
      lng: productData.logistics.meetingPoint.coordinates.longitude
    } : undefined,
    reservationRequired: productData.bookingRequirements?.requiresReservation ?? true,
    priceEstimate: productData.pricing?.summary?.fromPrice ? {
      min: productData.pricing.summary.fromPrice,
      max: productData.pricing.summary.fromPrice * 1.2,
      currency: 'USD'
    } : undefined,
    rating: productData.reviews ? {
      value: productData.reviews.combinedAverageRating || 0,
      totalReviews: productData.reviews.totalReviews || 0
    } : undefined,
    confidence: 0,
    verifiedAt: new Date().toISOString(),
    verificationMethod: 'api_lookup'
  };
  
  anchor.confidence = calculateConfidence(anchor);
  
  return {
    isVerified: anchor.confidence >= 0.4,
    confidence: anchor.confidence,
    anchor,
    warnings,
    shouldFallback: needsFallback(anchor.confidence, 'activity')
  };
}

/**
 * Build verification from internal database cache
 */
export function verifyFromCache(
  cachedVenue: {
    google_place_id?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    opening_hours?: string[];
    price_level?: number;
    rating?: number;
    review_count?: number;
    verified_at?: string;
    source?: string;
  } | null
): VerificationResult {
  if (!cachedVenue) {
    return {
      isVerified: false,
      confidence: 0,
      warnings: ['Not found in venue cache'],
      shouldFallback: true,
      fallbackStrategy: 'use_category'
    };
  }
  
  const warnings: string[] = [];
  
  // Check cache freshness
  if (cachedVenue.verified_at) {
    const daysSince = (Date.now() - new Date(cachedVenue.verified_at).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 30) {
      warnings.push('Cache data is over 30 days old');
    }
  }
  
  const anchor: TruthAnchor = {
    providerId: cachedVenue.google_place_id,
    provider: cachedVenue.source as TruthAnchor['provider'] || 'internal_db',
    address: cachedVenue.address || '',
    coordinates: cachedVenue.latitude && cachedVenue.longitude ? {
      lat: cachedVenue.latitude,
      lng: cachedVenue.longitude
    } : undefined,
    openingHours: cachedVenue.opening_hours,
    priceLevel: cachedVenue.price_level as 1 | 2 | 3 | 4 | undefined,
    rating: cachedVenue.rating && cachedVenue.review_count ? {
      value: cachedVenue.rating,
      totalReviews: cachedVenue.review_count
    } : undefined,
    confidence: 0,
    verifiedAt: cachedVenue.verified_at || new Date().toISOString(),
    verificationMethod: 'database_cache'
  };
  
  anchor.confidence = calculateConfidence(anchor);
  
  return {
    isVerified: anchor.confidence >= 0.3, // Lower bar for cache
    confidence: anchor.confidence,
    anchor,
    warnings,
    shouldFallback: needsFallback(anchor.confidence, 'activity')
  };
}

// =============================================================================
// FALLBACK STRATEGIES
// =============================================================================

export interface FallbackRecommendation {
  strategy: 'use_category' | 'use_neighborhood' | 'ask_clarification' | 'reduce_day';
  suggestion: string;
  confidence: number;
}

/**
 * Generate fallback recommendation when verification fails
 */
export function generateFallback(
  category: string,
  neighborhood: string | null,
  verificationAttempts: number
): FallbackRecommendation {
  // After 2+ failed attempts, don't fake precision
  if (verificationAttempts >= 2) {
    if (neighborhood) {
      return {
        strategy: 'use_neighborhood',
        suggestion: `Explore ${category} options in ${neighborhood} (self-guided)`,
        confidence: 0.3
      };
    }
    return {
      strategy: 'use_category',
      suggestion: `Look for ${category} options in the area`,
      confidence: 0.2
    };
  }
  
  // First failure - suggest category with lower confidence
  return {
    strategy: 'use_category',
    suggestion: `${category} experience (specific venue to be confirmed)`,
    confidence: 0.4
  };
}

// =============================================================================
// PROMPT GENERATION
// =============================================================================

/**
 * Generate truth anchor requirements for AI prompt
 */
export function buildTruthAnchorPrompt(): string {
  return `
## TRUTH ANCHORS - VERIFIABLE VENUE DATA REQUIRED
Every activity MUST include verifiable data. Activities without truth anchors will be REJECTED.

For each activity, you MUST provide:
1. \`providerId\`: External ID if known (Google Place ID, Viator code) or null
2. \`address\`: Full street address (not just neighborhood)
3. \`priceLevel\`: 1-4 scale (1=budget, 4=luxury)
4. \`reservationRequired\`: true/false
5. \`confidence\`: 0-1 score of how certain you are this place exists and is as described

CONFIDENCE SCORING GUIDE:
- 0.9-1.0: You know this is a real, established venue with years of operation
- 0.7-0.8: Well-known venue, likely still operating
- 0.5-0.6: You believe this exists but aren't certain of current details
- 0.3-0.4: Uncertain - this might be a good option but needs verification
- Below 0.3: DON'T INCLUDE - use category/neighborhood suggestion instead

If you cannot confidently recommend a specific venue (confidence < 0.5):
- Suggest the CATEGORY + NEIGHBORHOOD instead (e.g., "Seafood restaurant in Trastevere")
- Mark as \`needsVerification: true\`
- Provide 2-3 alternative venue names to try

DO NOT hallucinate specific venues. Vague but honest > specific but wrong.

## OPERATING HOURS — HARD CONSTRAINT (NOT OPTIONAL)
You MUST respect venue operating hours. Scheduling an activity outside operating hours is a GENERATION FAILURE.

RULES:
1. The DATE and DAY OF WEEK for each day is provided in the user prompt. CHECK IT.
2. If a venue closes on that day of the week, DO NOT schedule it. Pick an alternative.
3. The activity startTime MUST be AFTER the venue opens (with buffer for entry/queue).
4. The activity endTime MUST be BEFORE the venue closes (allow 30 min before closing).
5. Restaurant scheduling: lunch service is typically 12:00-14:30, dinner service 18:30-22:00. Do NOT schedule a sit-down dinner at 15:00 or lunch at 17:00.

COMMON CLOSURE PATTERNS TO KNOW:
- Most European museums close MONDAYS (Louvre, Prado, Uffizi, Rijksmuseum, etc.)
- Turkish museums/palaces close MONDAYS or TUESDAYS
- Japanese shrines/gardens: generally open daily, but some close early
- Markets: many close Sundays and/or Mondays
- Religious sites: limited access during services (especially Sunday mornings)
- Restaurant "dead zone": most close between 14:30-18:00 for prep

CONFIRMED CLOSURES ARE HARD FAILURES:
- If you KNOW a venue is closed on the scheduled day (e.g., Louvre on Monday), DO NOT include it. Pick a different venue.
- The post-generation validator will REMOVE confirmed-closed activities. Do not rely on closedRisk tagging — the activity will be dropped.
- Only use \`closedRisk: true\` when you are GENUINELY UNCERTAIN (no hours data available, seasonal hours, etc.)

If you are NOT CERTAIN a venue is open on the scheduled day/time:
- Set \`closedRisk: true\` in the activity metadata
- Provide a backup venue in \`closedRiskAlternative\` field (name + address of a nearby alternative that IS open)
- Note: closedRisk is ONLY for uncertainty. If hours data confirms closure, the activity will be replaced automatically.

EXAMPLES OF WHAT TO AVOID:
- Scheduling the Louvre on Monday (closed)
- Scheduling a restaurant visit at 15:00 (between lunch and dinner service)
- Scheduling a museum visit starting at 09:00 when it opens at 10:00
- Scheduling a park visit ending at 20:00 when the park closes at 18:00 in winter`;
}

// =============================================================================
// OPENING HOURS VALIDATION
// =============================================================================

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Parse Google-style opening hours string to determine if venue is open
 * Handles formats like "Monday: 9:00 AM – 5:00 PM" or "Monday: Closed"
 */
export function isVenueOpenOnDay(
  openingHours: string[] | undefined,
  dayOfWeek: number, // 0=Sunday, 6=Saturday
  scheduledTimeHHMM?: string // "14:00" format
): { isOpen: boolean; reason?: string } {
  if (!openingHours || openingHours.length === 0) {
    return { isOpen: true }; // No data = assume open
  }

  const dayName = DAY_NAMES[dayOfWeek];
  if (!dayName) return { isOpen: true };

  // Find the hours entry for this day
  const dayEntry = openingHours.find(h => 
    h.toLowerCase().startsWith(dayName.toLowerCase())
  );

  if (!dayEntry) return { isOpen: true }; // No entry for this day

  // Check for "Closed" indicator
  const entryLower = dayEntry.toLowerCase();
  if (entryLower.includes('closed') || entryLower.includes('fermé') || entryLower.includes('cerrado') || entryLower.includes('chiuso') || entryLower.includes('geschlossen')) {
    return { isOpen: false, reason: `${dayName}: Closed` };
  }

  // If we have a scheduled time, try to check if it falls within hours
  if (scheduledTimeHHMM) {
    const timeRanges = extractTimeRanges(dayEntry);
    if (timeRanges.length > 0) {
      const scheduledMins = parseHHMMToMinutes(scheduledTimeHHMM);
      if (scheduledMins !== null) {
        const withinRange = timeRanges.some(range => {
          // Handle midnight crossover: e.g. open 05:00, close 00:00 means open until midnight
          if (range.close <= range.open) {
            // Crosses midnight: scheduled time is valid if >= open OR <= close
            return scheduledMins >= range.open || scheduledMins <= range.close;
          }
          return scheduledMins >= range.open && scheduledMins <= range.close;
        });
        if (!withinRange) {
          // Plausibility guard: if ALL parsed hours close before noon but activity
          // is scheduled for evening (≥17:00), the hours data is almost certainly
          // wrong (e.g., Google returning "06:00–10:30" for a jazz club).
          const allCloseBeforeNoon = timeRanges.every(r => {
            const effectiveClose = r.close <= r.open ? r.close + 1440 : r.close;
            return effectiveClose <= 720; // noon = 720 mins
          });
          if (allCloseBeforeNoon && scheduledMins >= 1020) { // 17:00 = 1020 mins
            // Hours data is implausible for an evening activity — suppress warning
            return { isOpen: true };
          }

          return { 
            isOpen: false, 
            reason: `${dayName}: Open ${timeRanges.map(r => `${minutesToHHMM(r.open)}–${minutesToHHMM(r.close)}`).join(', ')}, but scheduled at ${scheduledTimeHHMM}` 
          };
        }
      }
    }
  }

  return { isOpen: true };
}

function parseHHMMToMinutes(hhmm: string): number | null {
  const parts = hhmm.split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function minutesToHHMM(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

/**
 * Extract time ranges from a day entry like "Monday: 9:00 AM – 5:00 PM"
 */
function extractTimeRanges(entry: string): { open: number; close: number }[] {
  // Remove day name prefix
  const timePart = entry.replace(/^[a-z]+:\s*/i, '').trim();
  if (!timePart || timePart.toLowerCase() === 'closed') return [];

  const ranges: { open: number; close: number }[] = [];
  
  // Split by comma for multiple ranges (e.g., "9:00 AM – 2:00 PM, 5:00 PM – 10:00 PM")
  const segments = timePart.split(',');
  
  for (const segment of segments) {
    // Match patterns like "9:00 AM – 5:00 PM" or "09:00–17:00"
    const match12h = segment.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[–\-−to]+\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    const match24h = segment.match(/(\d{1,2}):(\d{2})\s*[–\-−to]+\s*(\d{1,2}):(\d{2})/);

    if (match12h) {
      const openMins = convert12hToMinutes(parseInt(match12h[1]), parseInt(match12h[2]), match12h[3]);
      const closeMins = convert12hToMinutes(parseInt(match12h[4]), parseInt(match12h[5]), match12h[6]);
      if (openMins !== null && closeMins !== null) {
        ranges.push({ open: openMins, close: closeMins });
      }
    } else if (match24h) {
      const openMins = parseInt(match24h[1]) * 60 + parseInt(match24h[2]);
      const closeMins = parseInt(match24h[3]) * 60 + parseInt(match24h[4]);
      ranges.push({ open: openMins, close: closeMins });
    }
  }

  return ranges;
}

function convert12hToMinutes(hour: number, minutes: number, period: string): number | null {
  let h = hour;
  const p = period.toUpperCase();
  if (p === 'PM' && h !== 12) h += 12;
  if (p === 'AM' && h === 12) h = 0;
  return h * 60 + minutes;
}

/**
 * Validate all activities in enriched days against their opening hours
 * Returns warnings for activities scheduled when venues are closed
 */
export interface OpeningHoursViolation {
  dayNumber: number;
  activityTitle: string;
  activityId: string;
  reason: string;
  category: string;
  /** true = verified hours data confirms closure; false = time conflict but venue is open that day */
  isConfirmedClosed: boolean;
}

export function validateOpeningHours(
  days: Array<{ activities: Array<{ id: string; title: string; category: string; startTime?: string; openingHours?: string[] }> }>,
  tripStartDate: string
): OpeningHoursViolation[] {
  const violations: OpeningHoursViolation[] = [];
  const startDate = new Date(tripStartDate);

  for (let dayIdx = 0; dayIdx < days.length; dayIdx++) {
    const day = days[dayIdx];
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + dayIdx);
    const dayOfWeek = currentDate.getDay(); // 0=Sunday, 6=Saturday

    for (const activity of day.activities) {
      // Skip transport/free time
      const skipCats = ['transport', 'transportation', 'downtime', 'free_time', 'accommodation'];
      if (skipCats.includes(activity.category?.toLowerCase() || '')) continue;

      if (!activity.openingHours || activity.openingHours.length === 0) continue;

      const result = isVenueOpenOnDay(activity.openingHours, dayOfWeek, activity.startTime);
      if (!result.isOpen) {
        // Determine if this is a full-day closure vs a time conflict
        const isFullDayClosure = isVenueClosedAllDay(activity.openingHours, dayOfWeek);
        violations.push({
          dayNumber: dayIdx + 1,
          activityTitle: activity.title,
          activityId: activity.id,
          reason: result.reason || 'Venue appears to be closed',
          category: activity.category,
          isConfirmedClosed: isFullDayClosure,
        });
      }
    }
  }

  return violations;
}

/**
 * Check if a venue is closed the entire day (not just a time conflict)
 */
export function isVenueClosedAllDay(
  openingHours: string[] | undefined,
  dayOfWeek: number
): boolean {
  if (!openingHours || openingHours.length === 0) return false;
  
  const dayName = DAY_NAMES[dayOfWeek];
  if (!dayName) return false;
  
  const dayEntry = openingHours.find(h => 
    h.toLowerCase().startsWith(dayName.toLowerCase())
  );
  
  if (!dayEntry) return false;
  
  const entryLower = dayEntry.toLowerCase();
  return entryLower.includes('closed') || entryLower.includes('fermé') || 
         entryLower.includes('cerrado') || entryLower.includes('chiuso') || 
         entryLower.includes('geschlossen');
}

/**
 * Validate activity has sufficient truth anchors
 */
export function validateTruthAnchors(
  activity: {
    title: string;
    category: string;
    location?: { address?: string; coordinates?: { lat: number; lng: number } };
    providerId?: string;
    priceLevel?: number;
    confidence?: number;
    needsVerification?: boolean;
  }
): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Skip validation for transport/logistics
  if (['transport', 'logistics', 'accommodation'].includes(activity.category?.toLowerCase() || '')) {
    return { valid: true, issues: [] };
  }
  
  // Check address
  if (!activity.location?.address || activity.location.address.length < 10) {
    issues.push('Missing or incomplete address');
  }
  
  // Check confidence
  const confidence = activity.confidence ?? 0.5;
  if (confidence < 0.3 && !activity.needsVerification) {
    issues.push(`Low confidence (${confidence}) without needsVerification flag`);
  }
  
  // Dining needs price level
  if (activity.category?.toLowerCase() === 'dining' && !activity.priceLevel) {
    issues.push('Dining activity missing priceLevel');
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
