/**
 * Cross-city safety filter for venues read from the `verified_venues` table.
 *
 * The table query uses `ilike('%city%')` which is loose (substring matches,
 * stale rows with wrong `city` values, city names that are substrings of
 * other cities). Without this filter a foreign venue (e.g. Tartine SF, Le
 * Comptoir Paris, All'Antico Vinaio Florence) can leak into a Venice meal
 * guard fallback. This module is the last shared chokepoint.
 */
import { detectCrossCityMention } from '../generate-itinerary/cross-city-filter.ts';

export interface VenueLike {
  name?: string | null;
  address?: string | null;
  city?: string | null;
  [k: string]: any;
}

export function filterVenuesByDestination<T extends VenueLike>(
  venues: T[] | null | undefined,
  destination: string,
  contextTag = 'verified-venues-filter',
): T[] {
  if (!venues || venues.length === 0) return [];
  if (!destination) return venues;
  const out: T[] = [];
  let dropped = 0;
  for (const v of venues) {
    const nameHit = detectCrossCityMention(v?.name || '', destination);
    const addrHit = detectCrossCityMention(v?.address || '', destination);
    const cityHit = detectCrossCityMention(v?.city || '', destination);
    const hit = nameHit || addrHit || cityHit;
    if (hit) {
      dropped++;
      console.warn(
        `[${contextTag}] dropping cross-city venue "${v?.name}" — mentions "${hit}", destination "${destination}"`,
      );
      continue;
    }
    out.push(v);
  }
  if (dropped > 0) {
    console.warn(`[${contextTag}] dropped ${dropped}/${venues.length} cross-city venue(s) for "${destination}"`);
  }
  return out;
}
