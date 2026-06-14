/**
 * verify-drop-venues — ground every NAMED venue against Google Places and DROP
 * the ones that don't confidently exist (the thin-day backfill refills). Catches
 * hallucinations like "Marrakesh Market → modern Israeli cuisine".
 *
 * SAFETY: this drops content, so it is strictly FAIL-OPEN. A venue is dropped
 * ONLY on a confident negative (Places returned 0 results / geo-rejected /
 * cross-city / a low-overlap different venue). It is KEPT whenever we could not
 * actually check (no API key, HTTP error, timeout, time-budget exhausted, or a
 * cache hit). A Places outage must never gut a day.
 *
 * COST: one Places lookup per uncached named venue. The 60-day verified_venues
 * cache (checkVenueCache) makes popular venues ~free after the first lookup; a
 * wall-clock budget bounds the worst case.
 */
import { checkVenueCache, verifyVenueWithGooglePlaces } from './venue-enrichment.ts';
import type { VenueVerification } from './generation-types.ts';

const VERIFIABLE_CAT_RE = /\b(dining|restaurant|food|cafe|caf[eé]|bar|nightlife|sightseeing|attraction|cultural|culture|museum|gallery|landmark|shopping|market|activity|experience|tour)\b/i;
const NON_VENUE_CAT_RE = /\b(transit|transport|logistics|flight|accommodation|hotel|lodging|transfer|commute|departure|arrival)\b/i;
const NON_VENUE_TITLE_RE = /\b(at your hotel|your hotel|free time|down\s?time|rest\b|relax|leisure time|explore the (?:area|neighbou?rhood)|wander|stroll around|walk around)\b/i;

/** A named venue we can meaningfully look up — excludes logistics, locked /
 *  user-authored cards, curated host-city events, and generic non-venue blocks. */
export function isVerifiableVenue(a: any): boolean {
  if (!a) return false;
  if (a.locked || a.isLocked || a.isUserAuthored) return false;
  if (a.source === 'host-city-event') return false; // curated, already real
  const cat = String(a.category ?? '').toLowerCase();
  if (NON_VENUE_CAT_RE.test(cat)) return false;
  if (!VERIFIABLE_CAT_RE.test(cat)) return false;
  const title = String(a.title ?? a.name ?? '');
  if (NON_VENUE_TITLE_RE.test(title)) return false;
  return true;
}

/** The best venue name to look up from an activity. */
export function venueNameOf(a: any): string {
  const loc = a?.location?.name || (typeof a?.location === 'string' ? a.location : '');
  if (loc && String(loc).trim().length >= 3) return String(loc).trim();
  // Strip a leading verb/meal prefix from the title ("Lunch at Foo" → "Foo").
  return String(a?.title ?? a?.name ?? '')
    .replace(/^(?:breakfast|brunch|lunch|dinner|nightcap|drinks?|coffee|visit(?:ing)?|explore|see|tour|experience|watch|observe|stroll(?:\s+through)?)\b[\s:–—-]*(?:at|the|on)?\s*/i, '')
    .trim();
}

/**
 * Pure decision: given a verdict from verifyVenueWithGooglePlaces, should the
 * venue be dropped? FAIL-OPEN — only confident negatives drop. Unit-tested.
 */
export function shouldDropFromVerdict(v: VenueVerification | null): boolean {
  if (v === null) return true;                 // ok response, 0 results, or geo-reject → not real here
  if (v.errored) return false;                 // couldn't check → KEEP
  if ((v as any).crossCityHallucination) return true; // real venue, wrong city → drop
  if (v.isValid && (v.confidence ?? 0) >= 0.5) return false; // confident match → keep
  return true;                                 // isValid:false or low-overlap different venue → drop
}

export interface VerifyDropResult {
  activities: any[];
  dropped: Array<{ title: string; reason: string }>;
  checked: number;
  verified: number;
}

/**
 * Verify all named venues in a day's activities and drop the unverifiable ones.
 * Mutates nothing; returns the kept activities + a drop log. Concurrency-batched
 * and wall-clock-budgeted; on budget exhaustion the remainder is kept.
 */
export async function verifyAndDropVenues(
  activities: any[],
  ctx: {
    destination: string;
    supabaseUrl: string;
    supabaseKey: string;
    googleKey?: string;
    hotelCoordinates?: { lat: number; lng: number };
    timeBudgetMs?: number;
    nowMs?: number; // injectable for tests
  },
): Promise<VerifyDropResult> {
  const acts = Array.isArray(activities) ? activities : [];
  const dropped: VerifyDropResult['dropped'] = [];
  let checked = 0, verified = 0;
  // No key → we cannot verify anything; keep everything (fail-open).
  if (!ctx.googleKey) return { activities: acts, dropped, checked, verified };

  const budget = ctx.timeBudgetMs ?? 25_000;
  const startMs = ctx.nowMs ?? Date.now();
  const keep: any[] = [];
  const BATCH = 3;

  for (let i = 0; i < acts.length; i += BATCH) {
    if (Date.now() - startMs >= budget) { keep.push(...acts.slice(i)); break; } // budget → keep rest
    const batch = acts.slice(i, i + BATCH);
    const decisions = await Promise.all(batch.map(async (a) => {
      if (!isVerifiableVenue(a)) return { a, drop: false, reason: '' };
      const name = venueNameOf(a);
      if (!name || name.length < 3) return { a, drop: false, reason: '' };
      checked++;
      try {
        const cached = await checkVenueCache(name, ctx.destination, ctx.supabaseUrl, ctx.supabaseKey);
        if (cached) { verified++; return { a, drop: false, reason: '' }; }
        const v = await verifyVenueWithGooglePlaces(name, ctx.destination, ctx.googleKey, ctx.hotelCoordinates);
        const drop = shouldDropFromVerdict(v);
        if (!drop) verified++;
        const reason = v === null ? 'not_found' : ((v as any).crossCityHallucination ? 'cross_city' : 'low_confidence');
        return { a, drop, reason };
      } catch {
        return { a, drop: false, reason: '' }; // exception → keep (fail-open)
      }
    }));
    for (const d of decisions) {
      if (d.drop) dropped.push({ title: String(d.a.title || d.a.name || '?'), reason: d.reason });
      else keep.push(d.a);
    }
  }
  return { activities: keep, dropped, checked, verified };
}
