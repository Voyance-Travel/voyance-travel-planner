/**
 * Trip Persistence Utilities
 * LocalStorage management for trip drafts and user preferences
 */

// Storage keys
const STORAGE_KEYS = {
  CURRENT_TRIP: 'voyance_current_trip',
  TRIP_HISTORY: 'voyance_trip_history',
  TRIP_DRAFTS: 'voyance_trip_drafts',
  HOME_AIRPORT: 'voyance_home_airport',
  USER_PREFERENCES: 'voyance_user_preferences',
  PRICE_LOCK_EXPIRES: 'voyance_price_lock_expires',
} as const;

// Max storage size (5MB limit for localStorage)
const MAX_STORAGE_SIZE = 4 * 1024 * 1024; // 4MB to be safe

export interface TripDraft {
  id?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  departureCity?: string;
  tripType?: string;
  budgetTier?: 'budget' | 'moderate' | 'luxury';
  notes?: string;
  lastUpdated?: string;
  status?: 'draft' | 'planned' | 'booked' | 'paid' | 'completed' | 'cancelled';
  isPaid?: boolean;
}

/**
 * Safely set item with size limit check
 */
function safeSetItem<T>(key: string, value: T): boolean {
  try {
    const serialized = JSON.stringify(value);
    
    // Check if adding this would exceed limit
    if (serialized.length > MAX_STORAGE_SIZE) {
      console.warn(`Storage item too large: ${key}`);
      return false;
    }
    
    localStorage.setItem(key, serialized);
    return true;
  } catch (error) {
    console.error(`Failed to save to localStorage: ${key}`, error);
    return false;
  }
}

/**
 * Safely get item from localStorage
 */
function safeGetItem<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch (error) {
    console.error(`Failed to read from localStorage: ${key}`, error);
    return defaultValue;
  }
}

/**
 * Save current trip draft
 */
export function saveCurrentTrip(tripData: TripDraft): boolean {
  const data = {
    ...tripData,
    id: tripData.id || `trip-${Date.now()}`,
    lastUpdated: new Date().toISOString(),
  };
  return safeSetItem(STORAGE_KEYS.CURRENT_TRIP, data);
}

/**
 * Load current trip draft
 */
export function loadCurrentTrip(): TripDraft | null {
  return safeGetItem<TripDraft | null>(STORAGE_KEYS.CURRENT_TRIP, null);
}

/**
 * Clear current trip draft
 */
export function clearCurrentTrip(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.CURRENT_TRIP);
  } catch (error) {
    console.error('Failed to clear current trip', error);
  }
}

/**
 * Get all saved trip drafts
 */
export function getTripDrafts(): TripDraft[] {
  return safeGetItem<TripDraft[]>(STORAGE_KEYS.TRIP_DRAFTS, []);
}

/**
 * Save a trip draft to the drafts list
 */
export function saveTripDraft(draft: TripDraft): boolean {
  const drafts = getTripDrafts();
  const draftWithMeta = {
    ...draft,
    id: draft.id || `draft-${Date.now()}`,
    lastUpdated: new Date().toISOString(),
  };
  
  // Update existing or add new
  const existingIndex = drafts.findIndex(d => d.id === draftWithMeta.id);
  if (existingIndex >= 0) {
    drafts[existingIndex] = draftWithMeta;
  } else {
    drafts.unshift(draftWithMeta); // Add to beginning
  }
  
  return safeSetItem(STORAGE_KEYS.TRIP_DRAFTS, drafts);
}

/**
 * Delete a specific trip draft by ID
 */
export function deleteTripDraft(draftId: string): boolean {
  try {
    const drafts = getTripDrafts();
    const filtered = drafts.filter(d => d.id !== draftId);
    return safeSetItem(STORAGE_KEYS.TRIP_DRAFTS, filtered);
  } catch (error) {
    console.error('Failed to delete trip draft', error);
    return false;
  }
}

/**
 * Delete old drafts older than specified days (default 30 days)
 * Preserves paid and completed trips
 */
export function deleteOldDrafts(olderThanDays = 30): { deleted: number; remaining: number } {
  try {
    const drafts = getTripDrafts();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const remaining = drafts.filter(draft => {
      // Always preserve paid or completed trips
      if (draft.isPaid) return true;
      if (draft.status === 'paid' || draft.status === 'completed' || draft.status === 'booked') {
        return true;
      }
      
      // Keep drafts without dates
      if (!draft.lastUpdated) return true;
      
      // Only delete old drafts/planned trips
      return new Date(draft.lastUpdated) > cutoffDate;
    });
    
    const deleted = drafts.length - remaining.length;
    safeSetItem(STORAGE_KEYS.TRIP_DRAFTS, remaining);
    
    return { deleted, remaining: remaining.length };
  } catch (error) {
    console.error('Failed to delete old drafts', error);
    return { deleted: 0, remaining: 0 };
  }
}

/**
 * Clear all trip drafts
 */
export function clearAllDrafts(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.TRIP_DRAFTS);
  } catch (error) {
    console.error('Failed to clear drafts', error);
  }
}

/**
 * Set price lock expiry (default 15 minutes)
 */
export function setPriceLockExpiry(durationInSeconds = 900): number {
  const expiryTime = Date.now() + durationInSeconds * 1000;
  try {
    localStorage.setItem(STORAGE_KEYS.PRICE_LOCK_EXPIRES, expiryTime.toString());
  } catch (error) {
    console.error('Failed to set price lock expiry', error);
  }
  return expiryTime;
}

/**
 * Get price lock expiry timestamp
 */
export function getPriceLockExpiry(): number | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.PRICE_LOCK_EXPIRES);
    if (!saved) return null;
    const expiry = parseInt(saved, 10);
    // Return null if expired
    return expiry > Date.now() ? expiry : null;
  } catch {
    return null;
  }
}

/**
 * Check if price lock is active
 */
export function isPriceLockActive(): boolean {
  const expiry = getPriceLockExpiry();
  return expiry !== null && expiry > Date.now();
}

/**
 * Get remaining price lock time in seconds
 */
export function getPriceLockRemaining(): number {
  const expiry = getPriceLockExpiry();
  if (!expiry) return 0;
  return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
}

/**
 * Save home airport
 */
export function saveHomeAirport(airportCode: string): boolean {
  return safeSetItem(STORAGE_KEYS.HOME_AIRPORT, airportCode);
}

/**
 * Get home airport
 */
export function getHomeAirport(): string | null {
  return safeGetItem<string | null>(STORAGE_KEYS.HOME_AIRPORT, null);
}

/**
 * Save user preferences
 */
export function saveUserPreferences<T extends Record<string, unknown>>(preferences: T): boolean {
  return safeSetItem(STORAGE_KEYS.USER_PREFERENCES, preferences);
}

/**
 * Load user preferences
 */
export function loadUserPreferences<T extends Record<string, unknown>>(): T | null {
  return safeGetItem<T | null>(STORAGE_KEYS.USER_PREFERENCES, null);
}

/**
 * Clear all Voyance data from localStorage
 */
export function clearAllVoyanceData(): void {
  try {
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });
  } catch (error) {
    console.error('Failed to clear Voyance data', error);
  }
}
