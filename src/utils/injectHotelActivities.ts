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

function buildCheckInActivity(hotel: HotelForInjection): EditorialActivity {
  const photo = hotel.imageUrl || hotel.images?.[0];
  const checkInTime = hotel.checkInTime || '15:00';

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

/** Convert minutes since midnight back to HH:MM string */
export function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/**
 * After injecting check-in, shift any overlapping or subsequent activities forward.
 * Morning activities (before check-in) are untouched. Activities at or after
 * check-in time get pushed to after the check-in window ends, with cascading.
 */
function adjustActivitiesAroundCheckIn(
  activities: EditorialActivity[],
  checkInTime: string
): EditorialActivity[] {
  const checkInStart = timeToMinutes(checkInTime);
  const checkInEnd = checkInStart + 30; // 30 min check-in window
  const MAX_TIME = 23 * 60; // Don't push past 11 PM

  return activities.map(act => {
    // Don't shift the check-in activity itself
    if (act.id.startsWith('hotel-checkin-')) return act;
    // Don't shift accommodation activities (checkout etc.)
    if (act.category === 'accommodation') return act;

    const actStart = timeToMinutes(act.startTime);

    // Morning activities before check-in — leave untouched
    if (actStart < checkInStart) return act;

    // Activity overlaps with check-in window — shift to after check-in
    if (actStart < checkInEnd) {
      const newStart = Math.min(checkInEnd, MAX_TIME);
      return { ...act, startTime: minutesToTime(newStart) };
    }

    return act;
  }).sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/**
 * Cascade-fix overlapping activities after initial shifts.
 * Ensures a minimum 0-min gap (no overlaps) between consecutive activities.
 */
export function cascadeFixOverlaps(activities: EditorialActivity[]): EditorialActivity[] {
  const MAX_TIME = 23 * 60 + 59; // 23:59
  const STRUCTURAL_TAGS = ['check-out', 'checkout', 'departure', 'structural'];
  const MIN_USEFUL_DURATION = 15;
  const result = [...activities];

  for (let i = 1; i < result.length; i++) {
    const prev = result[i - 1];
    const prevEnd = timeToMinutes(prev.startTime) + (prev.durationMinutes || 30);
    const currStart = timeToMinutes(result[i].startTime);

    if (currStart < prevEnd) {
      const newStart = Math.min(prevEnd, MAX_TIME);
      // Use preserved original duration if activity was already truncated upstream
      const origDuration = (result[i] as any).__originalDurationMinutes || result[i].durationMinutes || 30;
      const newEnd = Math.min(newStart + origDuration, MAX_TIME);
      const actualDuration = newEnd - newStart;
      const wasTruncated = (newStart + origDuration) > MAX_TIME && actualDuration < origDuration;
      const durationStr = actualDuration >= 60
        ? `${Math.floor(actualDuration / 60)} hr${actualDuration % 60 ? ` ${actualDuration % 60} min` : ''}`
        : `${actualDuration} min`;
      result[i] = {
        ...result[i],
        startTime: minutesToTime(newStart),
        endTime: minutesToTime(newEnd),
        durationMinutes: actualDuration,
        duration: durationStr,
        ...(wasTruncated ? {
          __truncatedAtMidnight: true,
          __originalDurationMinutes: origDuration,
        } as any : {}),
      };
    }
  }

  // Second pass: flag ANY activity whose end time is clamped by MAX_TIME
  // (catches non-overlapping activities that naturally extend past midnight)
  for (let i = 0; i < result.length; i++) {
    const act = result[i];
    if ((act as any).__truncatedAtMidnight) continue;
    const start = timeToMinutes(act.startTime);
    // Use preserved original duration if available
    const origDuration = (act as any).__originalDurationMinutes || act.durationMinutes || 30;
    if (start + origDuration > MAX_TIME) {
      const actualDuration = MAX_TIME - start;
      if (actualDuration < origDuration) {
        const durationStr = actualDuration >= 60
          ? `${Math.floor(actualDuration / 60)} hr${actualDuration % 60 ? ` ${actualDuration % 60} min` : ''}`
          : `${actualDuration} min`;
        result[i] = {
          ...result[i],
          endTime: minutesToTime(MAX_TIME),
          durationMinutes: actualDuration,
          duration: durationStr,
          __truncatedAtMidnight: true,
          __originalDurationMinutes: origDuration,
        } as any;
      }
    }
  }

  // Filter out activities that no longer fit in the day
  return result.filter(act => {
    const isStructural = act.tags?.some(t => STRUCTURAL_TAGS.includes(t));
    if (isStructural) return true;
    const start = timeToMinutes(act.startTime);
    const origDuration = (act as any).__originalDurationMinutes || act.durationMinutes || 30;
    const duration = act.durationMinutes || 30;
    const end = Math.min(start + duration, MAX_TIME);
    const actualDuration = end - start;
    // Drop if truncated to less than 50% of original duration
    if ((act as any).__truncatedAtMidnight && actualDuration < origDuration * 0.5) return false;
    // Drop if starts too late or duration too short after clamping
    if (start >= 23 * 60 && actualDuration < MIN_USEFUL_DURATION) return false;
    if (actualDuration < MIN_USEFUL_DURATION && start >= 22 * 60) return false;
    return true;
  });
}

/**
 * Dry-run version of cascadeFixOverlaps.
 * Returns kept, truncated, and dropped activity lists without modifying state.
 * - `kept`: activities that survive fully (or nearly so)
 * - `truncated`: activities that survive but are shortened at midnight
 * - `dropped`: activities that no longer fit
 */
export function previewCascadeOverflow(activities: EditorialActivity[]): {
  kept: EditorialActivity[];
  truncated: EditorialActivity[];
  dropped: EditorialActivity[];
} {
  const survived = cascadeFixOverlaps(activities);
  const survivedIds = new Set(survived.map(a => a.id));
  const dropped = activities.filter(a => !survivedIds.has(a.id));

  // Separate survivors into kept vs truncated
  const kept: EditorialActivity[] = [];
  const truncated: EditorialActivity[] = [];
  for (const a of survived) {
    if ((a as any).__truncatedAtMidnight) {
      truncated.push(a);
    } else {
      kept.push(a);
    }
  }

  return { kept, truncated, dropped };
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
export function timeToMinutes(t?: string): number {
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
    const checkInActivity = buildCheckInActivity(hotel);
    const checkInTime = hotel.checkInTime || '15:00';
    updated = updated.map((day, idx) => {
      if (idx !== checkInDayIdx) return day;
      const withCheckIn = insertChronologically(day.activities, checkInActivity);
      const adjusted = adjustActivitiesAroundCheckIn(withCheckIn, checkInTime);
      const cascaded = cascadeFixOverlaps(adjusted);
      return { ...day, activities: cascaded };
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
 * Build a "Drop bags" activity for hotel transition days.
 */
function buildDropBagsActivity(hotel: HotelForInjection): EditorialActivity {
  const photo = hotel.imageUrl || hotel.images?.[0];
  return {
    id: `hotel-dropbags-${hotel.id}`,
    title: `Drop bags at ${hotel.name}`,
    description: 'Drop off your luggage at the new hotel before check-in time.',
    startTime: '12:00',
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
    tags: ['drop-bags', 'structural'],
    cost: { amount: 0, currency: 'USD' },
  };
}

/**
 * Inject hotel activities for multiple hotels (multi-city trips).
 * Detects transition days (Hotel A checkout + Hotel B check-in) and
 * injects a "Drop bags" card at 12:00 between checkout and check-in.
 */
export function injectMultiHotelActivities(
  days: EditorialDay[],
  hotels: Array<HotelSelection | HotelBooking | CityHotelInfo | Record<string, any>>,
): EditorialDay[] {
  // For multi-city, preserve AI checkouts on all days that are last-in-city
  let updated = stripExistingHotelActivities(days, true);

  // Also strip any previously-injected drop-bags cards
  updated = updated.map(day => ({
    ...day,
    activities: day.activities.filter(a => !a.id.startsWith('hotel-dropbags-')),
  }));
  
  // Normalize all hotels first so we can detect transitions
  const normalizedHotels = hotels.map(h => normalizeHotel(h)).filter((h): h is HotelForInjection => h !== null);

  for (const hotel of normalizedHotels) {
    // Check-in injection
    const checkInDayIdx = findDayIndex(updated, hotel.checkInDate, true);
    const dayHasLateCheckinFlag = updated[checkInDayIdx]?.activities.some(a => isLateCheckin(a));
    if (!dayHasLateCheckinFlag) {
      const checkInActivity = buildCheckInActivity(hotel);
      const checkInTime = hotel.checkInTime || '15:00';
      updated = updated.map((day, idx) => {
        if (idx !== checkInDayIdx) return day;
        const withCheckIn = insertChronologically(day.activities, checkInActivity);
        const adjusted = adjustActivitiesAroundCheckIn(withCheckIn, checkInTime);
        const cascaded = cascadeFixOverlaps(adjusted);
        return { ...day, activities: cascaded };
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

  // Detect transition days and inject "Drop bags" cards
  // A transition day = Hotel A checks out AND Hotel B checks in on the same date
  if (normalizedHotels.length >= 2) {
    for (let i = 0; i < normalizedHotels.length - 1; i++) {
      const hotelA = normalizedHotels[i];
      const hotelB = normalizedHotels[i + 1];
      
      if (!hotelA.checkOutDate || !hotelB.checkInDate) continue;
      if (hotelA.checkOutDate.slice(0, 10) !== hotelB.checkInDate.slice(0, 10)) continue;

      // Same day — this is a transition day
      const transitionDayIdx = findDayIndex(updated, hotelB.checkInDate, true);
      if (transitionDayIdx < 0 || transitionDayIdx >= updated.length) continue;

      const dropBagsCard = buildDropBagsActivity(hotelB);
      updated = updated.map((day, idx) => {
        if (idx !== transitionDayIdx) return day;
        // Only add if not already present
        if (day.activities.some(a => a.id === dropBagsCard.id)) return day;
        const withDropBags = insertChronologically(day.activities, dropBagsCard);
        return { ...day, activities: cascadeFixOverlaps(withDropBags) };
      });
    }
  }

  return updated;
}
