/**
 * Hotel Validation Utilities
 * 
 * Handles validation for multi-hotel bookings including date overlap detection.
 */

import { isBefore, isAfter, isSameDay } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';

export type AccommodationType = 'hotel' | 'airbnb' | 'rental' | 'hostel' | 'other';

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
  /** Type of accommodation: hotel, airbnb, rental, hostel, other */
  accommodationType?: AccommodationType;
  /** Total price for the entire stay in USD */
  totalPrice?: number;
  /** Price per night in USD */
  pricePerNight?: number;
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
  const start1 = parseLocalDate(checkIn1);
  const end1 = parseLocalDate(checkOut1);
  const start2 = parseLocalDate(checkIn2);
  const end2 = parseLocalDate(checkOut2);

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
  const start = parseLocalDate(checkIn);
  const end = parseLocalDate(checkOut);
  return isAfter(end, start);
}

/**
 * Sort hotels by check-in date (ascending)
 */
export function sortHotelsByDate(hotels: HotelBooking[]): HotelBooking[] {
  return [...hotels].sort((a, b) => {
    const dateA = parseLocalDate(a.checkInDate);
    const dateB = parseLocalDate(b.checkInDate);
    return dateA.getTime() - dateB.getTime();
  });
}

/**
 * Check if a string is a valid ISO date format (YYYY-MM-DD)
 * Used to distinguish actual dates from time strings like "3:00 PM"
 */
function isValidISODate(str: unknown): str is string {
  if (typeof str !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(str);
}

/**
 * Normalize a single hotel object to standard HotelBooking format
 * Supports both legacy field names (location, checkIn) and new format (address, checkInDate)
 */
function normalizeHotel(
  hotel: Record<string, unknown>,
  tripStartDate: string,
  tripEndDate: string
): HotelBooking | null {
  if (!hotel.name) return null;
  
  // Determine checkInDate: prefer checkInDate, only use checkIn if it's a valid ISO date
  const checkInDateValue = (hotel.checkInDate as string) || 
    (isValidISODate(hotel.checkIn) ? hotel.checkIn : null) || 
    tripStartDate;
  
  // Determine checkOutDate: prefer checkOutDate, only use checkOut if it's a valid ISO date
  const checkOutDateValue = (hotel.checkOutDate as string) || 
    (isValidISODate(hotel.checkOut) ? hotel.checkOut : null) || 
    tripEndDate;
  
  return {
    id: (hotel.id as string) || `migrated-${Date.now()}`,
    name: hotel.name as string,
    // Support both 'address' and 'location' fields
    address: (hotel.address as string) || (hotel.location as string) || undefined,
    neighborhood: hotel.neighborhood as string | undefined,
    // Use validated date values
    checkInDate: checkInDateValue,
    checkOutDate: checkOutDateValue,
    checkInTime: hotel.checkInTime as string | undefined,
    checkOutTime: hotel.checkOutTime as string | undefined,
    website: hotel.website as string | undefined,
    googleMapsUrl: hotel.googleMapsUrl as string | undefined,
    images: hotel.images as string[] | undefined,
    imageUrl: hotel.imageUrl as string | undefined,
    placeId: hotel.placeId as string | undefined,
    rating: hotel.rating as number | undefined,
    isManualEntry: hotel.isManualEntry as boolean | undefined,
    isEnriched: hotel.isEnriched as boolean | undefined,
    totalPrice: hotel.totalPrice as number | undefined,
    pricePerNight: hotel.pricePerNight as number | undefined,
  };
}

/**
 * Convert legacy single hotel object to array format
 * Also normalizes field names for arrays (handles location→address, checkIn→checkInDate)
 */
export function normalizeLegacyHotelSelection(
  selection: unknown,
  tripStartDate: string,
  tripEndDate: string
): HotelBooking[] {
  if (!selection) return [];
  
  // If already an array, normalize each item to ensure consistent field names
  if (Array.isArray(selection)) {
    return selection
      .map(item => normalizeHotel(item as Record<string, unknown>, tripStartDate, tripEndDate))
      .filter((h): h is HotelBooking => h !== null);
  }
  
  // Legacy single object format - normalize and convert to array
  const normalized = normalizeHotel(selection as Record<string, unknown>, tripStartDate, tripEndDate);
  return normalized ? [normalized] : [];
}
