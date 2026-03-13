/**
 * Inject Hotel Check-in/Check-out Activities into Itinerary Days
 * 
 * When a hotel is saved, this utility builds check-in and check-out activities
 * and injects them into the correct days of the itinerary.
 */

import type { EditorialDay, EditorialActivity, HotelSelection, CityHotelInfo } from '@/components/itinerary/EditorialItinerary';
import type { HotelBooking } from '@/utils/hotelValidation';

// Deterministic IDs so re-saves replace rather than duplicate
function checkinId(hotelId: string) {
  return `hotel-checkin-${hotelId}`;
}
function checkoutId(hotelId: string) {
  return `hotel-checkout-${hotelId}`;
}

interface HotelForInjection {
  id: string;
  name: string;
  address?: string;
  checkInDate?: string;   // YYYY-MM-DD
  checkOutDate?: string;  // YYYY-MM-DD
  checkInTime?: string;   // HH:MM
  checkOutTime?: string;  // HH:MM
  imageUrl?: string;
  images?: string[];
  neighborhood?: string;
  coordinates?: { lat: number; lng: number };
}

function buildCheckInActivity(hotel: HotelForInjection, dayActivities?: EditorialActivity[]): EditorialActivity {
  const photo = hotel.imageUrl || hotel.images?.[0];

  // Determine check-in time: use hotel's check-in time, but if the day has an
  // all-day event or activity running past the default, push check-in to after it ends
  let checkInTime = hotel.checkInTime || '15:00';

  if (dayActivities && dayActivities.length > 0) {
    const checkInMinutes = timeToMinutes(checkInTime);

    // Find the latest-ending non-transport, non-accommodation activity
    let latestEnd = 0;
    for (const act of dayActivities) {
      const cat = (act.category || '').toLowerCase();
      if (cat === 'transport' || cat === 'transportation' || cat === 'transit' || cat === 'accommodation') continue;
      const startMin = timeToMinutes(act.startTime);
      const durMin = act.durationMinutes || 120;
      const endMin = startMin + durMin;
      if (endMin > latestEnd) latestEnd = endMin;
    }

    // If the latest activity ends AFTER the default check-in time,
    // push check-in to 30 min after (to allow for transit)
    if (latestEnd > checkInMinutes) {
      const lateHour = Math.floor((latestEnd + 30) / 60);
      const lateMin = (latestEnd + 30) % 60;
      checkInTime = `${String(lateHour).padStart(2, '0')}:${String(lateMin).padStart(2, '0')}`;
    }
  }

  return {
    id: checkinId(hotel.id),
    title: `Check-in at ${hotel.name}`,
    description: `Arrive and check in to your accommodation${hotel.neighborhood ? ` in ${hotel.neighborhood}` : ''}.`,
    startTime: checkInTime,
    duration: '30 min',
    durationMinutes: 30,
    category: 'accommodation',
    type: 'accommodation',
    location: {
      name: hotel.name,
      address: hotel.address || '',
      ...(hotel.coordinates ? { lat: hotel.coordinates.lat, lng: hotel.coordinates.lng } : {}),
    },
    photos: photo ? [{ url: photo }] : undefined,
    isLocked: false,
    tags: ['check-in', 'structural'],
    cost: { amount: 0, currency: 'USD' },
  };
}

function buildCheckOutActivity(hotel: HotelForInjection): EditorialActivity {
  const photo = hotel.imageUrl || hotel.images?.[0];
  return {
    id: checkoutId(hotel.id),
    title: `Check-out from ${hotel.name}`,
    description: 'Check out and store luggage if needed before continuing your day.',
    startTime: hotel.checkOutTime || '11:00',
    duration: '30 min',
    durationMinutes: 30,
    category: 'accommodation',
    type: 'accommodation',
    location: {
      name: hotel.name,
      address: hotel.address || '',
      ...(hotel.coordinates ? { lat: hotel.coordinates.lat, lng: hotel.coordinates.lng } : {}),
    },
    photos: photo ? [{ url: photo }] : undefined,
    isLocked: false,
    tags: ['check-out', 'structural'],
    cost: { amount: 0, currency: 'USD' },
  };
}

/** Parse time string "HH:MM" or "H:MM AM/PM" to minutes since midnight */
function timeToMinutes(t?: string): number {
  if (!t) return 0;
  const normalized = t.trim().toUpperCase();
  const m12 = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m12) return 0;
  let h = parseInt(m12[1], 10);
  const min = parseInt(m12[2], 10);
  if (m12[3] === 'PM' && h !== 12) h += 12;
  if (m12[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

/** Check if an activity is a late check-in (after 17:00 or tagged 'late-checkin') */
function isLateCheckin(a: EditorialActivity): boolean {
  if (a.tags?.includes('late-checkin')) return true;
  if (
    a.category === 'accommodation' &&
    a.title?.toLowerCase().includes('check-in') &&
    timeToMinutes(a.startTime) >= 17 * 60
  ) return true;
  return false;
}

/** Check if an activity is an AI-generated checkout (not from deterministic injection) */
function isAIGeneratedCheckout(a: EditorialActivity): boolean {
  // Deterministic IDs start with 'hotel-checkout-'
  if (a.id.startsWith('hotel-checkout-')) return false;
  const t = (a.title || '').toLowerCase();
  return (
    a.category === 'accommodation' &&
    (t.includes('check-out') || t.includes('checkout'))
  );
}

/** Remove any existing hotel check-in/check-out activities from all days,
 *  but preserve AI-generated late check-ins and AI-generated checkouts on the last day. */
function stripExistingHotelActivities(days: EditorialDay[], preserveCheckoutOnLastDay = false): EditorialDay[] {
  const lastDayIdx = days.length - 1;
  return days.map((day, dayIdx) => ({
    ...day,
    activities: day.activities.filter(a => {
      // Always remove deterministic hotel IDs (they'll be re-injected)
      if (a.id.startsWith('hotel-checkin-') || a.id.startsWith('hotel-checkout-')) return false;
      // Preserve late check-ins generated by the AI
      if (isLateCheckin(a)) return true;
      // Preserve AI-generated checkouts on the last day (they have flight-aware timing)
      if (preserveCheckoutOnLastDay && dayIdx === lastDayIdx && isAIGeneratedCheckout(a)) return true;
      // Remove other AI-generated accommodation check-in/out activities
      if (
        a.category === 'accommodation' &&
        (a.title?.toLowerCase().includes('check-in') || a.title?.toLowerCase().includes('check-out') || a.title?.toLowerCase().includes('checkout'))
      ) return false;
      return true;
    }),
  }));
}

/** Insert activity into the correct time-ordered position */
function insertChronologically(activities: EditorialActivity[], newActivity: EditorialActivity): EditorialActivity[] {
  const newMinutes = timeToMinutes(newActivity.startTime);
  const result = [...activities];
  let insertIdx = result.length;
  for (let i = 0; i < result.length; i++) {
    const aMin = timeToMinutes(result[i].startTime);
    if (newMinutes <= aMin) {
      insertIdx = i;
      break;
    }
  }
  result.splice(insertIdx, 0, newActivity);
  return result;
}

/** Find the day index matching a date string (YYYY-MM-DD). Falls back to first/last day. */
function findDayIndex(days: EditorialDay[], dateStr?: string, fallbackFirst = true): number {
  if (dateStr && days.length > 0) {
    const norm = dateStr.slice(0, 10); // YYYY-MM-DD
    const idx = days.findIndex(d => d.date?.slice(0, 10) === norm);
    if (idx >= 0) return idx;
  }
  return fallbackFirst ? 0 : days.length - 1;
}

/**
 * Normalize various hotel data shapes into HotelForInjection.
 */
function normalizeHotel(
  hotel: HotelSelection | HotelBooking | CityHotelInfo | Record<string, any>
): HotelForInjection | null {
  // CityHotelInfo wraps hotel inside .hotel; cast to any for flexible property access
  const raw = hotel as any;
  const inner: any = raw.hotel || raw;
  if (!inner || !inner.name) return null;
  
  return {
    id: inner.id || inner.placeId || inner.name.replace(/\s+/g, '-').toLowerCase().slice(0, 40),
    name: inner.name,
    address: inner.address,
    checkInDate: inner.checkInDate || inner.checkIn,
    checkOutDate: inner.checkOutDate || inner.checkOut,
    checkInTime: inner.checkInTime || '15:00',
    checkOutTime: inner.checkOutTime || '11:00',
    imageUrl: inner.imageUrl,
    images: inner.images,
    neighborhood: inner.neighborhood,
    coordinates: inner.coordinates,
  };
}

/**
 * Check if a day already has a checkout activity (AI-generated or otherwise).
 */
function dayHasCheckout(day: EditorialDay): boolean {
  return day.activities.some(a => {
    const t = (a.title || '').toLowerCase();
    return (
      a.category === 'accommodation' &&
      (t.includes('check-out') || t.includes('checkout'))
    );
  });
}

/**
 * Main injection function.
 * Takes current days + hotel data, returns updated days with check-in/check-out activities.
 * This is idempotent — running multiple times with the same hotel produces the same result.
 */
export function injectHotelActivitiesIntoDays(
  days: EditorialDay[],
  hotelData: HotelSelection | HotelBooking | CityHotelInfo | Record<string, any> | null | undefined,
): EditorialDay[] {
  if (!hotelData || days.length === 0) return days;

  const hotel = normalizeHotel(hotelData);
  if (!hotel) return days;

  // Step 1: Strip existing hotel activities, but preserve AI checkouts on the last day
  let updated = stripExistingHotelActivities(days, true);

  // Step 2: Build and inject check-in on the correct day
  // BUT skip if the day already has a late check-in (AI-generated for event days)
  const checkInDayIdx = findDayIndex(updated, hotel.checkInDate, true);
  const dayHasLateCheckin = updated[checkInDayIdx]?.activities.some(a => isLateCheckin(a));
  if (!dayHasLateCheckin) {
    const dayActivities = updated[checkInDayIdx]?.activities || [];
    const checkInActivity = buildCheckInActivity(hotel, dayActivities);
    updated = updated.map((day, idx) => {
      if (idx !== checkInDayIdx) return day;
      return { ...day, activities: insertChronologically(day.activities, checkInActivity) };
    });
  }

  // Step 3: Build and inject check-out on the correct day
  const checkOutDayIdx = findDayIndex(updated, hotel.checkOutDate, false);
  
  // Skip checkout injection if the day already has an AI-generated checkout (flight-aware timing)
  const checkoutDayAlreadyHasCheckout = dayHasCheckout(updated[checkOutDayIdx]);
  
  if (!checkoutDayAlreadyHasCheckout) {
    // Inject checkout for multi-day trips (different days) OR single-day trips
    if (checkOutDayIdx !== checkInDayIdx || updated.length === 1) {
      const checkOutActivity = buildCheckOutActivity(hotel);
      updated = updated.map((day, idx) => {
        if (idx !== checkOutDayIdx) return day;
        return { ...day, activities: insertChronologically(day.activities, checkOutActivity) };
      });
    }
  }

  return updated;
}

/**
 * Inject hotel activities for multiple hotels (multi-city trips).
 */
export function injectMultiHotelActivities(
  days: EditorialDay[],
  hotels: Array<HotelSelection | HotelBooking | CityHotelInfo | Record<string, any>>,
): EditorialDay[] {
  // For multi-city, preserve AI checkouts on all days that are last-in-city
  let updated = stripExistingHotelActivities(days, true);
  
  for (const hotelData of hotels) {
    const hotel = normalizeHotel(hotelData);
    if (!hotel) continue;

    // Check-in injection
    const checkInDayIdx = findDayIndex(updated, hotel.checkInDate, true);
    const dayHasLateCheckinFlag = updated[checkInDayIdx]?.activities.some(a => isLateCheckin(a));
    if (!dayHasLateCheckinFlag) {
      const dayActivities = updated[checkInDayIdx]?.activities || [];
      const checkInActivity = buildCheckInActivity(hotel, dayActivities);
      updated = updated.map((day, idx) => {
        if (idx !== checkInDayIdx) return day;
        return { ...day, activities: insertChronologically(day.activities, checkInActivity) };
      });
    }

    // Check-out injection
    const checkOutDayIdx = findDayIndex(updated, hotel.checkOutDate, false);
    
    // Skip if this day already has a checkout (AI-generated with proper timing)
    if (!dayHasCheckout(updated[checkOutDayIdx])) {
      if (checkOutDayIdx !== checkInDayIdx) {
        const checkOutActivity = buildCheckOutActivity(hotel);
        updated = updated.map((day, idx) => {
          if (idx !== checkOutDayIdx) return day;
          return { ...day, activities: insertChronologically(day.activities, checkOutActivity) };
        });
      }
    }
  }
  return updated;
}
