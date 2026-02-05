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
      return val.trim();
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
  if (!raw) return undefined;
  
  if (typeof raw === 'number') {
    return { amount: raw };
  }
  
  if (typeof raw === 'object' && raw !== null) {
    const cost = raw as Record<string, unknown>;
    return {
      amount: extractNumber(cost, ['amount', 'value', 'price']),
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
  const a = asRecord(raw);
  
  // Generate stable ID - no Math.random()!
  const id = extractString(a, ['id']) || `day${dayIndex + 1}-act${activityIndex}`;
  const title = extractString(a, ['title', 'name']) || 'Untitled Activity';
  
  return {
    id,
    title,
    name: title, // Alias for backwards compatibility
    description: extractString(a, ['description']),
    type: extractString(a, ['type']),
    category: extractString(a, ['category']),
    startTime: extractString(a, ['startTime', 'start_time', 'time']),
    endTime: extractString(a, ['endTime', 'end_time']),
    time: extractString(a, ['time', 'startTime', 'start_time']),
    duration: extractString(a, ['duration']),
    durationMinutes: extractNumber(a, ['durationMinutes', 'duration_minutes']),
    location: parseLocation(a.location),
    imageUrl: extractString(a, ['imageUrl', 'image_url', 'image']),
    tips: a.tips as string | string[] | undefined,
    confirmationNumber: extractString(a, ['confirmationNumber', 'confirmation_number']),
    voucherUrl: extractString(a, ['voucherUrl', 'voucher_url']),
    bookingRequired: extractBoolean(a, ['bookingRequired', 'booking_required']),
    reservationTime: extractString(a, ['reservationTime', 'reservation_time']),
    cost: parseCost(a.cost || a.estimatedCost || a.estimated_cost),
    estimatedCost: parseCost(a.estimatedCost || a.estimated_cost || a.cost),
    transportation: parseTransportation(a.transportation),
    isLocked: extractBoolean(a, ['isLocked', 'is_locked', 'locked']),
    rating: parseRating(a.rating),
    website: extractString(a, ['website', 'url']),
    photos: a.photos as Array<{ url: string } | string> | undefined,
    tags: Array.isArray(a.tags) ? a.tags.filter((t): t is string => typeof t === 'string') : [],
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
  const d = asRecord(raw);
  
  const dayNumber = extractNumber(d, ['dayNumber', 'day_number', 'day']) ?? dayIndex + 1;
  
  // Get activities array safely
  const rawActivities = Array.isArray(d.activities) ? d.activities : [];
  
  // Filter null/undefined activities BEFORE mapping
  const activities = rawActivities
    .filter((a): a is NonNullable<typeof a> => {
      if (a === null || a === undefined) {
        console.warn(`[itineraryParser] Day ${dayNumber}: Skipping null/undefined activity`);
        return false;
      }
      return true;
    })
    .map((a, actIdx) => parseSingleActivity(a, dayIndex, actIdx));
  
  return {
    dayNumber,
    date: extractString(d, ['date']) || calculateDayDate(tripStartDate, dayIndex),
    title: extractString(d, ['title', 'theme']),
    theme: extractString(d, ['theme', 'title']),
    description: extractString(d, ['description']),
    estimatedWalkingTime: extractString(d, ['estimatedWalkingTime', 'estimated_walking_time']),
    estimatedDistance: extractString(d, ['estimatedDistance', 'estimated_distance']),
    activities,
    weather: parseWeather(d.weather),
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
  tripStartDate?: string
): ParsedDay[] {
  // Validate top-level structure
  if (!rawData || typeof rawData !== 'object') {
    if (rawData !== null && rawData !== undefined) {
      console.warn('[itineraryParser] Invalid itinerary data type:', typeof rawData);
    }
    return [];
  }
  
  const data = rawData as Record<string, unknown>;
  const rawDays = data.days;
  
  if (!Array.isArray(rawDays)) {
    if (rawDays !== null && rawDays !== undefined) {
      console.warn('[itineraryParser] days is not an array:', typeof rawDays);
    }
    return [];
  }
  
  // Filter null/undefined days BEFORE mapping
  return rawDays
    .filter((day, idx): day is NonNullable<typeof day> => {
      if (day === null || day === undefined) {
        console.warn(`[itineraryParser] Skipping null/undefined day at index ${idx}`);
        return false;
      }
      return true;
    })
    .map((day, idx) => parseSingleDay(day, idx, tripStartDate));
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
  tripStartDate?: string
): EditorialParsedDay[] {
  const days = parseItineraryDays(rawData, tripStartDate);
  
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
    dayNumber: day.dayNumber,
    date: day.date,
    theme: day.theme,
    description: day.description,
    activities: day.activities.map(a => ({
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
  const rawDays = data.days;
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
  return Array.isArray(data.days);
}
