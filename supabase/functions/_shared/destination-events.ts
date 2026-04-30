/**
 * destination-events.ts — best-effort static seed of well-known recurring events
 * that materially affect itinerary planning (festivals, marathons, holidays).
 *
 * Returns events that fall on a given YYYY-MM-DD for a given city.
 * This is a stub — extend by reading from a `destination_events` DB table once
 * that table exists. Returning [] is the safe default.
 */

export interface DestinationEvent {
  name: string;
  impact: string;       // Human-readable description for the prompt
  scope?: 'city' | 'neighborhood';
}

interface EventEntry {
  cities: string[];     // lowercased
  matches: (date: Date) => boolean;
  event: DestinationEvent;
}

const SEED: EventEntry[] = [
  {
    cities: ['lisbon', 'lisboa'],
    matches: (d) => d.getMonth() === 5 && d.getDate() >= 12 && d.getDate() <= 13,
    event: {
      name: 'Festas de Santo António (Sardine Festival)',
      impact: 'Streets in Alfama are closed for parades; expect crowds, smoke from grilled sardines, and altered restaurant hours. Lean into the festival rather than scheduling a quiet dinner.',
    },
  },
  {
    cities: ['new york', 'nyc', 'manhattan'],
    matches: (d) => d.getMonth() === 10 && d.getDate() === 1,
    event: {
      name: 'NYC Marathon',
      impact: 'First Sunday of November. Expect major street closures across all 5 boroughs; avoid driving and use the subway.',
    },
  },
  {
    cities: ['barcelona'],
    matches: (d) => d.getMonth() === 8 && d.getDate() === 24,
    event: {
      name: 'La Mercè Festival',
      impact: 'City-wide festival with parades, fireworks, and human towers (castellers). Many streets closed; book restaurants ahead.',
    },
  },
  {
    cities: ['paris'],
    matches: (d) => d.getMonth() === 6 && d.getDate() === 14,
    event: {
      name: 'Bastille Day',
      impact: 'Major parade on Champs-Élysées and fireworks at Eiffel Tower. Most museums close in the afternoon.',
    },
  },
];

function normalizeCity(city: string): string {
  return (city || '').toLowerCase().trim();
}

export function getDestinationEvents(city: string, dateYMD: string): DestinationEvent[] {
  const c = normalizeCity(city);
  if (!c || !dateYMD) return [];
  const d = new Date(`${dateYMD}T00:00:00`);
  if (isNaN(d.getTime())) return [];
  const out: DestinationEvent[] = [];
  for (const entry of SEED) {
    if (!entry.cities.some((cn) => c.includes(cn))) continue;
    if (entry.matches(d)) out.push(entry.event);
  }
  return out;
}
