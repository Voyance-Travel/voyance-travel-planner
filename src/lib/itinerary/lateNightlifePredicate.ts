/**
 * Frontend mirror of supabase/functions/_shared/late-nightlife-predicate.ts.
 * Keep semantics in sync.
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
