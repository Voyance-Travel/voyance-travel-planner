/**
 * Frontend safety-net for dining card descriptions.
 *
 * Mirrors the backend `buildDeterministicDiningDescription` in
 * supabase/functions/_shared/dining-description-backfill.ts so that
 * already-saved trips whose JSON has empty dining descriptions still
 * render an actionable blurb without requiring a re-save.
 *
 * Dining card NEVER renders blank — even if the LLM omitted a description,
 * a meal-guard wrote sanitizer-tripping boilerplate, or both backend and
 * frontend sanitizers stripped it to empty, this helper synthesizes a
 * usable blurb from data that's always present (venue + meal keyword).
 *
 * IMPORTANT: this never mutates the activity. It only produces a string
 * to render. Saved data remains untouched.
 *
 * See plan: .lovable/plan.md (restore dining descriptions end-to-end)
 */

const DINING_CATEGORIES = new Set([
  'dining', 'restaurant', 'food', 'breakfast', 'lunch', 'dinner', 'brunch',
  'drinks', 'cafe', 'coffee', 'nightcap', 'bar',
]);

const MEAL_TITLE_RE = /\b(?:breakfast|brunch|lunch|dinner|supper|nightcap|drinks|cocktails?|aperitif|coffee|cafe|café)\b/i;

export function isDiningCard(act: { category?: string; title?: string; name?: string }): boolean {
  if (!act) return false;
  const cat = String(act.category || '').toLowerCase();
  if (DINING_CATEGORIES.has(cat)) return true;
  const title = String(act.title || act.name || '');
  return MEAL_TITLE_RE.test(title);
}

function pickVenueName(act: any): string | null {
  const candidates = [
    act?.location?.name,
    act?.venue_name,
    act?.venueName,
    typeof act?.title === 'string' ? act.title.replace(/^[^@]*\bat\s+/i, '') : '',
    typeof act?.name === 'string' ? act.name.replace(/^[^@]*\bat\s+/i, '') : '',
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const cleaned = c.trim();
      // Avoid generic placeholders ("Dinner", "Lunch", "the destination", etc.)
      if (!cleaned || cleaned.length < 2) continue;
      const lower = cleaned.toLowerCase();
      if (MEAL_TITLE_RE.test(lower) && lower.split(/\s+/).length <= 1) continue;
      if (lower === 'the destination' || lower.startsWith('@ the')) continue;
      return cleaned;
    }
  }
  return null;
}

function pickAddress(act: any): string | null {
  const addr = act?.location?.address;
  if (typeof addr !== 'string') return null;
  const cleaned = addr.trim();
  if (!cleaned || cleaned.length < 4) return null;
  const lower = cleaned.toLowerCase();
  if (lower === 'the destination' || lower.startsWith('@ the')) return null;
  return cleaned;
}

export function deterministicDiningDescription(
  act: { title?: string; name?: string; location?: { name?: string; address?: string }; venue_name?: string } | null | undefined,
  destinationCity?: string,
): string {
  if (!act) return '';
  const titleStr = String((act as any).title || (act as any).name || '');
  const mealLabel = /breakfast|brunch/i.test(titleStr) ? 'breakfast'
                  : /lunch/i.test(titleStr) ? 'lunch'
                  : /dinner|supper/i.test(titleStr) ? 'dinner'
                  : /drinks|nightcap|bar|cocktail|aperitif/i.test(titleStr) ? 'drinks'
                  : /coffee|cafe|café/i.test(titleStr) ? 'coffee'
                  : 'this stop';
  const venue = pickVenueName(act);
  const address = pickAddress(act);
  const cityHint = destinationCity ? ` in ${String(destinationCity).split(/[,/]/)[0].trim()}` : '';
  if (venue) {
    const addrHint = address ? ` Located at ${address}.` : '';
    return `${venue} serves ${mealLabel}${cityHint}.${addrHint} Check opening hours and book ahead — ask the staff what's freshest on the menu today.`;
  }
  return `Pick a well-reviewed local spot for ${mealLabel}${cityHint} — book ahead and ask for the day's specials.`;
}

/**
 * Resolve the dining card's display description.
 * Order: existing description → personalization.whyThisFits → deterministic template.
 * For non-dining cards: returns existing description (or whyThisFits) only — never a template.
 */
export function resolveActivityDisplayDescription(
  act: any,
  existingClean: string,
  destinationCity?: string,
): string {
  if (existingClean && existingClean.trim().length > 0) return existingClean;
  const why = act?.personalization?.whyThisFits;
  if (typeof why === 'string' && why.trim().length >= 20) return why.trim();
  if (isDiningCard(act)) return deterministicDiningDescription(act, destinationCity);
  return '';
}
