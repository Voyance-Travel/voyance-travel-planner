/**
 * Auto Route Optimizer
 * 
 * Lightweight nearest-neighbor route optimization that runs automatically
 * during generation. Reorders flexible activities by geographic proximity
 * while preserving time-fixed activities (reservations, transport, etc.)
 * in their original positions.
 * 
 * No API calls — uses only coordinates already present from enrichment.
 * No credit charge — this is a generation quality feature.
 */

interface Coordinates {
  lat: number;
  lng: number;
}

interface ActivityLike {
  id?: string;
  title?: string;
  name?: string;
  category?: string;
  startTime?: string;
  endTime?: string;
  isLocked?: boolean;
  location?: {
    name?: string;
    address?: string;
    coordinates?: Coordinates;
  } | string;
  bookingRequired?: boolean;
  // Any other fields are passed through
  [key: string]: unknown;
}

/** Categories that are always position-fixed (never reordered) */
const FIXED_CATEGORIES = new Set([
  'transport',
  'transportation',
  'logistics',
  'accommodation',
  'check-in',
  'check-out',
  'arrival',
  'departure',
  'dining',
  'food',
  'restaurant',
]);

/** Keywords in titles that indicate time-fixed activities */
const FIXED_TITLE_PATTERNS = [
  /reservat/i,
  /check.?in/i,
  /check.?out/i,
  /arrival/i,
  /departure/i,
  /transfer/i,
  /airport/i,
  /show\b/i,
  /performance/i,
  /concert/i,
  /theater|theatre/i,
  /tour\b.*\d/i,  // "Tour at 2pm" etc
  /dinner\b/i,
  /lunch\b/i,
  /breakfast\b/i,
  /brunch\b/i,
  /supper\b/i,
];

function getCoords(location: ActivityLike['location']): Coordinates | null {
  if (!location || typeof location === 'string') return null;
  if (location.coordinates?.lat && location.coordinates?.lng) {
    return location.coordinates;
  }
  return null;
}

function haversineDistance(a: Coordinates, b: Coordinates): number {
  const R = 6371; // km
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + 
    Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Determine if an activity is "time-fixed" — meaning its position in the
 * schedule must not change. This includes:
 * - Locked activities
 * - Transport/logistics
 * - Activities with booking_required
 * - Activities matching reservation/show patterns
 */
function isTimeFixed(act: ActivityLike): boolean {
  if (act.isLocked) return true;
  if (act.bookingRequired) return true;
  const cat = (act.category || '').toLowerCase();
  if (FIXED_CATEGORIES.has(cat)) return true;
  const title = act.title || act.name || '';
  return FIXED_TITLE_PATTERNS.some(p => p.test(title));
}

/**
 * Auto-optimize a day's activities by geographic proximity.
 * 
 * Algorithm:
 * 1. Identify fixed vs flexible activities
 * 2. Fixed activities stay at their exact positions
 * 3. Flexible activities between fixed anchors are reordered by nearest-neighbor
 * 4. Time slots are reassigned to maintain the original time structure
 * 
 * Returns the activities array (possibly reordered) with updated times.
 */
export function autoOptimizeDayRoute(activities: ActivityLike[]): ActivityLike[] {
  if (activities.length <= 2) return activities;

  // Split into segments between fixed anchors
  // Each segment is a group of consecutive flexible activities
  const indexed = activities.map((act, i) => ({
    act,
    originalIndex: i,
    isFixed: isTimeFixed(act),
    coords: getCoords(act.location),
  }));

  // Check if we have enough coordinates to optimize
  const flexibleWithCoords = indexed.filter(x => !x.isFixed && x.coords);
  if (flexibleWithCoords.length <= 1) {
    // Nothing to optimize
    return activities;
  }

  // Find segments of consecutive flexible activities
  const segments: Array<{ startIdx: number; endIdx: number }> = [];
  let segStart: number | null = null;

  for (let i = 0; i < indexed.length; i++) {
    if (!indexed[i].isFixed) {
      if (segStart === null) segStart = i;
    } else {
      if (segStart !== null) {
        segments.push({ startIdx: segStart, endIdx: i - 1 });
        segStart = null;
      }
    }
  }
  if (segStart !== null) {
    segments.push({ startIdx: segStart, endIdx: indexed.length - 1 });
  }

  // Optimize each segment independently
  const result = [...activities];
  let totalImprovement = 0;

  for (const seg of segments) {
    const segItems = indexed.slice(seg.startIdx, seg.endIdx + 1);
    const withCoords = segItems.filter(x => x.coords);
    
    // Need at least 2 items with coordinates to optimize
    if (withCoords.length < 2) continue;

    // Determine starting point: use the fixed activity just before this segment, if any
    let startCoord: Coordinates | null = null;
    if (seg.startIdx > 0) {
      startCoord = indexed[seg.startIdx - 1].coords;
    }

    // Nearest-neighbor within this segment
    const segActivities = segItems.map(x => x.act);
    const optimized = nearestNeighborSort(segActivities, startCoord);

    // Calculate improvement
    const origDist = totalDistance(segActivities);
    const optDist = totalDistance(optimized);
    if (origDist > 0) {
      totalImprovement += origDist - optDist;
    }

    // Place optimized activities back, preserving original time slots
    const originalTimes = segActivities.map(a => ({
      startTime: a.startTime,
      endTime: a.endTime,
    }));

    for (let i = 0; i < optimized.length; i++) {
      result[seg.startIdx + i] = {
        ...optimized[i],
        startTime: originalTimes[i].startTime,
        endTime: originalTimes[i].endTime,
      };
    }
  }

  if (totalImprovement > 0.1) { // >100m improvement
    console.log(`[auto-route] Optimized route: ${totalImprovement.toFixed(1)}km saved`);
  }

  return result;
}

function nearestNeighborSort(
  activities: ActivityLike[],
  startFrom: Coordinates | null,
): ActivityLike[] {
  if (activities.length <= 1) return [...activities];

  const remaining = activities.map((act, i) => ({ act, coords: getCoords(act.location), idx: i }));
  const sorted: ActivityLike[] = [];
  
  // If we have a starting coordinate (from previous fixed activity), use it
  let currentCoord = startFrom;

  // If no starting coord, start with the first activity that has coords
  if (!currentCoord) {
    const first = remaining.find(r => r.coords);
    if (!first) return [...activities]; // No coords at all
    sorted.push(first.act);
    currentCoord = first.coords;
    remaining.splice(remaining.indexOf(first), 1);
  }

  while (remaining.length > 0) {
    if (!currentCoord) {
      // No coord for current position, just append the rest
      sorted.push(...remaining.map(r => r.act));
      break;
    }

    // Find nearest with coords
    let bestIdx = -1;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      if (remaining[i].coords) {
        const d = haversineDistance(currentCoord, remaining[i].coords!);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
    }

    if (bestIdx >= 0) {
      const chosen = remaining[bestIdx];
      sorted.push(chosen.act);
      currentCoord = chosen.coords;
      remaining.splice(bestIdx, 1);
    } else {
      // Remaining items have no coords, append in order
      sorted.push(...remaining.map(r => r.act));
      break;
    }
  }

  return sorted;
}

function totalDistance(activities: ActivityLike[]): number {
  let dist = 0;
  for (let i = 1; i < activities.length; i++) {
    const a = getCoords(activities[i - 1].location);
    const b = getCoords(activities[i].location);
    if (a && b) dist += haversineDistance(a, b);
  }
  return dist;
}
