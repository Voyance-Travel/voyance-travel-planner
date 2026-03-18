/**
 * useTripVenueBank — scans all activities in the current trip's days
 * and extracts unique venue names, addresses, and websites for auto-suggestions.
 * Purely in-memory, derived from existing itinerary state.
 */

import { useMemo } from 'react';

export interface VenueEntry {
  name: string;
  address?: string;
  website?: string;
}

export interface VenueBank {
  /** Unique venue entries with associated address/website */
  venues: VenueEntry[];
  /** All unique addresses across all activities */
  addresses: string[];
  /** All unique websites/URLs across all activities */
  websites: string[];
  /** Look up a venue by name to auto-fill address/website */
  getVenue: (name: string) => VenueEntry | undefined;
}

interface DayLike {
  activities: Array<{
    location?: { name?: string; address?: string };
    website?: string;
    bookingUrl?: string;
    [key: string]: any;
  }>;
}

export function useTripVenueBank(days: DayLike[] | null | undefined): VenueBank {
  return useMemo(() => {
    const venueMap = new Map<string, VenueEntry>();
    const addressSet = new Set<string>();
    const websiteSet = new Set<string>();

    if (!days) {
      return { venues: [], addresses: [], websites: [], getVenue: () => undefined };
    }

    for (const day of days) {
      if (!day.activities) continue;
      for (const act of day.activities) {
        const name = act.location?.name?.trim();
        const address = act.location?.address?.trim();
        const website = (act.website || act.bookingUrl || '')?.trim();

        if (name && name.length > 1) {
          const key = name.toLowerCase();
          if (!venueMap.has(key)) {
            venueMap.set(key, { name, address: address || undefined, website: website || undefined });
          } else {
            // Merge: fill in missing fields from other activities at same venue
            const existing = venueMap.get(key)!;
            if (!existing.address && address) existing.address = address;
            if (!existing.website && website) existing.website = website;
          }
        }

        if (address && address.length > 3) {
          addressSet.add(address);
        }

        if (website && website.length > 5) {
          websiteSet.add(website);
        }
      }
    }

    const venues = Array.from(venueMap.values());
    const addresses = Array.from(addressSet);
    const websites = Array.from(websiteSet);

    const getVenue = (searchName: string): VenueEntry | undefined => {
      return venueMap.get(searchName.toLowerCase().trim());
    };

    return { venues, addresses, websites, getVenue };
  }, [days]);
}
