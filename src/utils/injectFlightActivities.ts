/**
 * Inject Flight Arrival/Departure Activities into Itinerary Days
 * 
 * Uses an UPDATE-IN-PLACE pattern: if an existing placeholder card is found
 * (by category + title match or deterministic ID), it is updated with real
 * flight data while preserving AI-enriched fields. Only if no placeholder
 * exists is a new card inserted chronologically.
 */

import type { EditorialDay, EditorialActivity } from '@/components/itinerary/EditorialItinerary';
import { normalizeFlightSelection, getDestinationArrivalLeg, getLastLegDepartureTime, type FlightLeg } from '@/utils/normalizeFlightSelection';

// ─── Deterministic IDs ───────────────────────────────────────────────────────

function arrivalId(legId: string) {
  return `flight-arrival-${legId}`;
}
function departureId(legId: string) {
  return `flight-departure-${legId}`;
}

// ─── Time Utilities ──────────────────────────────────────────────────────────

function timeToMinutes(t?: string): number {
  if (!t) return 0;
  const normalized = t.trim().toUpperCase();
  const m = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!m) return 0;
  let h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  if (m[3] === 'PM' && h !== 12) h += 12;
  if (m[3] === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}

// ─── Matchers ────────────────────────────────────────────────────────────────

/** Match an existing arrival placeholder by ID, category, or title keywords */
function isArrivalPlaceholder(a: EditorialActivity): boolean {
  if (a.id.startsWith('flight-arrival-')) return true;
  if (a.id.startsWith('transport-arrive-')) return true;
  const title = (a.title || '').toLowerCase();
  const cat = (a.category || '').toLowerCase();
  if (cat === 'arrival') return true;
  if ((cat === 'transport' || cat === 'transit') && (title.includes('arrive') || title.includes('arrival') || title.includes('land'))) return true;
  return false;
}

/** Match an existing departure placeholder */
function isDeparturePlaceholder(a: EditorialActivity): boolean {
  if (a.id.startsWith('flight-departure-')) return true;
  if (a.id.startsWith('transport-depart-')) return true;
  const title = (a.title || '').toLowerCase();
  const cat = (a.category || '').toLowerCase();
  if (cat === 'departure') return true;
  if ((cat === 'transport' || cat === 'transit') && (title.includes('depart') || title.includes('departure') || title.includes('airport') || title.includes('head to'))) return true;
  return false;
}

// ─── Update-in-Place Helpers ─────────────────────────────────────────────────

function mergeArrivalData(existing: EditorialActivity, leg: FlightLeg, city?: string): EditorialActivity {
  const airlineInfo = [leg.airline, leg.flightNumber].filter(Boolean).join(' ');
  const titleCity = city || leg.arrival.airport || 'destination';
  const title = airlineInfo
    ? `Arrive in ${titleCity} — ${airlineInfo}`
    : `Arrive in ${titleCity}`;

  const descParts: string[] = [];
  if (leg.terminal) descParts.push(`Terminal ${leg.terminal}`);
  if (leg.gate) descParts.push(`Gate ${leg.gate}`);
  if (leg.baggageInfo) descParts.push(leg.baggageInfo);
  const description = descParts.length > 0
    ? descParts.join(' · ')
    : `Arrive at ${leg.arrival.airport || 'airport'} and collect luggage.`;

  return {
    ...existing, // Preserve AI-enriched fields
    title,
    description,
    startTime: leg.arrival.time || existing.startTime,
    duration: '45 min',
    durationMinutes: 45,
    category: 'arrival',
    type: 'arrival' as any,
    location: {
      name: leg.arrival.airport || existing.location?.name || '',
      address: existing.location?.address || '',
      ...(existing.location?.lat ? { lat: existing.location.lat, lng: existing.location.lng } : {}),
    },
    isLocked: false,
    cost: { amount: 0, currency: 'USD' },
  };
}

function mergeDepartureData(existing: EditorialActivity, leg: FlightLeg, city?: string): EditorialActivity {
  const airlineInfo = [leg.airline, leg.flightNumber].filter(Boolean).join(' ');
  const titleCity = city || leg.departure.airport || 'destination';
  const title = airlineInfo
    ? `Depart from ${titleCity} — ${airlineInfo}`
    : `Depart from ${titleCity}`;

  const descParts: string[] = [];
  if (leg.terminal) descParts.push(`Terminal ${leg.terminal}`);
  if (leg.gate) descParts.push(`Gate ${leg.gate}`);
  if (leg.cabin) descParts.push(`${leg.cabin.charAt(0).toUpperCase() + leg.cabin.slice(1)} class`);
  const description = descParts.length > 0
    ? descParts.join(' · ')
    : `Head to ${leg.departure.airport || 'airport'} for your flight.`;

  return {
    ...existing, // Preserve AI-enriched fields
    title,
    description,
    startTime: leg.departure.time || existing.startTime,
    duration: '30 min',
    durationMinutes: 30,
    category: 'departure',
    type: 'departure' as any,
    location: {
      name: leg.departure.airport || existing.location?.name || '',
      address: existing.location?.address || '',
      ...(existing.location?.lat ? { lat: existing.location.lat, lng: existing.location.lng } : {}),
    },
    isLocked: false,
    cost: { amount: 0, currency: 'USD' },
  };
}

// ─── Sorting / Insert ────────────────────────────────────────────────────────

function sortIfNeeded(activities: EditorialActivity[], oldTime: string | undefined, newTime: string | undefined): EditorialActivity[] {
  if (oldTime === newTime) return activities;
  return [...activities].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
}

function insertChronologically(activities: EditorialActivity[], newActivity: EditorialActivity): EditorialActivity[] {
  const newMin = timeToMinutes(newActivity.startTime);
  const result = [...activities];
  let idx = result.length;
  for (let i = 0; i < result.length; i++) {
    if (timeToMinutes(result[i].startTime) >= newMin) { idx = i; break; }
  }
  result.splice(idx, 0, newActivity);
  return result;
}

function findDayIndex(days: EditorialDay[], dateStr?: string, fallbackFirst = true): number {
  if (dateStr && days.length > 0) {
    const norm = dateStr.slice(0, 10);
    const idx = days.findIndex(d => d.date?.slice(0, 10) === norm);
    if (idx >= 0) return idx;
  }
  return fallbackFirst ? 0 : days.length - 1;
}

// ─── Main Injection ──────────────────────────────────────────────────────────

/**
 * Inject flight arrival and departure activities into itinerary days.
 * Update-in-place: finds existing placeholders and merges real flight data.
 * If no placeholder exists, inserts a new card chronologically.
 * Idempotent.
 * 
 * @param destinationCity - optional city name for card titles ("Arrive in Paris")
 */
export function injectFlightActivitiesIntoDays(
  days: EditorialDay[],
  flightSelection: unknown,
  destinationCity?: string,
): EditorialDay[] {
  if (!flightSelection || days.length === 0) return days;

  const normalized = normalizeFlightSelection(flightSelection);
  if (!normalized || normalized.legs.length === 0) return days;

  let updated = days.map(d => ({ ...d, activities: [...d.activities] }));

  // ── Arrival leg ──
  const arrivalLeg = getDestinationArrivalLeg(flightSelection);
  if (arrivalLeg?.arrival?.time) {
    const arrivalDate = arrivalLeg.arrival.date || arrivalLeg.departure.date;
    const dayIdx = findDayIndex(updated, arrivalDate, true);
    const day = updated[dayIdx];
    const existingIdx = day.activities.findIndex(a => isArrivalPlaceholder(a));
    const legKey = arrivalLeg.flightNumber || arrivalLeg.legOrder?.toString() || '1';

    if (existingIdx >= 0) {
      const existing = day.activities[existingIdx];
      const oldTime = existing.startTime;
      day.activities[existingIdx] = mergeArrivalData(existing, arrivalLeg, destinationCity);
      day.activities = sortIfNeeded(day.activities, oldTime, arrivalLeg.arrival.time);
    } else {
      const stub: EditorialActivity = {
        id: arrivalId(legKey),
        title: '',
        tags: ['arrival', 'structural'],
      };
      const newActivity = mergeArrivalData(stub, arrivalLeg, destinationCity);
      day.activities = insertChronologically(day.activities, newActivity);
    }
  }

  // ── Departure leg ──
  // Find the leg marked as destination departure, or fallback to last leg
  const departureLeg = normalized.legs.find(l => l.isDestinationDeparture) || 
    (normalized.legs.length >= 2 ? normalized.legs[normalized.legs.length - 1] : undefined);
  
  if (departureLeg?.departure?.time) {
    const departureDate = departureLeg.departure.date;
    const dayIdx = findDayIndex(updated, departureDate, false);
    const day = updated[dayIdx];
    const existingIdx = day.activities.findIndex(a => isDeparturePlaceholder(a));
    const legKey = departureLeg.flightNumber || departureLeg.legOrder?.toString() || 'last';

    if (existingIdx >= 0) {
      const existing = day.activities[existingIdx];
      const oldTime = existing.startTime;
      day.activities[existingIdx] = mergeDepartureData(existing, departureLeg, destinationCity);
      day.activities = sortIfNeeded(day.activities, oldTime, departureLeg.departure.time);
    } else {
      const stub: EditorialActivity = {
        id: departureId(legKey),
        title: '',
        tags: ['departure', 'structural'],
      };
      const newActivity = mergeDepartureData(stub, departureLeg, destinationCity);
      day.activities = insertChronologically(day.activities, newActivity);
    }
  }

  return updated;
}
