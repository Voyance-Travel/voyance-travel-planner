/**
 * Inject Hotel Check-in/Check-out Activities into Itinerary Days
 * 
 * Uses an UPDATE-IN-PLACE pattern: if an existing placeholder card is found
 * (by category + title match or deterministic ID), it is updated with real
 * hotel data while preserving AI-enriched fields. Only if no placeholder
 * exists is a new card inserted chronologically.
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

// ─── Matchers ────────────────────────────────────────────────────────────────

/** Match an existing check-in placeholder by deterministic ID, category, or title */
function isCheckinPlaceholder(a: EditorialActivity, hotelId?: string): boolean {
  if (hotelId && a.id === checkinId(hotelId)) return true;
  if (a.id.startsWith('hotel-checkin-')) return true;
  const title = (a.title || '').toLowerCase();
  if (a.category === 'accommodation' && title.includes('check-in')) return true;
  if (a.category === 'accommodation' && title.includes('check in')) return true;
  if (a.category === 'accommodation' && title.includes('checkin')) return true;
  return false;
}

/** Match an existing check-out placeholder */
function isCheckoutPlaceholder(a: EditorialActivity, hotelId?: string): boolean {
  if (hotelId && a.id === checkoutId(hotelId)) return true;
  if (a.id.startsWith('hotel-checkout-')) return true;
  const title = (a.title || '').toLowerCase();
  if (a.category === 'accommodation' && (title.includes('check-out') || title.includes('checkout') || title.includes('check out'))) return true;
  return false;
}

// ─── Update-in-Place Helpers ─────────────────────────────────────────────────

/** Merge real hotel data into an existing placeholder, preserving AI-enriched fields */
function mergeCheckinData(existing: EditorialActivity, hotel: HotelForInjection, dayActivities: EditorialActivity[]): EditorialActivity {
  const photo = hotel.imageUrl || hotel.images?.[0];
  let checkInTime = hotel.checkInTime || '15:00';

  // Smart time: push check-in after any late-ending non-transport activity
  if (dayActivities.length > 0) {
    const checkInMinutes = timeToMinutes(checkInTime);
    let latestEnd = 0;
    for (const act of dayActivities) {
      if (act.id === existing.id) continue; // skip self
      const cat = (act.category || '').toLowerCase();
      if (cat === 'transport' || cat === 'transportation' || cat === 'transit' || cat === 'accommodation') continue;
      const startMin = timeToMinutes(act.startTime);
      const durMin = act.durationMinutes || 120;
      const endMin = startMin + durMin;
      if (endMin > latestEnd) latestEnd = endMin;
    }
    if (latestEnd > checkInMinutes) {
      const lateHour = Math.floor((latestEnd + 30) / 60);
      const lateMin = (latestEnd + 30) % 60;
      checkInTime = `${String(lateHour).padStart(2, '0')}:${String(lateMin).padStart(2, '0')}`;
    }
  }

  return {
    ...existing, // Preserve AI-enriched fields: tags, contextualTips, voyanceInsight, etc.
    title: `Check-in at ${hotel.name}`,
    description: `Arrive and check in to your accommodation${hotel.neighborhood ? ` in ${hotel.neighborhood}` : ''}.`,
    startTime: checkInTime,
    duration: '30 min',
    durationMinutes: 30,
    category: 'accommodation',
    type: 'accommodation' as any,
    location: {
      name: hotel.name,
      address: hotel.address || '',
      ...(hotel.coordinates ? { lat: hotel.coordinates.lat, lng: hotel.coordinates.lng } : {}),
    },
    photos: photo ? [{ url: photo }] : existing.photos,
    isLocked: false,
    cost: { amount: 0, currency: 'USD' },
  };
}

function mergeCheckoutData(existing: EditorialActivity, hotel: HotelForInjection): EditorialActivity {
  const photo = hotel.imageUrl || hotel.images?.[0];
  return {
    ...existing, // Preserve AI-enriched fields
    title: `Check-out from ${hotel.name}`,
    description: 'Check out and store luggage if needed before continuing your day.',
    startTime: hotel.checkOutTime || '11:00',
    duration: '30 min',
    durationMinutes: 30,
    category: 'accommodation',
    type: 'accommodation' as any,
    location: {
      name: hotel.name,
      address: hotel.address || '',
      ...(hotel.coordinates ? { lat: hotel.coordinates.lat, lng: hotel.coordinates.lng } : {}),
    },
    photos: photo ? [{ url: photo }] : existing.photos,
    isLocked: false,
    cost: { amount: 0, currency: 'USD' },
  };
}

/** Build a brand-new check-in activity (fallback when no placeholder exists) */
function buildNewCheckinActivity(hotel: HotelForInjection, dayActivities: EditorialActivity[]): EditorialActivity {
  const stub: EditorialActivity = {
    id: checkinId(hotel.id),
    title: '',
    tags: ['check-in', 'structural'],
  };
  return mergeCheckinData(stub, hotel, dayActivities);
}

/** Build a brand-new check-out activity (fallback) */
function buildNewCheckoutActivity(hotel: HotelForInjection): EditorialActivity {
  const stub: EditorialActivity = {
    id: checkoutId(hotel.id),
    title: '',
    tags: ['check-out', 'structural'],
  };
  return mergeCheckoutData(stub, hotel);
}

// ─── Sorting ─────────────────────────────────────────────────────────────────

/** Re-sort activities chronologically if a time changed */
function sortIfNeeded(activities: EditorialActivity[], changedId: string, oldTime: string | undefined, newTime: string | undefined): EditorialActivity[] {
  if (oldTime === newTime) return activities; // position unchanged
  return [...activities].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

/** Insert activity into the correct time-ordered position */
function insertChronologically(activities: EditorialActivity[], newActivity: EditorialActivity): EditorialActivity[] {
  const newMinutes = timeToMinutes(newActivity.startTime);
  const result = [...activities];
  let insertIdx = result.length;
  for (let i = 0; i < result.length; i++) {
    if (timeToMinutes(result[i].startTime) >= newMinutes) {
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
    const norm = dateStr.slice(0, 10);
    const idx = days.findIndex(d => d.date?.slice(0, 10) === norm);
    if (idx >= 0) return idx;
  }
  return fallbackFirst ? 0 : days.length - 1;
}

// ─── Normalize ───────────────────────────────────────────────────────────────

function normalizeHotel(
  hotel: HotelSelection | HotelBooking | CityHotelInfo | Record<string, any>
): HotelForInjection | null {
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

// ─── Main Injection (Update-in-Place) ────────────────────────────────────────

/**
 * Update-in-place a single hotel's check-in/check-out into the itinerary.
 * Finds existing placeholder → merges real data. If no placeholder → inserts new card.
 * Idempotent.
 */
export function injectHotelActivitiesIntoDays(
  days: EditorialDay[],
  hotelData: HotelSelection | HotelBooking | CityHotelInfo | Record<string, any> | null | undefined,
): EditorialDay[] {
  if (!hotelData || days.length === 0) return days;
  const hotel = normalizeHotel(hotelData);
  if (!hotel) return days;

  let updated = days.map(d => ({ ...d, activities: [...d.activities] }));

  // ── Check-in ──
  const checkInDayIdx = findDayIndex(updated, hotel.checkInDate, true);
  const dayHasLateCheckin = updated[checkInDayIdx]?.activities.some(a => isLateCheckin(a));

  if (!dayHasLateCheckin) {
    const day = updated[checkInDayIdx];
    const existingIdx = day.activities.findIndex(a => isCheckinPlaceholder(a, hotel.id));

    if (existingIdx >= 0) {
      // Update in place
      const existing = day.activities[existingIdx];
      const oldTime = existing.startTime;
      const merged = mergeCheckinData(existing, hotel, day.activities);
      day.activities[existingIdx] = merged;
      day.activities = sortIfNeeded(day.activities, merged.id, oldTime, merged.startTime);
    } else {
      // No placeholder found — insert new
      const newActivity = buildNewCheckinActivity(hotel, day.activities);
      day.activities = insertChronologically(day.activities, newActivity);
    }
  }

  // ── Check-out ──
  const checkOutDayIdx = findDayIndex(updated, hotel.checkOutDate, false);
  if (checkOutDayIdx !== checkInDayIdx || updated.length === 1) {
    if (checkOutDayIdx !== checkInDayIdx) {
      const day = updated[checkOutDayIdx];
      const existingIdx = day.activities.findIndex(a => isCheckoutPlaceholder(a, hotel.id));

      if (existingIdx >= 0) {
        const existing = day.activities[existingIdx];
        const oldTime = existing.startTime;
        const merged = mergeCheckoutData(existing, hotel);
        day.activities[existingIdx] = merged;
        day.activities = sortIfNeeded(day.activities, merged.id, oldTime, merged.startTime);
      } else {
        const newActivity = buildNewCheckoutActivity(hotel);
        day.activities = insertChronologically(day.activities, newActivity);
      }
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
  let updated = days;
  for (const hotelData of hotels) {
    updated = injectHotelActivitiesIntoDays(updated, hotelData);
  }
  return updated;
}
