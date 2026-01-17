import type { Destination } from '@/lib/destinations';
import type { ItineraryItem, ItineraryDay } from '@/lib/trips';

/**
 * Type guard for Destination objects
 */
export const isDestination = (obj: unknown): obj is Destination => {
  return Boolean(
    obj && 
    typeof obj === 'object' && 
    obj !== null && 
    'city' in obj && 
    'country' in obj &&
    typeof (obj as Record<string, unknown>).city === 'string' && 
    typeof (obj as Record<string, unknown>).country === 'string'
  );
};

/**
 * Type guard for objects with review data
 */
export const hasReviewData = (
  obj: unknown
): obj is { reviewData: { averageRating: number; totalReviews: number } } => {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const data = obj as Record<string, unknown>;
  return Boolean(
    data.reviewData && 
    typeof data.reviewData === 'object' && 
    data.reviewData !== null &&
    typeof (data.reviewData as Record<string, unknown>).averageRating === 'number'
  );
};

/**
 * Type guard for objects with location data
 */
export const hasLocation = (
  obj: unknown
): obj is { location: { city: string; country: string } } => {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const data = obj as Record<string, unknown>;
  return Boolean(
    data.location && 
    typeof data.location === 'object' && 
    data.location !== null &&
    typeof (data.location as Record<string, unknown>).city === 'string'
  );
};

/**
 * Type guard for valid itinerary items
 */
export const isValidItineraryItem = (obj: unknown): obj is ItineraryItem => {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const data = obj as Record<string, unknown>;
  return Boolean(
    typeof data.id === 'string' && 
    typeof data.title === 'string' && 
    typeof data.type === 'string'
  );
};

/**
 * Type guard for valid itinerary day
 */
export const isValidItineraryDay = (obj: unknown): obj is ItineraryDay => {
  if (!obj || typeof obj !== 'object' || obj === null) return false;
  const data = obj as Record<string, unknown>;
  return Boolean(
    typeof data.id === 'string' && 
    typeof data.dayNumber === 'number' &&
    Array.isArray(data.items)
  );
};
