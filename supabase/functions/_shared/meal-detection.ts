/**
 * Canonical meal detection — the SINGLE SOURCE OF TRUTH for "does this day
 * have breakfast / lunch / dinner?"
 *
 * ROOT-CAUSE NOTE (the "Partial badge on every trip" bug):
 * Two independent detectors used to disagree —
 *   - the meal GUARD (`detectMealSlots`, day-validation.ts) decided whether to
 *     INJECT a meal, using SUBSTRING category matching + tight meal windows.
 *   - the integrity GATE (`classifyMealSlot`, itinerary-integrity-contract.ts)
 *     decided whether to flag MEAL_COVERAGE_MISSING, using EXACT category
 *     matching + slightly different windows.
 * A real restaurant tagged `fine_dining` / `casual_dining` / `street_food`
 * with a neutral title (e.g. "Roscioli") satisfied the GUARD (so no meal was
 * injected) but failed the GATE → false MEAL_COVERAGE_MISSING → "Partial" +
 * "Some meals couldn't be scheduled" on a trip that actually had every meal.
 *
 * Both now import THIS module. Identical logic ⇒ the gate can never flag a meal
 * the guard considered present. The guard injects exactly when the gate would
 * flag, and only then.
 */

export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

const MEAL_KEYWORDS: Record<MealSlot, string[]> = {
  breakfast: ['breakfast', 'brunch'],
  lunch: ['lunch'],
  dinner: ['dinner', 'supper', 'evening meal'],
};

// Substring-matched dining categories — recognizes "fine_dining",
// "casual_dining", "street_food", "seafood_restaurant", "local_cafe", etc.
const DINING_CATEGORIES = ['dining', 'restaurant', 'food', 'cafe', 'meal'];

// Meal time windows. A dining card only credits a meal when its start falls in
// the matching window (so "Lunch at X" at 15:55 does NOT satisfy lunch — the
// real midday slot is still empty).
const MEAL_WINDOWS: Record<MealSlot, { fromMins: number; toMins: number }> = {
  breakfast: { fromMins: 6 * 60, toMins: 11 * 60 },        // 06:00–11:00
  lunch: { fromMins: 11 * 60, toMins: 15 * 60 },           // 11:00–15:00
  dinner: { fromMins: 17 * 60, toMins: 22 * 60 + 1 },      // 17:00–22:00 (incl.)
};

// Cocktail bars / lounges / nightcap venues do NOT count as dinner.
const DRINKS_ONLY_RE = /\b(cocktails?|nightcap|drinks?|bar|lounge|aperitifs?|speakeasy|aperitivo)\b/i;

// Food halls / gourmet food markets are eating venues even when the model tags
// them as an "activity" (e.g. "Social Hour at Time Out Market"). They get the
// same time-based meal credit as a dining card. Closes the "Day N missing
// dinner" false-positive when dinner is actually a food-hall stop.
const FOOD_HALL_RE = /\b(food\s?halls?|food\s?courts?|food\s?markets?|gourmet\s?markets?|street\s?food|time\s?out\s?market|mercado|eataly|borough\s?market)\b/i;
// …but a market VISIT / sightseeing market is not a meal.
const MARKET_SIGHTSEEING_RE = /\b(market\s?visit|visit(?:ing)?\s+(?:the\s+)?market|market\s?tour|tour\s+of\s+(?:the\s+)?market|flower\s?market|christmas\s?market|flea\s?market|antiques?\s?market|fish\s?market\s?tour)\b/i;

// Titles where a meal keyword is preceded by a temporal modifier
// ("Freshen up before dinner", "Heading to brunch") are NOT real meals.
const TEMPORAL_MEAL_MODIFIER_RE = /\b(before|after|for|prep|prepare|preparing|ahead\s+of|en\s+route\s+to|on\s+the\s+way\s+to|heading\s+to|towards?)\s+\w*\s*(breakfast|brunch|lunch|dinner|supper)\b/i;

// Sentinel patterns meaning "no real venue here yet" — must NOT satisfy meal
// compliance ("Lunch — pick a restaurant", "find a local spot in <city>").
const PLACEHOLDER_MEAL_TITLE_RE = /[—\-:]\s*pick a (restaurant|caf[eé])\b|^pick a (restaurant|caf[eé])\b|—\s*find a (?:\w+\s+)?(venue|restaurant|spot|option|place|caf[eé])\b/i;

function parseTimeToMinutes(timeStr: unknown): number | null {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const mins = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours !== 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  if (!period && hours >= 24) return null;
  return hours * 60 + mins;
}

/** Read whichever start-time alias the payload uses. */
function pickStartMins(a: any): number | null {
  return (
    parseTimeToMinutes(a?.startTime) ??
    parseTimeToMinutes(a?.start_time) ??
    parseTimeToMinutes(a?.time)
  );
}

/** A placeholder/unverified slot never satisfies meal compliance. */
export function isPlaceholderMealActivity(activity: any): boolean {
  // VENUE-RESOLVED SWAP EXEMPTION: the cross-day dedup's venue swap
  // (c3-restaurant-swap / c3-places-swap) replaces a placeholder with a REAL
  // catalog/Places venue, but cards swapped before 2026-06-12 still carry the
  // original sentinel's metadata flags. Those persisted cards must count as
  // real meals — treating them as placeholders made every save-itinerary pass
  // re-inject a sentinel and drop the real venue (Munich no-op-save bug:
  // "Lunch at Zum Alten Markt" → "Lunch — find a local spot…", ready→partial).
  // Scoped strictly to swap-sourced cards whose title AND venue are concrete.
  {
    const src = String(activity?.source || '');
    const t = (activity?.title || activity?.name || '').toString();
    const v = (activity?.location?.name || activity?.venue_name || '').toString().trim();
    const concreteText = v.length > 2 && !PLACEHOLDER_MEAL_TITLE_RE.test(t) && !PLACEHOLDER_MEAL_TITLE_RE.test(v);
    if (/^c3-(restaurant|places)-swap$/.test(src) && concreteText) return false;
    // ESTABLISHMENT-FORM EXEMPTION (generalizes the swap exemption above):
    // fix-placeholders stamps unverified_venue on LLM dining cards, so a
    // regenerated day's "Breakfast at Chez Boulay" arrived flagged — the
    // save-path guard called it a placeholder, injected a protected "find a
    // local spot" sentinel, and the collapse dropped the NAMED meal (Quebec
    // City edit-regression round 3: all three meals became sentinels, trip
    // ready→partial). A meal titled "… at <Venue>" with a concrete venue is
    // named coverage — strictly better for the user than the sentinel that
    // would replace it. The generic "Lunch in <City>" form has no "at", so it
    // still counts as a placeholder and still gets venue-resolved (G6 parity).
    if (concreteText && /\b(?:breakfast|brunch|lunch|dinner|supper)\b\s+(?:at|@)\s+\S/i.test(t)) return false;
  }
  const meta = (activity?.metadata || {}) as Record<string, unknown>;
  if (meta.needsVenuePick === true || meta.unverified_venue === true) return true;
  if (meta.preserveAsManualPick === true) return true;
  if (activity?.needsVenuePick === true) return true;
  const title = (activity?.title || activity?.name || '').toString();
  const venue = (activity?.location?.name || activity?.venue_name || '').toString();
  if (PLACEHOLDER_MEAL_TITLE_RE.test(title)) return true;
  if (PLACEHOLDER_MEAL_TITLE_RE.test(venue)) return true;
  return false;
}

/**
 * Which meal slots, if any, this single activity satisfies. Usually 0 or 1.
 * Mirrors the guard's per-activity accumulation exactly.
 */
export function classifyMealSlots(activity: any): MealSlot[] {
  if (!activity || isPlaceholderMealActivity(activity)) return [];

  const rawTitle = (activity.title || activity.name || '').toString();
  const title = rawTitle.toLowerCase();
  const category = (activity.category || '').toString().toLowerCase();
  const isDining = DINING_CATEGORIES.some((c) => category.includes(c));
  // A food hall counts as an eating venue for time-based credit even if it's
  // tagged "activity" — unless it's a sightseeing market visit.
  const isFoodHall = FOOD_HALL_RE.test(rawTitle) && !MARKET_SIGHTSEEING_RE.test(rawTitle);
  const hasTemporalModifier = TEMPORAL_MEAL_MODIFIER_RE.test(rawTitle);
  const startMins = pickStartMins(activity);

  const detected = new Set<MealSlot>();

  for (const mealType of Object.keys(MEAL_KEYWORDS) as MealSlot[]) {
    const titleHit = MEAL_KEYWORDS[mealType].some((k) => title.includes(k));
    const categoryHit = MEAL_KEYWORDS[mealType].some((k) => category.includes(k));

    // A meal keyword in the title on a NON-dining card, or behind a temporal
    // modifier, is a false positive ("Walk before dinner").
    if (titleHit && (!isDining || hasTemporalModifier)) continue;

    if (isDining && (titleHit || categoryHit)) {
      // Out-of-window title hit ("Lunch at X" at 15:55) doesn't fill the slot.
      if (titleHit && startMins !== null) {
        const w = MEAL_WINDOWS[mealType];
        if (startMins < w.fromMins || startMins >= w.toMins) continue;
      }
      detected.add(mealType);
    }
  }

  // Time-based detection for dining cards with a neutral title (e.g. "De Kas"),
  // and for food halls / gourmet markets tagged as activities (e.g. "Time Out
  // Market" at dinnertime).
  if ((isDining || isFoodHall) && startMins !== null) {
    if (startMins >= MEAL_WINDOWS.breakfast.fromMins && startMins < MEAL_WINDOWS.breakfast.toMins) {
      detected.add('breakfast');
    } else if (startMins >= MEAL_WINDOWS.lunch.fromMins && startMins < MEAL_WINDOWS.lunch.toMins) {
      detected.add('lunch');
    } else if (startMins >= 17 * 60 && startMins <= 22 * 60) {
      if (!DRINKS_ONLY_RE.test(title)) detected.add('dinner');
    }
  }

  return Array.from(detected);
}

/** Convenience single-slot classifier (first match) for per-card call sites. */
export function classifyMealSlot(activity: any): MealSlot | null {
  return classifyMealSlots(activity)[0] ?? null;
}

/** The set of meal slots present across a day's activities. */
export function detectMealSlots(activities: readonly any[] | null | undefined): MealSlot[] {
  const detected = new Set<MealSlot>();
  if (Array.isArray(activities)) {
    for (const a of activities) {
      for (const slot of classifyMealSlots(a)) detected.add(slot);
    }
  }
  return (['breakfast', 'lunch', 'dinner'] as MealSlot[]).filter((m) => detected.has(m));
}
