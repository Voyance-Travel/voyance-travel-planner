/**
 * Static fallback image mapping for itinerary activity cards.
 * Uses locally-stored images — zero external API dependency.
 */

const FALLBACK_PLANE = '/images/fallbacks/fallback-plane.jpg';
const FALLBACK_CAR = '/images/fallbacks/fallback-car.jpg';
const FALLBACK_HOTEL = '/images/fallbacks/fallback-hotel.jpg';
const FALLBACK_EXPLORE = '/images/fallbacks/fallback-explore.jpg';
const FALLBACK_DESTINATION = '/images/fallbacks/fallback-destination.jpg';

/**
 * Returns a static fallback image URL based on the activity's type and name.
 * Deterministic — same inputs always produce the same image.
 */
export function getActivityFallbackImage(
  activityType?: string,
  activityName?: string
): string {
  const type = (activityType || '').toLowerCase();
  const name = (activityName || '').toLowerCase();

  // Flight / Airport related
  if (
    type === 'flight' || type === 'arrival' || type === 'departure' ||
    name.includes('flight') || name.includes('airport') || name.includes('fly') ||
    name.includes('landing') || name.includes('takeoff')
  ) {
    return FALLBACK_PLANE;
  }

  // Transport / Transit related
  if (
    type === 'transport' || type === 'transportation' || type === 'transit' ||
    type === 'transfer' ||
    name.includes('transfer') || name.includes('rideshare') || name.includes('taxi') ||
    name.includes('uber') || name.includes('lyft') || name.includes('drive') ||
    name.includes('car service') || name.includes('getting to')
  ) {
    return FALLBACK_CAR;
  }

  // Hotel / Accommodation related
  if (
    type === 'stay' || type === 'accommodation' || type === 'hotel' ||
    type === 'check-in' || type === 'check-out' || type === 'checkin' || type === 'checkout' ||
    name.includes('check in') || name.includes('check out') || name.includes('check-in') ||
    name.includes('check-out') || name.includes('hotel') || name.includes('resort') ||
    name.includes('settle in') || name.includes('oriented')
  ) {
    return FALLBACK_HOTEL;
  }

  // Walking / Exploring / Free time
  if (
    type === 'explore' || type === 'walk' || type === 'free_time' || type === 'free time' ||
    type === 'downtime' || type === 'leisure' ||
    name.includes('stroll') || name.includes('wander') || name.includes('explore') ||
    name.includes('free time') || name.includes('at leisure') || name.includes('walk around')
  ) {
    return FALLBACK_EXPLORE;
  }

  // Default fallback
  return FALLBACK_DESTINATION;
}
