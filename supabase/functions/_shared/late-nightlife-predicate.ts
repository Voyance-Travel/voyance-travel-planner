/**
 * Shared late-nightlife predicate.
 *
 * Decides whether a day's chronological tail counts as "late nightlife"
 * for the purpose of injecting a post-midnight `late_nightlife_bookend`
 * hotel-return card.
 *
 * Three dimensions OR'd together:
 *   1. Title regex (broad — vermut/wine bar/taberna/bodega/pub/tavern,
 *      not just nightclub/cocktail/bar). The original narrow set missed
 *      "La Rosa Vermutería" on Mallorca.
 *   2. Category set (NIGHTLIFE/BAR/COCKTAILS/LOUNGE/ENTERTAINMENT/DRINKS).
 *   3. Time-anchored fallback — a long evening activity (start ≥ 21:00)
 *      that runs into the wrap window (end 00:00–02:30) is empirically
 *      nightlife regardless of title or category.
 *
 * Mirrored on the FE in src/lib/itinerary/lateNightlifePredicate.ts.
 */
export const LATE_NIGHTLIFE_TITLE_RE =
  /\b(speakeasy|nightclub|cocktail|nightcap|club|lounge|bar|aperitif|aperitivo|vermut|vermuteria|vermutería|taberna|bodega|tavern|pub|wine\s*bar|cava|digestif|late\s*drinks|after[-\s]?dinner\s*drinks|drinks?)\b/i;

export const LATE_NIGHTLIFE_CATS = new Set([
  'NIGHTLIFE',
  'BAR',
  'ENTERTAINMENT',
  'COCKTAILS',
  'LOUNGE',
  'DRINKS',
]);

/** end ∈ [00:00, 02:30] AND start ≥ 21:00 → empirically late nightlife. */
export function isLateNightlikeTail(
  startMins: number | null | undefined,
  endMins: number | null | undefined,
): boolean {
  if (startMins == null || endMins == null) return false;
  if (startMins < 21 * 60) return false;
  return endMins >= 0 && endMins <= 2 * 60 + 30;
}

export function qualifiesAsLateNightlife(
  act: { title?: unknown; name?: unknown; category?: unknown } | null | undefined,
  startMins: number | null | undefined,
  endMins: number | null | undefined,
): boolean {
  if (!act) return isLateNightlikeTail(startMins, endMins);
  const title = String((act as any).title || (act as any).name || '');
  const cat = String((act as any).category || '').toUpperCase();
  if (LATE_NIGHTLIFE_TITLE_RE.test(title)) return true;
  if (LATE_NIGHTLIFE_CATS.has(cat)) return true;
  return isLateNightlikeTail(startMins, endMins);
}
