/**
 * Centralized Itinerary Parser
 * 
 * Safely parses itinerary_data JSONB from the database.
 * - Never throws - returns safe defaults on malformed data
 * - Filters null/undefined entries before mapping
 * - Uses stable IDs (no Math.random())
 * - Handles both camelCase and snake_case field names
 * - Logs warnings for malformed entries (dev debugging)
 */

import { format, parseISO, addDays } from 'date-fns';
import { coerceDurationString } from './plannerUtils';
import { isGhostActivity } from '@/lib/itinerary/hideGhostActivities';
import { ensureHotelReturnBookend, isHotelReturnBookendActivity } from '@/lib/itinerary/ensureHotelReturnBookend';
import { dayChronoKey } from '@/lib/itinerary/dayChronoKey';
import { normalizePredawnCascade } from '@/lib/itinerary/normalizePredawnCascade';
import { assertNoCrossDayBleed } from '@/lib/itinerary/crossDayBleedGuard';
import { pruneDepartureUntimed } from '@/lib/itinerary/pruneDepartureUntimed';

// Strip non-Latin scripts from AI text artifacts before rendering
const NON_LATIN_SCRIPT = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u0600-\u06FF\u0400-\u04FF\u0E00-\u0E7F]+/g;

// Strip leaked JSON schema field names from AI text (e.g. ",title: -", "practicalTips;|")
const SCHEMA_LEAK_RE = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay)\s*[:;|]\s*[^,;|]*/gi;

function sanitizeDisplayString(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(NON_LATIN_SCRIPT, '')
    .replace(SCHEMA_LEAK_RE, '')
    // Strip leaked AI prompt scaffolding ("This satisfies your 'Deep Context' requirement",
    // "(AESTHETIC slot)", "(slot)") that escaped the server-side sanitizer.
    .replace(/(?:^|\.\s*)This\s+(?:addresses|fulfills|satisfies|aligns with|caters to|speaks to|reflects)\s+(?:the|your|their)\s+['"\u2018\u2019\u201C\u201D][^'"\u2018\u2019\u201C\u201D]{2,40}['"\u2018\u2019\u201C\u201D]\s+(?:interest|preference|request|need|requirement|slot|moment|stop|block)\b[^.]*\.?\s*/gi, '')
    .replace(/\s*\(\s*(?:[A-Z][A-Z\s/&-]{1,30}\s+)?slot\s*\)\s*/gi, ' ')
    .replace(/\s*\(\s*(?:AESTHETIC|NARRATIVE|MOOD|TONE|VIBE|THEME|ARCHETYPE|PERSONA|CONTEXT|FULFILLS?|SLOT)(?:\s+[A-Z][A-Z\s/&-]{0,30})?\s*\)\s*/g, ' ')
    // Quoted-archetype clauses anywhere: "...providing the 'Deep Context' required..."
    .replace(/\b(?:providing|satisfying|fulfilling|matching|delivering|offering|reflecting|catering to|aligning with|aligns with|tailored to|in line with|required for)\s+(?:the\s+)?['"\u2018\u201C][^'"\u2019\u201D]{2,40}['"\u2019\u201D]\s+(?:interest|preference|requirement|required|slot|need|moment|context|arche\w*|profile|trait|fit)[^.]*\.?/gi, '')
    // Bare Fulfills/Satisfies/Addresses sentences (no leading "This")
    .replace(/(?:^|[.!?]\s+)(?:Fulfills?|Satisfies|Addresses|Specifically\s+(?:fulfills?|satisfies|addresses))\b[^.]*\b(?:requirement|interest|slot|block|moment|need|preference|profile|arche\w*)\b[^.]*\.?/gi, ' ')
    // "As a 'Label' arche..." framing
    .replace(/\bAs\s+a\s+['"\u2018\u201C][^'"\u2019\u201D]{2,40}['"\u2019\u201D]\s+arche\w*[^.]*\.?/gi, '')
    // "provides/offers/delivers [the] deep|rich|essential [historical] context..."
    .replace(/\b(?:provid(?:es|ing)|offer(?:s|ing)|deliver(?:s|ing))\s+(?:the\s+)?(?:deep|rich|essential)\s+(?:historical\s+)?context[^.]*\.?/gi, '')
    .replace(/\bfor\s+this\s+traveler\s+profile\b\.?/gi, '')
    // Orphan fragments left by prior strippers: "This is ;" / "is ;" / repeated punctuation
    .replace(/\bThis\s+is\s*[;,.]\s*/gi, '')
    .replace(/\bis\s*;\s*/gi, '')
    .replace(/[.,;:]{2,}/g, '.')
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;|:\s-]+|[,;|:\s-]+$/g, '')
    .trim();
  // Standalone "Deep context" / "Deep context stop" placeholder titles → drop entirely
  if (/^deep\s+context(?:\s+stop)?$/i.test(cleaned)) return undefined;
  return cleaned || undefined;
}

function sanitizeUnknownStrings(value: unknown): unknown {
  if (typeof value === 'string') {
    return sanitizeDisplayString(value) ?? '';
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeUnknownStrings(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sanitizeUnknownStrings(item),
      ])
    );
  }

  return value;
}

// =============================================================================
// TYPES
// =============================================================================

export interface ParsedLocation {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface ParsedCost {
  amount?: number;
  currency?: string;
}

export interface ParsedTransportation {
  method?: string;
  duration?: string;
  estimatedCost?: ParsedCost;
  instructions?: string;
}

export interface ParsedRating {
  value?: number;
  totalReviews?: number;
}

export interface ParsedActivity {
  id: string;
  title: string;
  name: string; // Alias for title (backwards compat)
  description?: string;
  type?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  time?: string;
  duration?: string;
  durationMinutes?: number;
  location?: ParsedLocation;
  imageUrl?: string;
  tips?: string | string[];
  confirmationNumber?: string;
  voucherUrl?: string;
  bookingRequired?: boolean;
  reservationTime?: string;
  cost?: ParsedCost;
  estimatedCost?: ParsedCost;
  transportation?: ParsedTransportation;
  isLocked?: boolean;
  rating?: ParsedRating | number;
  website?: string;
  photos?: Array<{ url: string } | string>;
  tags?: string[];
  /** Allow pass-through of editorial-specific fields (timeBlockType, bookingState, etc.) */
  [key: string]: unknown;
}

export interface ParsedWeather {
  condition?: string;
  high?: number;
  low?: number;
  icon?: string;
}

export interface ParsedDay {
  dayNumber: number;
  date: string;
  title?: string;
  theme?: string;
  description?: string;
  estimatedWalkingTime?: string;
  estimatedDistance?: string;
  activities: ParsedActivity[];
  weather?: ParsedWeather;
  // Multi-city / transition day fields
  city?: string;
  country?: string;
  isTransitionDay?: boolean;
  transitionFrom?: string;
  transitionTo?: string;
  transportComparison?: unknown[];
  selectedTransportId?: string;
  [key: string]: unknown;
}

// For EditorialItinerary component compatibility
export interface EditorialParsedDay extends ParsedDay {
  activities: (ParsedActivity & {
    location?: { name?: string; address?: string };
  })[];
}

function isProtectedActivity(a: any): boolean {
  if (!a) return false;
  if (a.is_locked === true || a.isLocked === true || a.locked === true) return true;
  if (a.lock_state === 'locked') return true;
  return ['user', 'manual', 'extracted', 'pinned'].includes(String(a.source || '').toLowerCase());
}

function dedupeHotelReturnBookends<T extends any[]>(activities: T, dayNumber?: number): T {
  if (!Array.isArray(activities) || activities.length < 2) return activities;
  const returnRows = activities
    .map((activity, index) => ({ activity, index }))
    .filter(({ activity }) => isHotelReturnBookendActivity(activity));
  if (returnRows.length < 2) return activities;

  const protectedReturnIndexes = new Set(
    returnRows.filter(({ activity }) => isProtectedActivity(activity)).map(({ index }) => index),
  );
  const keepGeneratedIndex = protectedReturnIndexes.size > 0
    ? -1
    : returnRows.reduce((best, row) => {
        const rowKey = dayChronoKey(row.activity?.startTime || row.activity?.start_time || row.activity?.time);
        const bestKey = dayChronoKey(best.activity?.startTime || best.activity?.start_time || best.activity?.time);
        return rowKey >= bestKey ? row : best;
      }).index;

  const deduped = activities.filter((activity, index) => {
    if (!isHotelReturnBookendActivity(activity)) return true;
    if (protectedReturnIndexes.has(index)) return true;
    return index === keepGeneratedIndex;
  });

  if (deduped.length !== activities.length) {
    console.warn(`[itineraryParser] Deduped ${activities.length - deduped.length} duplicate hotel-return bookend(s) on day ${dayNumber ?? '?'}`);
  }
  return deduped as unknown as T;
}

// For ItineraryAssistant component compatibility
// Uses ItineraryDay from itineraryActionExecutor which has [key: string]: unknown
export interface AssistantParsedDay {
  dayNumber: number;
  date: string;
  theme?: string;
  description?: string;
  activities: {
    id: string;
    title: string;
    name?: string;
    category?: string;
    startTime: string;
    time: string;
    cost?: { amount?: number };
    isLocked?: boolean;
    description?: string;
    location?: { name?: string; address?: string };
    [key: string]: unknown; // Index signature for compatibility
  }[];
  [key: string]: unknown; // Index signature for compatibility
}

// For ActiveTrip component compatibility
export interface ActiveTripDay {
  dayNumber: number;
  date: string;
  theme?: string;
  description?: string;
  activities: {
    id: string;
    name: string;
    description?: string;
    type?: string;
    category?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
    location?: ParsedLocation;
    imageUrl?: string;
    tips?: string[];
    confirmationNumber?: string;
    voucherUrl?: string;
    bookingRequired?: boolean;
    reservationTime?: string;
    transportationMethod?: string;
  }[];
  weather?: ParsedWeather;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract a string value from an object, trying multiple keys
 */
function extractString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim()) {
      return sanitizeDisplayString(val);
    }
  }
  return undefined;
}

/**
 * Extract a number value from an object, trying multiple keys
 */
function extractNumber(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'number' && !isNaN(val)) {
      return val;
    }
    // Handle string numbers
    if (typeof val === 'string') {
      const parsed = parseFloat(val);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return undefined;
}

/**
 * Extract a boolean value from an object, trying multiple keys
 */
function extractBoolean(obj: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'boolean') {
      return val;
    }
  }
  return undefined;
}

/**
 * Safely cast unknown to Record<string, unknown>
 */
function asRecord(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

/**
 * Calculate date for a day given trip start date and day index
 */
function calculateDayDate(tripStartDate: string | undefined, dayIndex: number): string {
  if (!tripStartDate) return '';
  try {
    const start = parseISO(tripStartDate);
    const dayDate = addDays(start, dayIndex);
    return format(dayDate, 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

/**
 * Parse location from various formats
 */
function parseLocation(raw: unknown): ParsedLocation | undefined {
  if (!raw) return undefined;
  
  if (typeof raw === 'string') {
    return { name: raw };
  }
  
  if (typeof raw === 'object' && raw !== null) {
    const loc = raw as Record<string, unknown>;
    return {
      name: extractString(loc, ['name']),
      address: extractString(loc, ['address']),
      lat: extractNumber(loc, ['lat', 'latitude']),
      lng: extractNumber(loc, ['lng', 'longitude', 'lon']),
    };
  }
  
  return undefined;
}

/**
 * Parse cost from various formats
 */
function parseCost(raw: unknown): ParsedCost | undefined {
  // CRITICAL: numeric 0 is a valid cost (free venue) — do NOT treat it as falsy
  if (raw === null || raw === undefined || raw === '') return undefined;
  
  if (typeof raw === 'number') {
    return isNaN(raw) ? undefined : { amount: raw };
  }
  
  if (typeof raw === 'object' && raw !== null) {
    const cost = raw as Record<string, unknown>;
    const amount = extractNumber(cost, ['amount', 'value', 'price', 'total', 'perPerson', 'per_person']);
    return {
      amount,
      currency: extractString(cost, ['currency']),
    };
  }
  
  return undefined;
}

/**
 * Parse weather from various formats
 */
function parseWeather(raw: unknown): ParsedWeather | undefined {
  if (!raw) return undefined;
  
  if (typeof raw === 'object' && raw !== null) {
    const w = raw as Record<string, unknown>;
    return {
      condition: extractString(w, ['condition', 'description']),
      high: extractNumber(w, ['high', 'maxTemp', 'max_temp']),
      low: extractNumber(w, ['low', 'minTemp', 'min_temp']),
      icon: extractString(w, ['icon']),
    };
  }
  
  return undefined;
}

/**
 * Parse transportation from various formats
 */
function parseTransportation(raw: unknown): ParsedTransportation | undefined {
  if (!raw) return undefined;
  
  if (typeof raw === 'object' && raw !== null) {
    const t = raw as Record<string, unknown>;
    return {
      method: extractString(t, ['method', 'type', 'mode']),
      duration: extractString(t, ['duration']),
      estimatedCost: parseCost(t.estimatedCost || t.estimated_cost || t.cost),
      instructions: extractString(t, ['instructions', 'notes']),
    };
  }
  
  return undefined;
}

/**
 * Parse rating from various formats
 */
function parseRating(raw: unknown): ParsedRating | number | undefined {
  if (typeof raw === 'number') return raw;
  
  if (typeof raw === 'object' && raw !== null) {
    const r = raw as Record<string, unknown>;
    return {
      value: extractNumber(r, ['value', 'rating', 'score']),
      totalReviews: extractNumber(r, ['totalReviews', 'total_reviews', 'reviewCount', 'count']),
    };
  }
  
  return undefined;
}

/** Extract first photo URL from a photos array (string or {url} objects) */
function resolveFirstPhoto(photos: unknown): string | undefined {
  if (!Array.isArray(photos) || photos.length === 0) return undefined;
  const first = photos[0];
  if (typeof first === 'string' && first.length > 0) return first;
  if (typeof first === 'object' && first !== null && typeof (first as any).url === 'string') return (first as any).url;
  return undefined;
}

// =============================================================================
// ACTIVITY PARSER
// =============================================================================

/**
 * Parse a single activity with safe defaults
 * Never throws - returns safe defaults on malformed data
 */
function parseSingleActivity(
  raw: unknown,
  dayIndex: number,
  activityIndex: number
): ParsedActivity {
  const activityData = sanitizeUnknownStrings(asRecord(raw)) as Record<string, unknown>;
  
  // Generate stable ID - no Math.random()!
  const id = extractString(activityData, ['id']) || `day${dayIndex + 1}-act${activityIndex}`;
  const title = extractString(activityData, ['title', 'name']) || 'Untitled Activity';
  
  return {
    // Spread sanitized raw fields first to preserve unknown/editorial-specific fields
    // (timeBlockType, bookingUrl, bookingState, vendorName, viatorProductCode, etc.)
    ...activityData,
    // Then override with safely parsed versions
    id,
    title,
    name: title, // Alias for backwards compatibility
    description: extractString(activityData, ['description']),
    type: extractString(activityData, ['type']),
    category: extractString(activityData, ['category']),
    // Time-field canonicalization: `startTime` is canonical. Legacy `time`
    // is mirrored to match — never allowed to disagree downstream.
    // mem://constraints/itinerary/time-field-canonicalization
    ...(() => {
      const startTime = extractString(activityData, ['startTime', 'start_time', 'time']);
      const rawTime = extractString(activityData, ['time']);
      if (rawTime && startTime && rawTime !== startTime && typeof console !== 'undefined') {
        // eslint-disable-next-line no-console
        console.warn('[TIME_FIELD_DRIFT]', {
          id: (activityData as { id?: string })?.id,
          startTime,
          time: rawTime,
        });
      }
      return {
        startTime,
        endTime: extractString(activityData, ['endTime', 'end_time']),
        // Mirror startTime so legacy readers can't surface a stale value.
        time: startTime || rawTime || '',
      };
    })(),
    duration: coerceDurationString(
      extractString(activityData, ['duration']),
      extractNumber(activityData, ['durationMinutes', 'duration_minutes'])
    ),
    durationMinutes: extractNumber(activityData, ['durationMinutes', 'duration_minutes']),
    location: parseLocation(activityData.location),
    imageUrl: extractString(activityData, ['imageUrl', 'image_url', 'image'])
      || resolveFirstPhoto(activityData.photos),
    tips: activityData.tips as string | string[] | undefined,
    confirmationNumber: extractString(activityData, ['confirmationNumber', 'confirmation_number']),
    voucherUrl: extractString(activityData, ['voucherUrl', 'voucher_url']),
    bookingRequired: extractBoolean(activityData, ['bookingRequired', 'booking_required']),
    reservationTime: extractString(activityData, ['reservationTime', 'reservation_time']),
    // Use nullish coalescing (??) instead of || so numeric 0 is preserved
    cost: parseCost(activityData.cost ?? activityData.estimatedCost ?? activityData.estimated_cost),
    estimatedCost: parseCost(activityData.estimatedCost ?? activityData.estimated_cost ?? activityData.cost),
    transportation: parseTransportation(activityData.transportation),
    isLocked: extractBoolean(activityData, ['isLocked', 'is_locked', 'locked']),
    rating: parseRating(activityData.rating),
    website: extractString(activityData, ['website', 'url']),
    photos: activityData.photos as Array<{ url: string } | string> | undefined,
    tags: Array.isArray(activityData.tags)
      ? activityData.tags
          .filter((t): t is string => typeof t === 'string')
          .map((t) => sanitizeDisplayString(t))
          .filter((t): t is string => Boolean(t))
      : [],
  };
}

// =============================================================================
// DAY PARSER
// =============================================================================

/**
 * Parse a single day with safe defaults
 * Never throws - returns safe defaults on malformed data
 */
function parseSingleDay(
  raw: unknown,
  dayIndex: number,
  tripStartDate?: string
): ParsedDay {
  const dayData = sanitizeUnknownStrings(asRecord(raw)) as Record<string, unknown>;
  
  const dayNumber = extractNumber(dayData, ['dayNumber', 'day_number', 'day']) ?? dayIndex + 1;
  
  // Get activities array safely
  const rawActivities = Array.isArray(dayData.activities) ? dayData.activities : [];
  
  // Filter null/undefined activities BEFORE mapping
  const parsedActivities = rawActivities
    .filter((a): a is NonNullable<typeof a> => {
      if (a === null || a === undefined) {
        console.warn(`[itineraryParser] Day ${dayNumber}: Skipping null/undefined activity`);
        return false;
      }
      return true;
    })
    .map((a, actIdx) => parseSingleActivity(a, dayIndex, actIdx));

  // Deduplicate activities within the same day.
  //
  // Hardened key (Bruges meal-loss fix): category + venue + title + startTime.
  // Two dining cards now only collide when they're the *same* venue at the
  // *same* time. Empty-startTime collisions are exempt entirely — that was
  // the documented Bruges trigger where multiple meal/logistics cards with
  // empty `startTime` collapsed to a single survivor on the key "|".
  const DINING_CAT_RE = /(dining|food|restaurant|breakfast|lunch|dinner|brunch|cafe|café)/i;
  const isDining = (a: any) =>
    DINING_CAT_RE.test(String(a?.category || '')) ||
    DINING_CAT_RE.test(String(a?.title || ''));
  const venueOf = (a: any) =>
    String(a?.venue_name || a?.location?.name || a?.location?.address || '').toLowerCase().trim();
  const seen = new Map<string, any>();
  const activities: any[] = [];
  for (const act of parsedActivities) {
    const start = String(act.startTime || '').trim();
    const cat = String(act.category || '').toLowerCase().trim();
    const venue = venueOf(act);
    const title = (act.title || '').toLowerCase().trim();
    // Never dedup when startTime is empty — empty-time collisions silently
    // dropped Bruges meal cards. Always keep these.
    if (!start) {
      activities.push(act);
      continue;
    }
    const key = `${cat}|${venue}|${title}|${start}`;
    const prior = seen.get(key);
    if (!prior) {
      seen.set(key, act);
      activities.push(act);
      continue;
    }
    // Tie-break: prefer dining over non-dining; prefer card with a venue
    // over a placeholder. Never silently drop a dining card.
    const priorIsDining = isDining(prior);
    const actIsDining = isDining(act);
    if (actIsDining && !priorIsDining) {
      // Replace prior with act (keep dining).
      const idx = activities.indexOf(prior);
      if (idx >= 0) activities[idx] = act;
      seen.set(key, act);
      console.warn(`[itineraryParser] Day ${dayNumber}: dedup kept dining "${act.title}" over non-dining "${prior.title}"`);
      continue;
    }
    if (!actIsDining && priorIsDining) {
      console.warn(`[itineraryParser] Day ${dayNumber}: dedup kept prior dining "${prior.title}" over non-dining "${act.title}"`);
      continue;
    }
    // Same dining-ness: prefer one with venue.
    const priorHasVenue = !!venueOf(prior);
    const actHasVenue = !!venue;
    if (actHasVenue && !priorHasVenue) {
      const idx = activities.indexOf(prior);
      if (idx >= 0) activities[idx] = act;
      seen.set(key, act);
    }
    console.warn(`[itineraryParser] Day ${dayNumber}: Removing duplicate activity "${act.title}" (cat=${cat}, venue=${venue || '∅'}, start=${start})`);
  }
  
  // CRITICAL: Always use calculated date from tripStartDate + dayIndex when available.
  // This acts as a post-generation sanitizer — the AI sometimes returns wrong dates
  // (e.g., wrong month boundaries, gaps, duplicates). Calculated dates are authoritative.
  const calculatedDate = calculateDayDate(tripStartDate, dayIndex);
  const aiDate = extractString(dayData, ['date']);
  
  return {
    // Spread sanitized day fields first to preserve unknown/editorial-specific fields
    ...dayData,
    dayNumber,
    date: calculatedDate || aiDate || '',
    title: extractString(dayData, ['title', 'theme']),
    theme: extractString(dayData, ['theme', 'title']),
    description: extractString(dayData, ['description']),
    estimatedWalkingTime: extractString(dayData, ['estimatedWalkingTime', 'estimated_walking_time']),
    estimatedDistance: extractString(dayData, ['estimatedDistance', 'estimated_distance']),
    activities,
    weather: parseWeather(dayData.weather),
    // Explicitly extract multi-city / transition day fields for type safety
    city: extractString(dayData, ['city']),
    country: extractString(dayData, ['country']),
    isTransitionDay: extractBoolean(dayData, ['isTransitionDay', 'is_transition_day']),
    transitionFrom: extractString(dayData, ['transitionFrom', 'transition_from']),
    transitionTo: extractString(dayData, ['transitionTo', 'transition_to']),
    transportComparison: Array.isArray(dayData.transportComparison) ? dayData.transportComparison : undefined,
    selectedTransportId: extractString(dayData, ['selectedTransportId', 'selected_transport_id']),
  };
}

// =============================================================================
// MAIN EXPORT FUNCTIONS
// =============================================================================

/**
 * Safely parse itinerary_data JSONB from database
 * Never throws - returns empty array on malformed data
 * 
 * @param rawData - The raw itinerary_data from the database
 * @param tripStartDate - Optional trip start date for calculating day dates
 * @returns Parsed days array, empty if data is invalid
 */
export function parseItineraryDays(
  rawData: unknown,
  tripStartDate?: string,
  tripEndDate?: string,
  options?: { partial?: boolean }
): ParsedDay[] {
  // Validate top-level structure
  if (!rawData || typeof rawData !== 'object') {
    if (rawData !== null && rawData !== undefined) {
      console.warn('[itineraryParser] Invalid itinerary data type:', typeof rawData);
    }
    return [];
  }
  
  const data = rawData as Record<string, unknown>;
  
  // Canonical path: top-level `days` array
  let rawDays = data.days;
  
  // Compat fallback: nested `itinerary.days` from older saves
  if (!Array.isArray(rawDays)) {
    const nested = data.itinerary as Record<string, unknown> | undefined;
    if (nested && Array.isArray(nested.days)) {
      rawDays = nested.days;
      console.log('[itineraryParser] Using fallback: itinerary.days');
    }
  }
  
  if (!Array.isArray(rawDays)) {
    if (rawDays !== null && rawDays !== undefined) {
      console.warn('[itineraryParser] days is not an array:', typeof rawDays);
    }
    return [];
  }
  
  // Filter null/undefined days BEFORE mapping
  const parsedDays = rawDays
    .filter((day, idx): day is NonNullable<typeof day> => {
      if (day === null || day === undefined) {
        console.warn(`[itineraryParser] Skipping null/undefined day at index ${idx}`);
        return false;
      }
      return true;
    })
    .map((day, idx) => parseSingleDay(day, idx, tripStartDate));
  
  // === LAYER 2: HARD DEDUPLICATION — by dayNumber AND by date ===
  //
  // Bruges meal-loss fix: when collapsing duplicate days, salvage any dining
  // activities from the discarded duplicate so meal cards are never silently
  // lost. The Payments tab reads raw `activity_costs` rows (no dedup), so any
  // dining row dropped here is exactly what causes the "Payments shows 7,
  // itinerary shows fewer" mismatch.
  const DINING_DAY_CAT_RE = /(dining|food|restaurant|breakfast|lunch|dinner|brunch|cafe|café)/i;
  const isDiningAct = (a: any) =>
    DINING_DAY_CAT_RE.test(String(a?.category || '')) ||
    DINING_DAY_CAT_RE.test(String(a?.title || ''));
  const actKey = (a: any) =>
    `${String(a?.title || '').toLowerCase().trim()}|${String(a?.startTime || '').trim()}`;
  const salvageDining = (winner: ParsedDay, loser: ParsedDay): number => {
    if (!loser?.activities?.length) return 0;
    const winnerKeys = new Set((winner.activities || []).map(actKey));
    const merged = [...(winner.activities || [])];
    let rescued = 0;
    for (const a of loser.activities) {
      if (!isDiningAct(a)) continue;
      const k = actKey(a);
      if (winnerKeys.has(k)) continue;
      merged.push(a);
      winnerKeys.add(k);
      rescued++;
    }
    if (rescued > 0) {
      // Re-sort chronologically (wrap-aware so 00:55 bookends stay at tail).
      merged.sort((x, y) => dayChronoKey(x?.startTime) - dayChronoKey(y?.startTime));
      winner.activities = merged;
      console.warn(`[itineraryParser] Salvaged ${rescued} dining card(s) from duplicate day ${loser.dayNumber}`);
    }
    return rescued;
  };

  // Step 1: Deduplicate by dayNumber — keep entry with more activities, but
  // salvage dining cards from the discarded duplicate.
  const byDayNumber = new Map<number, ParsedDay>();
  for (const day of parsedDays) {
    const existing = byDayNumber.get(day.dayNumber);
    if (!existing) {
      byDayNumber.set(day.dayNumber, day);
      continue;
    }
    const dayActs = day.activities?.length || 0;
    const exActs = existing.activities?.length || 0;
    if (dayActs > exActs) {
      salvageDining(day, existing);
      byDayNumber.set(day.dayNumber, day);
    } else {
      salvageDining(existing, day);
    }
  }
  let deduped = Array.from(byDayNumber.values());

  // Step 2: Deduplicate by date — same salvage logic.
  const byDate = new Map<string, ParsedDay>();
  for (const day of deduped) {
    const dateKey = day.date || `fallback-day-${day.dayNumber}`;
    const existing = byDate.get(dateKey);
    if (!existing) {
      byDate.set(dateKey, day);
      continue;
    }
    const dayActs = day.activities?.length || 0;
    const exActs = existing.activities?.length || 0;
    if (dayActs > exActs) {
      salvageDining(day, existing);
      byDate.set(dateKey, day);
    } else {
      salvageDining(existing, day);
    }
  }
  deduped = Array.from(byDate.values());

  // Step 3: Sort chronologically and re-number sequentially (1, 2, 3...)
  deduped.sort((a, b) => {
    if (a.date && b.date) return new Date(a.date).getTime() - new Date(b.date).getTime();
    return a.dayNumber - b.dayNumber;
  });

  if (deduped.length < parsedDays.length) {
    console.warn(`[itineraryParser] Deduplicated ${parsedDays.length - deduped.length} duplicate day(s)`);
  }
  
  // Step 4: Re-assign sequential dayNumbers and authoritative dates,
  //          and strip "ghost" activities (legacy pre-dawn hotel returns and
  //          "Spa Time — find a venue" wellness placeholders) from display.
  //
  //          Also drops a stale `late_nightlife_bookend` / `bookend-*` card
  //          sitting at index 0 of Day N≥2 — that bookend belongs to Day N−1's
  //          tail and only landed at the head here via a wrap-window persist
  //          regression. Without this drop, the FE timeline reads it as the
  //          day's morning anchor and cascades. See
  //          mem://constraints/itinerary/late-nightlife-no-next-day-bleed.
  const STALE_HEAD_BOOKEND_SOURCE_RE =
    /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i;
  const isStaleNextDayHeadBookend = (a: any): boolean => {
    if (!a) return false;
    const src = String(a.source || '').toLowerCase();
    if (STALE_HEAD_BOOKEND_SOURCE_RE.test(src)) return true;
    const tags = Array.isArray(a.tags) ? a.tags.map((t: any) => String(t).toLowerCase()) : [];
    return tags.some((t: string) => STALE_HEAD_BOOKEND_SOURCE_RE.test(t));
  };
  let predawnNormalizedTotal = 0;
  let result = deduped.map((day, idx) => {
    const filteredActivities = (day.activities || []).filter((a) => {
      const ghost = isGhostActivity(a);
      if (ghost) {
        console.warn(`[itineraryParser] Hiding ghost activity "${(a as any)?.title || (a as any)?.name}" on day ${idx + 1} (start=${(a as any)?.startTime || (a as any)?.start_time || (a as any)?.time})`);
      }
      return !ghost;
    });
    let dedupedActivities = dedupeHotelReturnBookends(filteredActivities, idx + 1);
    // Drop stale head bookend on ANY day (Day 1 included) when the bookend
    // sits at index 0 with a pre-dawn start AND there are real later
    // activities. This catches Sapporo's "orphan at top of Day 1" pattern
    // and the Day N≥2 next-day-bleed equally. Locked / user / manual /
    // extracted / pinned rows stay exempt (isStaleNextDayHeadBookend keys
    // off bookend source/tag/id, which excludes those).
    if (dedupedActivities.length > 0 && isStaleNextDayHeadBookend(dedupedActivities[0])) {
      const head = dedupedActivities[0] as any;
      const headStartRaw = head?.startTime || head?.start_time || head?.time || '';
      const headStartMatch = String(headStartRaw).match(/(\d{1,2}):(\d{2})/);
      let headStartMin: number | null = null;
      if (headStartMatch) {
        let h = parseInt(headStartMatch[1], 10);
        const mm = parseInt(headStartMatch[2], 10);
        if (/pm/i.test(String(headStartRaw)) && h < 12) h += 12;
        if (/am/i.test(String(headStartRaw)) && h === 12) h = 0;
        if (!Number.isNaN(h) && !Number.isNaN(mm)) headStartMin = h * 60 + mm;
      }
      const isPreDawn = headStartMin !== null && headStartMin >= 0 && headStartMin < 6 * 60;
      const hasRealLaterActivity = dedupedActivities.slice(1).some((a: any) => {
        const raw = a?.startTime || a?.start_time || a?.time || '';
        const m = String(raw).match(/(\d{1,2}):(\d{2})/);
        if (!m) return false;
        let h = parseInt(m[1], 10);
        const mm = parseInt(m[2], 10);
        if (/pm/i.test(String(raw)) && h < 12) h += 12;
        if (/am/i.test(String(raw)) && h === 12) h = 0;
        const min = h * 60 + mm;
        return min >= 6 * 60 && min <= 23 * 60 + 59;
      });
      // Day N≥2: drop unconditionally (legacy — bookend belongs to N−1's tail).
      // Day 1: drop only when head sits in pre-dawn AND real later activity exists.
      const shouldDrop = idx > 0 || (isPreDawn && hasRealLaterActivity);
      if (shouldDrop) {
        const reason = idx > 0 ? 'stale_next_day_head' : 'stale_predawn_head_any_day';
        console.warn(
          `[itineraryParser] Dropping stale head bookend "${head?.title || head?.name}" on day ${idx + 1} (source=${head?.source || 'inferred'}, start=${headStartRaw}, reason=${reason})`,
        );
        console.log(
          `[BOOKEND_TRACE] day=${idx + 1} site=parse action=dropped source=${head?.source || 'inferred'} reason=${reason} title="${head?.title || ''}"`,
        );
        dedupedActivities = dedupedActivities.slice(1);
      }
    }
    // Pre-dawn cascade heal: shift the leading [00:00, 05:00) block of
    // non-bookend / non-locked / non-departure cards forward so the day
    // doesn't display "Moco Museum 1:33 AM". See
    // mem://constraints/itinerary/late-nightlife-no-next-day-bleed.
    const predawn = normalizePredawnCascade(dedupedActivities, idx, {
      dayNumber: idx + 1,
      site: 'parser-step4',
    });
    if (predawn.changed) {
      predawnNormalizedTotal += predawn.count;
      dedupedActivities = predawn.activities;
    }
    return {
      ...day,
      dayNumber: idx + 1,
      date: calculateDayDate(tripStartDate, idx) || day.date,
      activities: dedupedActivities,
    };
  });

  // Step 4a: Cross-day bleed guard — read-time mirror of the persist-boundary
  // chokepoint. Self-heals legacy persisted trips by moving an untagged
  // pre-dawn head row on Day N+1 back to Day N's tail when Day N ended late
  // (≥22:00). See mem://constraints/itinerary/day1-past-midnight-no-day2-cascade.
  try {
    const guarded = assertNoCrossDayBleed(result, { site: 'parser-step4a' });
    if (guarded.changed) {
      result = guarded.days as typeof result;
    }
  } catch (e) {
    console.warn('[itineraryParser] cross-day bleed guard failed (non-blocking):', e);
  }

  // Step 4b: Read-time hotel-return safety net. Mirrors runStep8 at display
  // time so legacy trips and gray-zone end times still show a "Return to
  // {hotel}" card. Pure UI — never written to DB. The departure day is the
  // last day in the trip whose terminal activity is a flight/airport transfer.
  const allTripActivities = result.flatMap((d) => d.activities || []);
  // Departure-day detection: any day whose activities contain a flight or
  // airport/terminal/gate transport card is a departure day. Don't trust
  // array order — stale leisure cards or previously-injected synthetic
  // returns can sit after the real flight.
  const dayHasDepartureTerminal = (acts: any[]) =>
    (acts || []).some((a) => {
      const cat = String(a?.category || '').toUpperCase();
      const title = String(a?.title || a?.name || '');
      // Arrival flights / inbound transfers are NOT departure terminals.
      if (/\b(arrival|inbound|landing|land\s+at|arrive)\b/i.test(title)) return false;
      if (cat === 'FLIGHT' || /\b(flight|departure)\b/i.test(title)) return true;
      if (
        /TRANSPORT|TRANSIT|TRAVEL|LOGISTICS/.test(cat) &&
        /\b(airport|terminal|gate|station)\b/i.test(title)
      ) return true;
      // Airport-bound transfer titles ("Transfer to KIX", "Taxi to Heathrow
      // Terminal 5") count even when category is generic ('transport'). Mirrors
      // DEPARTURE_TRANSFER_TITLE_RE in ensureHotelReturnBookend.
      if (/^\s*(?:transfer|taxi|drive|ride|shuttle|car|uber|lyft)\s+to\b[^.]*\b(airport|terminal|gate|station)\b/i.test(title)) return true;
      // Hotel CHECKOUT is an unambiguous departure-day signal even when the
      // airport transfer / flight rows have been stripped from the persisted
      // JSON (DB-vs-JSON divergence). Closes Amsterdam/Osaka Day-3 leak.
      if (/\b(?:check[-\s]?out|checkout)\b/i.test(title)) return true;
      return false;
    });
  let departureDayIdx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (dayHasDepartureTerminal(result[i]?.activities || [])) {
      departureDayIdx = i;
      break;
    }
  }
  // Belt-and-braces: every multi-day trip has a departure day. If neither an
  // airport transfer / flight nor a checkout survived into the JSON, treat the
  // last day as departure so we don't fabricate a "wind down (overnight)" card.
  if (departureDayIdx === -1 && result.length > 1) {
    departureDayIdx = result.length - 1;
    // eslint-disable-next-line no-console
    console.log(`[BOOKEND_TRACE] day=${departureDayIdx + 1} site=parse action=fallback reason=last_day_departure_default`);
  }
  // Step 4b-pre: STRIP any persisted hotel-return / "wind down at hotel"
  // cards from the detected departure day. The traveler is leaving the city —
  // a "Return to {hotel}" / "Head back to … wind down (overnight)" row after
  // the airport transfer (or anywhere on departure day) is always wrong.
  // ensureHotelReturnBookend prevents NEW injections on departure days but
  // cannot remove rows already persisted to DB by earlier broken passes.
  // This is the closure for the recurring Osaka / Amsterdam / Sapporo leak.
  // Locked / user / manual / extracted / pinned rows are NEVER stripped.
  if (departureDayIdx >= 0 && result[departureDayIdx]) {
    const dayActs = result[departureDayIdx].activities || [];
    const isProtected = (a: any): boolean => {
      if (!a) return false;
      if (a.is_locked === true || a.isLocked === true || a.locked === true) return true;
      if (a.lock_state === 'locked') return true;
      const src = String(a.source || '').toLowerCase();
      return ['user', 'manual', 'extracted', 'pinned'].includes(src);
    };
    const RETURN_VERB_RE =
      /\b(?:return\s+to|back\s+(?:to|at)|head\s+back\s+to|wind\s+down\s+at|retire\s+to|end\s+of\s+day\s+at)\b/i;
    const HOTEL_NOUN_RE =
      /\b(?:hotel|hostel|inn|resort|lodge|ryokan|riad|marriott|hilton|hyatt|ritz|four\s*seasons|st\.?\s*regis|peninsula|aman|belmond|cipriani|gritti|danieli|kempinski|rosewood|mandarin|raffles|bvlgari|bulgari|conrad|edition|sofitel|fairmont|shangri|intercontinental|westin|sheraton|nobu|your\s+hotel)\b/i;
    const WIND_DOWN_OVERNIGHT_RE = /wind\s+down\s+\(overnight\)/i;
    const isStrippableHotelReturn = (a: any): boolean => {
      if (!a || isProtected(a)) return false;
      const src = String(a.source || '').toLowerCase();
      const tags: string[] = Array.isArray(a.tags) ? a.tags.map((t: any) => String(t).toLowerCase()) : [];
      // Synthetic bookend rows always strippable on departure day.
      if (/^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i.test(src)) return true;
      if (tags.some((t) => /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i.test(t))) return true;
      if (typeof a.id === 'string' && /^bookend-readtime-/.test(a.id)) return true;
      const title = String(a.title || a.name || '');
      const cat = String(a.category || '').toUpperCase();
      const desc = String(a.description || '');
      // Real "Return to {hotel}" accommodation row.
      if ((cat === 'STAY' || cat === 'ACCOMMODATION') && RETURN_VERB_RE.test(title) && !/check[-\s]?out/i.test(title)) {
        return true;
      }
      // Title carries the verb + a hotel noun/brand (catches mis-categorized rows).
      if (RETURN_VERB_RE.test(title) && HOTEL_NOUN_RE.test(title)) return true;
      // The exact "wind down (overnight)" description shape from bookend-overnight.
      if (WIND_DOWN_OVERNIGHT_RE.test(desc)) return true;
      return false;
    };
    const before = dayActs.length;
    const filtered = dayActs.filter((a) => !isStrippableHotelReturn(a));
    if (filtered.length !== before) {
      const dropped = dayActs.filter(isStrippableHotelReturn).map((a: any) => a?.title || a?.name || '(unnamed)');
      console.warn(`[itineraryParser] Stripped ${before - filtered.length} departure-day hotel-return card(s) on day ${departureDayIdx + 1}: ${dropped.join(' | ')}`);
      console.log(`[BOOKEND_TRACE] day=${departureDayIdx + 1} site=parse action=stripped_departure_day count=${before - filtered.length}`);
      result[departureDayIdx] = { ...result[departureDayIdx], activities: filtered };
    }

    // Step 4b-pre-2: STRIP untimed non-logistics, non-locked, non-userAdded
    // cards from the departure day. A real restaurant with no startTime
    // sorts after every timed card via dayChronoKey and surfaces as a
    // "floating Lunch" after the airport transfer. Mirrors server §15z.
    // Pure UI strip — never written to DB.
    // See mem://constraints/itinerary/departure-day-untimed-defense.
    try {
      const currentActs = result[departureDayIdx].activities || [];
      const { activities: keptActs, droppedTitles } = pruneDepartureUntimed(currentActs);
      if (droppedTitles.length > 0) {
        console.warn(
          `[itineraryParser] departure-day untimed strip day=${departureDayIdx + 1} count=${droppedTitles.length} titles=${droppedTitles.join(' | ')}`,
        );
        console.log(`[BOOKEND_TRACE] day=${departureDayIdx + 1} site=parse action=stripped_departure_untimed count=${droppedTitles.length}`);
        result[departureDayIdx] = { ...result[departureDayIdx], activities: keptActs };
      }
    } catch (pruneErr) {
      console.warn('[itineraryParser] departure-day untimed strip failed (continuing):', pruneErr);
    }
  }

  for (let i = 0; i < result.length; i++) {
    const withBookend = ensureHotelReturnBookend(result[i].activities, {
      isDepartureDay: i === departureDayIdx,
      allTripActivities,
      dayIndex: i,
    });
    if (withBookend !== result[i].activities) {
      result[i] = { ...result[i], activities: withBookend as any };
    }
  }

  // Step 5: Day-count mismatch detection (diagnostic only, skip for partial/in-progress data)
  if (tripStartDate && tripEndDate && !options?.partial) {
    try {
      const start = new Date(tripStartDate + 'T00:00:00');
      const end = new Date(tripEndDate + 'T00:00:00');
      const expectedDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      if (expectedDays > 0 && result.length !== expectedDays) {
        console.warn(`[itineraryParser] Day count mismatch: parsed ${result.length} days but trip dates (${tripStartDate} to ${tripEndDate}) imply ${expectedDays} days`);
      }
    } catch {
      // Ignore date parsing errors in diagnostic code
    }
  }

  // Bruges meal-loss telemetry: compare raw dining count to result dining
  // count. Any diff means a dedup or ghost filter dropped a meal — loud warn
  // so a future regression is caught in browser console immediately.
  try {
    const countDining = (acts: any[]) =>
      (acts || []).filter((a: any) =>
        DINING_DAY_CAT_RE.test(String(a?.category || '')) ||
        DINING_DAY_CAT_RE.test(String(a?.title || ''))
      ).length;
    const rawDining = parsedDays.reduce((sum, d) => sum + countDining(d.activities || []), 0);
    const resultDining = result.reduce((sum, d) => sum + countDining(d.activities || []), 0);
    console.debug(`[itineraryParser] raw_days=${parsedDays.length} result_days=${result.length} raw_dining=${rawDining} result_dining=${resultDining}`);
    if (resultDining < rawDining) {
      console.warn(`[itineraryParser] DINING DROP: ${rawDining - resultDining} dining card(s) lost between raw (${rawDining}) and result (${resultDining}) — investigate dedup/ghost filters`);
    }
  } catch { /* telemetry only */ }

  return result;
}

/**
 * Parse itinerary for ActiveTrip component
 * Returns format compatible with ActiveTrip's ItineraryDay interface
 */
export function parseActiveTripDays(
  rawData: unknown,
  tripStartDate?: string
): ActiveTripDay[] {
  const days = parseItineraryDays(rawData, tripStartDate);
  
  return days.map(day => ({
    dayNumber: day.dayNumber,
    date: day.date,
    theme: day.theme,
    description: day.description,
    activities: day.activities.map(a => ({
      id: a.id,
      name: a.name,
      description: a.description,
      type: a.type,
      category: a.category,
      startTime: a.startTime,
      endTime: a.endTime,
      duration: a.durationMinutes,
      location: a.location,
      imageUrl: a.imageUrl,
      tips: Array.isArray(a.tips) ? a.tips : a.tips ? [a.tips] : undefined,
      confirmationNumber: a.confirmationNumber,
      voucherUrl: a.voucherUrl,
      bookingRequired: a.bookingRequired,
      reservationTime: a.reservationTime,
      transportationMethod: a.transportation?.method,
    })),
    weather: day.weather,
  }));
}

/**
 * Parse itinerary for EditorialItinerary component
 * Returns format compatible with EditorialDay interface
 */
export function parseEditorialDays(
  rawData: unknown,
  tripStartDate?: string,
  tripEndDate?: string,
  options?: { partial?: boolean }
): EditorialParsedDay[] {
  const days = parseItineraryDays(rawData, tripStartDate, tripEndDate, options);
  
  return days.map(day => ({
    ...day,
    activities: day.activities.map(a => ({
      ...a,
      // Ensure location has the expected shape
      location: a.location ? {
        name: a.location.name,
        address: a.location.address,
      } : undefined,
    })),
  }));
}

/**
 * Parse itinerary for ItineraryAssistant component
 * Returns format compatible with assistant's expected day shape
 */
export function parseAssistantDays(
  rawData: unknown,
  tripStartDate?: string
): AssistantParsedDay[] {
  const days = parseItineraryDays(rawData, tripStartDate);
  
  return days.map(day => ({
    ...day, // Preserve ALL day fields (theme, weather, etc.)
    dayNumber: day.dayNumber,
    date: day.date,
    theme: day.theme,
    description: day.description,
    activities: day.activities.map(a => ({
      ...a, // Preserve ALL activity fields (tips, transportation, timeBlockType, etc.)
      id: a.id,
      title: a.title,
      name: a.name,
      category: a.category,
      startTime: a.startTime || a.time || '',
      time: a.time || a.startTime || '',
      cost: a.cost ? { amount: a.cost.amount } : undefined,
      isLocked: a.isLocked,
      description: a.description,
      location: a.location ? {
        name: a.location.name,
        address: a.location.address,
      } : undefined,
    })),
  }));
}

/**
 * Check if raw data has valid itinerary days
 */
export function hasValidItinerary(rawData: unknown): boolean {
  if (!rawData || typeof rawData !== 'object') return false;
  const data = rawData as Record<string, unknown>;
  // Check canonical top-level days, then nested itinerary.days fallback
  const rawDays = data.days || (data.itinerary as Record<string, unknown> | undefined)?.days;
  return Array.isArray(rawDays) && rawDays.length > 0;
}

/**
 * Type guard for valid itinerary data structure
 */
export function isValidItineraryData(
  rawData: unknown
): rawData is { days: unknown[] } {
  if (!rawData || typeof rawData !== 'object') return false;
  const data = rawData as Record<string, unknown>;
  const rawDays = data.days || (data.itinerary as Record<string, unknown> | undefined)?.days;
  return Array.isArray(rawDays);
}
