/**
 * Frontend safety-net for dining card descriptions.
 *
 * Mirrors the backend `buildDeterministicDiningDescription` in
 * supabase/functions/_shared/dining-description-backfill.ts so that
 * already-saved trips whose JSON has empty dining descriptions still
 * render an actionable blurb without requiring a re-save.
 *
 * IMPORTANT: this never mutates the activity. It only produces a string
 * to render. Saved data remains untouched.
 *
 * See plan: .lovable/plan.md (restore dining descriptions end-to-end)
 */

const DINING_CATEGORIES = new Set([
  'dining', 'restaurant', 'food', 'breakfast', 'lunch', 'dinner', 'brunch', 'drinks',
]);

const MEAL_TITLE_RE = /^\s*(?:breakfast|brunch|lunch|dinner|drinks|nightcap)\b/i;

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
    typeof act?.title === 'string' ? act.title.replace(/^[^@]*\bat\s+/i, '') : '',
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const cleaned = c.trim();
      if (cleaned && cleaned.length > 1) return cleaned;
    }
  }
  return null;
}

export function deterministicDiningDescription(
  act: { title?: string; name?: string; location?: { name?: string }; venue_name?: string } | null | undefined,
  destinationCity?: string,
): string {
  if (!act) return '';
  const titleStr = String((act as any).title || (act as any).name || '');
  const mealLabel = /breakfast|brunch/i.test(titleStr) ? 'breakfast'
                  : /lunch/i.test(titleStr) ? 'lunch'
                  : /dinner|supper/i.test(titleStr) ? 'dinner'
                  : /drinks|nightcap|bar|cocktail/i.test(titleStr) ? 'drinks'
                  : 'this stop';
  const venue = pickVenueName(act);
  const cityHint = destinationCity ? ` in ${String(destinationCity).split(/[,/]/)[0].trim()}` : '';
  if (venue) {
    return `Book ahead for ${mealLabel} at ${venue}${cityHint} and ask the staff what's freshest on the menu today.`;
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
