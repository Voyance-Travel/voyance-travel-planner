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

// Strip non-Latin scripts from AI text artifacts before rendering
const NON_LATIN_SCRIPT = /[\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF\u0600-\u06FF\u0400-\u04FF\u0E00-\u0E7F]+/g;

// Strip leaked JSON schema field names from AI text (e.g. ",title: -", "practicalTips;|")
const SCHEMA_LEAK_RE = /[,;|]*\s*(?:title|name|duration|practicalTips|accommodationNotes|tripVibe|tripPriorities|theme|dayNumber|activities|unparsed|dates|travelers|tripType|startTime|endTime|category|description|location|tags|bookingRequired|transportation|cost|estimatedCost|metadata|narrative|highlights|city|country|isTransitionDay)\s*[:;|]\s*[^,;|]*/gi;

function sanitizeDisplayString(value: string | undefined | null): string | undefined {
  if (!value) return undefined;
  const cleaned = value
    .replace(NON_LATIN_SCRIPT, '')
    .replace(SCHEMA_LEAK_RE, '')
    .replace(/—/g, ' - ')
    .replace(/–/g, '-')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,;|:\s-]+|[,;|:\s-]+$/g, '')
    .trim();
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
    startTime: extractString(activityData, ['startTime', 'start_time', 'time']),
    endTime: extractString(activityData, ['endTime', 'end_time']),
    time: extractString(activityData, ['time', 'startTime', 'start_time']),
    duration: extractString(activityData, ['duration']),
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

  // Deduplicate activities by title+startTime within the same day
  const seen = new Set<string>();
  const activities = parsedActivities.filter(act => {
    const key = `${(act.title || '').toLowerCase().trim()}|${(act.startTime || '').trim()}`;
    if (seen.has(key)) {
      console.warn(`[itineraryParser] Day ${dayNumber}: Removing duplicate activity "${act.title}"`);
      return false;
    }
    seen.add(key);
    return true;
  });
  
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
  tripEndDate?: string
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
  
  // Step 1: Deduplicate by dayNumber — keep entry with more activities
  const byDayNumber = new Map<number, ParsedDay>();
  for (const day of parsedDays) {
    const existing = byDayNumber.get(day.dayNumber);
    if (!existing || (day.activities?.length || 0) > (existing.activities?.length || 0)) {
      byDayNumber.set(day.dayNumber, day);
    }
  }
  let deduped = Array.from(byDayNumber.values());
  
  // Step 2: Deduplicate by date — if two days share the same date, keep the one with more activities
  const byDate = new Map<string, ParsedDay>();
  for (const day of deduped) {
    const dateKey = day.date || `fallback-day-${day.dayNumber}`;
    const existing = byDate.get(dateKey);
    if (!existing || (day.activities?.length || 0) > (existing.activities?.length || 0)) {
      byDate.set(dateKey, day);
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
  
  // Step 4: Re-assign sequential dayNumbers and authoritative dates
  const result = deduped.map((day, idx) => ({
    ...day,
    dayNumber: idx + 1,
    date: calculateDayDate(tripStartDate, idx) || day.date,
  }));

  // Step 5: Day-count mismatch detection (diagnostic only)
  if (tripStartDate && tripEndDate) {
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
  tripEndDate?: string
): EditorialParsedDay[] {
  const days = parseItineraryDays(rawData, tripStartDate, tripEndDate);
  
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
