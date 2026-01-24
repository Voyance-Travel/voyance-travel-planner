/**
 * Hotel Validation Utilities
 * 
 * Handles validation for multi-hotel bookings including date overlap detection.
 */

import { isBefore, isAfter, parseISO, isSameDay } from 'date-fns';

export interface HotelBooking {
  id: string;
  name: string;
  address?: string;
  neighborhood?: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  checkInTime?: string;
  checkOutTime?: string;
  website?: string;
  googleMapsUrl?: string;
  images?: string[];
  imageUrl?: string;
  placeId?: string;
  rating?: number;
  isManualEntry?: boolean;
  isEnriched?: boolean;
}

/**
 * Check if two date ranges overlap
 * Note: Check-out on the same day as another check-in is allowed (standard hotel behavior)
 */
export function datesOverlap(
  checkIn1: string,
  checkOut1: string,
  checkIn2: string,
  checkOut2: string
): boolean {
  const start1 = parseISO(checkIn1);
  const end1 = parseISO(checkOut1);
  const start2 = parseISO(checkIn2);
  const end2 = parseISO(checkOut2);

  // Allow same-day checkout/checkin (end1 === start2 or end2 === start1 is OK)
  // Overlap occurs when: start1 < end2 AND start2 < end1
  // But we exclude the edge case where they just touch
  
  // Overlaps if one starts before the other ends (excluding exact touch points)
  const overlaps = isBefore(start1, end2) && isBefore(start2, end1) &&
                   !isSameDay(end1, start2) && !isSameDay(end2, start1);
  
  return overlaps;
}

/**
 * Check if a new hotel booking overlaps with existing bookings
 * Returns the conflicting hotel if there's an overlap, null otherwise
 */
export function findOverlappingHotel(
  newCheckIn: string,
  newCheckOut: string,
  existingHotels: HotelBooking[],
  excludeId?: string
): HotelBooking | null {
  for (const hotel of existingHotels) {
    // Skip the hotel being edited
    if (excludeId && hotel.id === excludeId) continue;
    
    if (datesOverlap(newCheckIn, newCheckOut, hotel.checkInDate, hotel.checkOutDate)) {
      return hotel;
    }
  }
  return null;
}

/**
 * Validate that check-out is after check-in
 */
export function isValidDateRange(checkIn: string, checkOut: string): boolean {
  const start = parseISO(checkIn);
  const end = parseISO(checkOut);
  return isAfter(end, start);
}

/**
 * Sort hotels by check-in date (ascending)
 */
export function sortHotelsByDate(hotels: HotelBooking[]): HotelBooking[] {
  return [...hotels].sort((a, b) => {
    const dateA = parseISO(a.checkInDate);
    const dateB = parseISO(b.checkInDate);
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Convert legacy single hotel object to array format
 */
export function normalizeLegacyHotelSelection(
  selection: unknown,
  tripStartDate: string,
  tripEndDate: string
): HotelBooking[] {
  if (!selection) return [];
  
  // Already an array
  if (Array.isArray(selection)) {
    return selection as HotelBooking[];
  }
  
  // Legacy single object format - convert to array
  const legacy = selection as Record<string, unknown>;
  if (legacy.name) {
    return [{
      id: (legacy.id as string) || `migrated-${Date.now()}`,
      name: legacy.name as string,
      address: legacy.address as string | undefined,
      neighborhood: legacy.neighborhood as string | undefined,
      checkInDate: (legacy.checkInDate as string) || tripStartDate,
      checkOutDate: (legacy.checkOutDate as string) || tripEndDate,
      checkInTime: (legacy.checkIn as string) || (legacy.checkInTime as string),
      checkOutTime: (legacy.checkOut as string) || (legacy.checkOutTime as string),
      website: legacy.website as string | undefined,
      googleMapsUrl: legacy.googleMapsUrl as string | undefined,
      images: legacy.images as string[] | undefined,
      imageUrl: legacy.imageUrl as string | undefined,
      placeId: legacy.placeId as string | undefined,
      rating: legacy.rating as number | undefined,
      isManualEntry: legacy.isManualEntry as boolean | undefined,
      isEnriched: legacy.isEnriched as boolean | undefined,
    }];
  }
  
  return [];
}
