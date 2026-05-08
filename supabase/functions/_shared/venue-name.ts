/**
 * Shared venue name sanitizer.
 *
 * Some legacy rows in `verified_venues` have a meal-type suffix baked into
 * the `name` column (e.g. "Sagra Rooftop Restaurant (Breakfast)"). When the
 * meal-pool picker reuses such a venue for a different slot, the suffix
 * leaks into the rendered card label and contradicts the activity title.
 *
 * `stripVenueMealSuffix` strips ONLY trailing meal-type parentheticals —
 * legitimate parentheticals like "(closed Sundays)" or "(Exterior)" are
 * preserved.
 *
 * See mem://constraints/itinerary/venue-meal-suffix-strip
 */
export const VENUE_MEAL_SUFFIX_RE = /\s*\((?:breakfast|lunch|dinner|brunch)\)\s*$/i;

export function stripVenueMealSuffix(name: string | null | undefined): string {
  if (!name) return name ?? '';
  return String(name).replace(VENUE_MEAL_SUFFIX_RE, '').trim();
}

/**
 * Walks an itinerary_data JSON tree and strips meal suffixes from every
 * `title`, `name`, and `location.name` field. Returns count of fields cleaned.
 */
export function stripMealSuffixesInItinerary(itinerary: any): number {
  let count = 0;
  if (!itinerary || typeof itinerary !== 'object') return 0;
  const days = Array.isArray(itinerary.days) ? itinerary.days : [];
  for (const day of days) {
    const acts = Array.isArray(day?.activities) ? day.activities : [];
    for (const a of acts) {
      if (!a || typeof a !== 'object') continue;
      for (const key of ['title', 'name']) {
        if (typeof a[key] === 'string' && VENUE_MEAL_SUFFIX_RE.test(a[key])) {
          a[key] = stripVenueMealSuffix(a[key]);
          count++;
        }
      }
      if (a.location && typeof a.location === 'object' && typeof a.location.name === 'string'
          && VENUE_MEAL_SUFFIX_RE.test(a.location.name)) {
        a.location.name = stripVenueMealSuffix(a.location.name);
        count++;
      }
    }
  }
  return count;
}
