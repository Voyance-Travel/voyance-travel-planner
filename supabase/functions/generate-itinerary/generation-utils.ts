/**
 * Pure utility functions shared across the generate-itinerary pipeline.
 *
 * These have ZERO side effects and ZERO external dependencies — safe to
 * extract and import anywhere.
 */

// =============================================================================
// DATE / TIME UTILITIES
// =============================================================================

export function calculateDays(startDate: string, endDate: string): number {
  // Timezone-safe: parse as local dates to avoid UTC off-by-one
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  // Inclusive end-date: last day IS an activity day (March 7-9 = 3 days)
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function formatDate(startDate: string, dayOffset: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const date = new Date(y, m - 1, d + dayOffset);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

export function calculateDuration(start: string, end: string): number {
  return timeToMinutes(end) - timeToMinutes(start);
}

// =============================================================================
// CATEGORY ICON MAPPING
// =============================================================================

export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    sightseeing: 'map-pin',
    dining: 'utensils',
    cultural: 'landmark',
    shopping: 'shopping-bag',
    relaxation: 'spa',
    transport: 'car',
    accommodation: 'bed',
    activity: 'activity',
  };
  return icons[category] || 'star';
}

// =============================================================================
// VENUE NAME NORMALIZATION
// =============================================================================

export function normalizeVenueName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[''`´]/g, "'")
    .replace(/[^\w\s'-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// =============================================================================
// HAVERSINE DISTANCE (km)
// =============================================================================

export function haversineDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// =============================================================================
// AIRPORT TRANSFER HELPERS
// =============================================================================

/**
 * Fetch airport transfer time from destinations table.
 * Returns destination-specific transfer time, or default 45 minutes.
 */
export async function getAirportTransferMinutes(
  supabase: any,
  destination: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('destinations')
      .select('airport_transfer_minutes, city')
      .or(
        `city.ilike.%${destination}%,country.ilike.%${destination}%`,
      )
      .limit(1);

    if (error || !data?.length) {
      console.log(
        `[AirportTransfer] No destination found for "${destination}", using default 45 min`,
      );
      return 45;
    }

    const transferTime = data[0].airport_transfer_minutes || 45;
    console.log(
      `[AirportTransfer] Found ${data[0].city}: ${transferTime} minutes`,
    );
    return transferTime;
  } catch (e) {
    console.error('[AirportTransfer] Error fetching transfer time:', e);
    return 45;
  }
}
