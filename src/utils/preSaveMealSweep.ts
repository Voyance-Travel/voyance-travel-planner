/**
 * Client mirror of the server's `nuclearPlaceholderSweep`. Walks every
 * activity in every day and replaces any meal whose title/venue is a
 * generic stub ("Breakfast at a café near your hotel", "Café Matinal",
 * "find a local spot") with a real, named venue from the shared
 * fallback pool. The activity object is mutated in place.
 *
 * Runs immediately before any DB write so we never persist a stub.
 */

import { resolveAnyMealFallback, parseMealTypeFromTime, type MealSlot } from '@/lib/fallbackRestaurants';
import { isAIStubVenueName } from '@/utils/stubVenueDetection';

const PLACEHOLDER_TITLE_PATTERNS: RegExp[] = [
  /\bat\s+a\s+(local|neighborhood|nearby|good|great|nice|charming|popular)\s+(spot|place|caf[eé]|restaurant|bistro|brasserie|trattoria)\b/i,
  /\bat\s+a\s+caf[eé]\s+near\s+your\s+hotel\b/i,
  /\bat\s+a\s+neighborhood\s+restaurant\b/i,
  /\bat\s+a\s+restaurant\b\s*$/i,
  /^breakfast\s+spot\b/i,
  /\bfind\s+a\s+(local\s+)?(spot|place|venue|restaurant|caf[eé])/i,
  /\b(?:tap|click)\s+to\s+(choose|pick)\s+(a\s+)?(venue|restaurant|spot)/i,
  /^[A-Z][a-z]+\s+—\s+pick a restaurant$/i,
];

interface ActivityShape {
  id?: string;
  title?: string;
  name?: string;
  category?: string;
  startTime?: string;
  start_time?: string;
  time?: string;
  description?: string;
  venue_name?: string;
  cost?: { amount?: number; currency?: string; source?: string };
  cost_per_person?: number;
  location?: { name?: string; address?: string };
  needsVenuePick?: boolean;
  [key: string]: unknown;
}

interface DayShape {
  dayNumber: number;
  city?: string;
  activities: ActivityShape[];
  [key: string]: unknown;
}

const MEAL_LABEL_RE = /^(breakfast|brunch|lunch|dinner|supper|drinks|meal)\b/i;

function looksLikeMeal(act: ActivityShape): boolean {
  const cat = (act.category || '').toLowerCase();
  if (/dining|restaurant|food|cafe|caf\u00e9|meal/.test(cat)) return true;
  return MEAL_LABEL_RE.test(act.title || '');
}

function inferMealSlot(act: ActivityShape): MealSlot {
  const title = (act.title || '').toLowerCase();
  if (/breakfast|brunch/.test(title)) return 'breakfast';
  if (/lunch/.test(title)) return 'lunch';
  if (/dinner|supper/.test(title)) return 'dinner';
  if (/drinks|cocktail/.test(title)) return 'drinks';
  return parseMealTypeFromTime(act.startTime || act.start_time || act.time || null);
}

function isStubMeal(act: ActivityShape, city: string): boolean {
  if (!looksLikeMeal(act)) return false;
  const title = (act.title || '').trim();
  const venue = (act.location?.name || act.venue_name || '').trim();
  if (!title) return false;

  if (PLACEHOLDER_TITLE_PATTERNS.some(p => p.test(title))) return true;
  if (PLACEHOLDER_TITLE_PATTERNS.some(p => p.test(venue))) return true;
  if (isAIStubVenueName(title)) return true;
  if (isAIStubVenueName(venue)) return true;

  // Venue equals destination city name
  const cityLower = (city || '').toLowerCase().trim();
  if (cityLower.length > 2 && venue.toLowerCase() === cityLower) return true;

  // Empty venue on a meal-labeled activity
  if (MEAL_LABEL_RE.test(title) && !venue) return true;

  return false;
}

function applyRealVenue(
  act: ActivityShape,
  fallback: { name: string; address: string; price: number; description: string },
  meal: MealSlot,
): void {
  const label =
    meal === 'breakfast' ? 'Breakfast'
    : meal === 'lunch' ? 'Lunch'
    : meal === 'drinks' ? 'Drinks'
    : 'Dinner';
  act.title = `${label} at ${fallback.name}`;
  act.name = act.title;
  act.location = { ...(act.location || {}), name: fallback.name, address: fallback.address };
  act.venue_name = fallback.name;
  if (fallback.description) act.description = fallback.description;
  if (act.cost) {
    act.cost.amount = fallback.price;
    act.cost.source = 'meal_guard_fallback_db';
  } else {
    act.cost = { amount: fallback.price, currency: 'USD', source: 'meal_guard_fallback_db' };
  }
  act.cost_per_person = fallback.price;
  act.category = act.category || 'dining';
  delete act.needsVenuePick;
}

/**
 * Mutates `days` in place, replacing any meal stubs with real venues.
 * Returns the number of activities replaced (for logging).
 */
export function preSaveMealStubSweep(days: DayShape[], destination?: string): number {
  if (!Array.isArray(days)) return 0;
  let replaced = 0;

  for (const day of days) {
    if (!day?.activities || !Array.isArray(day.activities)) continue;
    const city = (day.city || destination || '').toString();
    const usedNames = new Set<string>();
    for (const act of day.activities) {
      const venue = (act.location?.name || act.venue_name || '').toLowerCase();
      if (venue) usedNames.add(venue);
    }

    for (const act of day.activities) {
      if (!isStubMeal(act, city)) continue;
      const meal = inferMealSlot(act);
      const fallback = resolveAnyMealFallback(city, meal, usedNames);
      if (!fallback) {
        // Mark for UI CTA — better than leaving the stub title untouched.
        act.needsVenuePick = true;
        continue;
      }
      applyRealVenue(act, fallback, meal);
      usedNames.add(fallback.name.toLowerCase());
      replaced++;
    }
  }

  if (replaced > 0) {
    console.warn(`[PreSaveMealSweep] Replaced ${replaced} stub meal(s) with real venues before save`);
  }
  return replaced;
}
