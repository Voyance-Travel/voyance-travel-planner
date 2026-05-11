/**
 * Per-category price sanity bounds (B3, Barcelona Diagnosis).
 *
 * Defends against AI hallucinated/cross-contaminated prices like the
 * Pastelería Hofmann case (pastry shop billed at €120/pp for breakfast,
 * real range €5–25). Values are USD per person.
 *
 * Used by:
 *   - pipeline/validate-day.ts → checkPlausiblePricing
 *   - pipeline/repair-day.ts   → repairImplausiblePricing (median substitute)
 *   - action-repair-costs.ts   → parity with bar-cap repair
 *
 * Respect existing memories:
 *   - Skip rows with cost.basis ∈ {user, user_override, booked} (Universal Locking)
 *   - Skip walking legs (always $0 — Walking Is Free)
 *   - Fine-dining tiers (Michelin floor, KNOWN_FINE_DINING_STARS) take precedence
 */

export type PriceCategoryKey =
  | 'pastry'
  | 'coffee_shop'
  | 'breakfast_casual'
  | 'lunch_casual'
  | 'lunch_mid'
  | 'lunch_fine_dining'
  | 'dinner_casual'
  | 'dinner_mid'
  | 'dinner_fine_dining'
  | 'walking_tour'
  | 'walking_tour_paid'
  | 'museum'
  | 'guided_tour_premium'
  | 'bike_tour'
  | 'food_tour'
  | 'cooking_class'
  | 'wine_tasting'
  | 'boat_tour'
  | 'metro_ticket'
  | 'taxi_short'
  | 'taxi_airport';

export interface PriceBound {
  min: number;
  max: number;
  currency: 'USD';
}

export const CATEGORY_PRICE_CEILINGS: Record<PriceCategoryKey, PriceBound> = {
  // breakfast / coffee / pastry
  pastry:            { min: 3,  max: 25,  currency: 'USD' },
  coffee_shop:       { min: 2,  max: 20,  currency: 'USD' },
  breakfast_casual:  { min: 3,  max: 30,  currency: 'USD' },

  // lunch
  lunch_casual:      { min: 8,  max: 40,  currency: 'USD' },
  lunch_mid:         { min: 25, max: 80,  currency: 'USD' },
  lunch_fine_dining: { min: 50, max: 200, currency: 'USD' },

  // dinner
  dinner_casual:     { min: 12, max: 60,  currency: 'USD' },
  dinner_mid:        { min: 30, max: 120, currency: 'USD' },
  dinner_fine_dining: { min: 80, max: 350, currency: 'USD' },

  // experiences
  walking_tour:        { min: 0,  max: 40,  currency: 'USD' },
  walking_tour_paid:   { min: 15, max: 80,  currency: 'USD' },
  museum:              { min: 0,  max: 50,  currency: 'USD' },
  guided_tour_premium: { min: 50, max: 250, currency: 'USD' },
  bike_tour:           { min: 25, max: 90,  currency: 'USD' },
  food_tour:           { min: 50, max: 150, currency: 'USD' },
  cooking_class:       { min: 60, max: 200, currency: 'USD' },
  wine_tasting:        { min: 25, max: 150, currency: 'USD' },
  boat_tour:           { min: 20, max: 200, currency: 'USD' },

  // transport
  metro_ticket:  { min: 1,  max: 8,   currency: 'USD' },
  taxi_short:    { min: 5,  max: 30,  currency: 'USD' },
  taxi_airport:  { min: 20, max: 100, currency: 'USD' },
};

const PASTRY_RE = /\b(pastr(?:y|er[ií]a|isserie)|bakery|boulangerie|panader[ií]a|patisser[ií]a)\b/i;
const COFFEE_RE = /\b(coffee|caf[eé]|espresso|cappuccino|barista)\b/i;
const FINE_DINING_RE = /\b(michelin|tasting menu|chef[''`s]?\s*counter|chef[''`s]?\s*table|kaiseki|omakase|degustaci[oó]n|menu degustaci[oó]n)\b/i;
const WALKING_TOUR_RE = /\bwalking\s+tour\b/i;
const BIKE_TOUR_RE = /\b(e-?bike|electric\s+bike|cycling|bicycle|segway)\s+(tour|experience|ride)\b|\bbike\s+tour\b/i;
const FOOD_TOUR_RE = /\b(food|tapas|street[- ]food|market|culinary|gastronom(?:y|ic))\s+tour\b/i;
const COOKING_CLASS_RE = /\b(cooking|pasta|paella|pizza|sushi|baking)\s+(class|workshop|experience|lesson)\b/i;
const WINE_TASTING_RE = /\b(wine|sake|whisk(?:ey|y)|champagne|sparkling|cava|prosecco)\s+(tasting|flight|pairing)\b/i;
const BOAT_TOUR_RE = /\b(boat|gondola|sunset|sailing|catamaran|cruise|yacht|kayak\s+tour)\s+(tour|ride|experience|cruise)\b/i;
const MUSEUM_RE = /\b(museum|gallery|museo|galerie|kunsthalle)\b/i;
const METRO_RE = /\b(metro|subway|underground|tube|t-bana|s-bahn|u-bahn)\s*(ticket|fare|pass)?\b/i;
const TAXI_AIRPORT_RE = /\b(airport)\b.*\b(taxi|transfer|cab|uber|lyft)\b|\b(taxi|transfer|cab|uber|lyft)\b.*\b(airport)\b/i;
const TAXI_RE = /\b(taxi|cab|uber|lyft|rideshare)\b/i;

/**
 * Infer subcategory from activity. Returns null when nothing matches —
 * caller treats that as "unknown, skip sanity check" (never throws, never
 * mutates).
 */
export function inferSubcategory(activity: any): PriceCategoryKey | null {
  if (!activity) return null;
  const cat = String(activity.category || '').toLowerCase();
  const sub = String(activity.subcategory || activity.sub_category || '').toLowerCase();
  const title = String(activity.title || activity.name || '');
  const venue = String(activity.venue_name || activity.location?.name || '');
  const haystack = `${title} ${venue} ${sub}`;

  // Transport short-circuit
  if (cat.includes('transport') || cat.includes('transit') || cat.includes('travel')) {
    if (TAXI_AIRPORT_RE.test(haystack)) return 'taxi_airport';
    if (METRO_RE.test(haystack)) return 'metro_ticket';
    if (TAXI_RE.test(haystack)) return 'taxi_short';
    return null;
  }

  // Experiences (paid-tour subcategories run BEFORE generic walking_tour/museum)
  if (BIKE_TOUR_RE.test(haystack)) return 'bike_tour';
  if (FOOD_TOUR_RE.test(haystack)) return 'food_tour';
  if (COOKING_CLASS_RE.test(haystack)) return 'cooking_class';
  if (WINE_TASTING_RE.test(haystack)) return 'wine_tasting';
  if (BOAT_TOUR_RE.test(haystack)) return 'boat_tour';
  if (WALKING_TOUR_RE.test(haystack)) return 'walking_tour';
  if (MUSEUM_RE.test(haystack) && !cat.includes('dining')) return 'museum';

  // Dining — infer by meal slot + fine-dining detection
  const isDining = cat.includes('dining') || cat.includes('food') || cat.includes('restaurant') || cat.includes('meal');
  if (!isDining && !PASTRY_RE.test(haystack) && !COFFEE_RE.test(haystack)) return null;

  // Time-of-day slot
  const t = String(activity.startTime || activity.start_time || '');
  const m = t.match(/(\d{1,2}):(\d{2})/);
  let mins = -1;
  if (m) {
    let h = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (/pm/i.test(t) && h < 12) h += 12;
    if (/am/i.test(t) && h === 12) h = 0;
    mins = h * 60 + mm;
  }

  const isBreakfast = mins >= 0 && mins < 11 * 60;
  const isLunch = mins >= 11 * 60 && mins < 16 * 60;
  const isDinner = mins >= 16 * 60;

  // Breakfast-specific venue types first
  if (PASTRY_RE.test(haystack)) return 'pastry';
  if (COFFEE_RE.test(haystack)) return 'coffee_shop';
  if (isBreakfast) return 'breakfast_casual';

  // Fine-dining detection
  const fineDining = FINE_DINING_RE.test(haystack);
  const tags = Array.isArray(activity.tags) ? activity.tags.map((x: any) => String(x).toLowerCase()) : [];
  const tagFineDining = tags.some((t: string) => /michelin|fine[\s-]?dining|tasting/.test(t));
  const isFineDining = fineDining || tagFineDining;

  if (isLunch) {
    if (isFineDining) return 'lunch_fine_dining';
    // Without explicit fine-dining signal, default lunch to lunch_mid so a
    // €80 lunch isn't auto-substituted; the ceiling there is 80.
    return 'lunch_mid';
  }
  if (isDinner) {
    if (isFineDining) return 'dinner_fine_dining';
    return 'dinner_mid';
  }

  return null;
}

/**
 * Extract per-person USD price from an activity, returning null when the
 * price is missing/non-numeric. Mirrors the fallback chain used in
 * action-repair-costs.ts and EditorialItinerary.tsx.
 */
export function extractPerPersonPrice(activity: any): number | null {
  if (!activity) return null;
  const candidates = [
    activity.cost_per_person,
    activity.price_per_person,
    activity.estimated_price_per_person,
    activity.cost?.amount,
    activity.estimatedCost?.amount,
    activity.price,
  ];
  for (const c of candidates) {
    const n = typeof c === 'number' ? c : parseFloat(String(c ?? ''));
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return null;
}

/** Should we skip price sanity for this row entirely? (locking + walking) */
export function shouldSkipPriceSanity(activity: any): boolean {
  if (!activity) return true;
  if (activity.is_locked === true || activity.isLocked === true) return true;
  const source = String(activity.source || '').toLowerCase();
  if (['user', 'manual', 'extracted', 'pinned'].includes(source)) return true;
  const basis = String(activity.cost?.basis || activity.basis || '').toLowerCase();
  if (['user', 'user_override', 'booked'].includes(basis)) return true;
  // Walking legs are policy-free.
  const title = String(activity.title || activity.name || '');
  if (/^\s*(walk|stroll)\b|walking (to|along|through|around)/i.test(title)
      && !/walking tour/i.test(title)) {
    return true;
  }
  return false;
}
