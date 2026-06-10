/**
 * ACTION: place-held-item
 *
 * Server-authoritative placement of a "Saved for later" (holding bay) item into a
 * day, using the explicit trade-off model (the chosen design):
 *   - mode 'preview' : compute + return the card this placement would displace. No mutation.
 *   - mode 'swap'    : place the held item in the candidate's slot; the displaced card
 *                      goes BACK to the bay (lossless, two-way). Held item leaves the bay.
 *   - mode 'add'     : append the held item to the day (it gets busier). Nothing displaced.
 *
 * Reads/writes trips.itinerary_data (via persistTripItinerary) + trips.metadata.holding_bay.
 * Guardrails: never displaces logistics, locked cards, or user must-dos.
 */
import { type ActionContext, okJson, errorJson, verifyTripAccess } from './action-types.ts';

const pMin = (s: unknown): number | null => {
  const m = String(s ?? '').match(/(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : null;
};
const hhmm = (n: number) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(Math.max(0, n % 60)).padStart(2, '0')}`;
const lc = (s: unknown) => String(s ?? '').toLowerCase();

const isLogistics = (a: any) =>
  ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics'].includes(lc(a?.category)) ||
  /check.?in|check.?out|transfer|airport|\bflight\b|return to|travel to/i.test(lc(a?.title));
const isLockedCard = (a: any) => !!(a?.locked || a?.isLocked || a?.lock_state === 'locked');
const isUserMustDo = (a: any) =>
  a?.lockedSource === 'must_do' || a?.lockedSource === 'user' || /must[_-]?do|user[_-]?anchor/i.test(lc(a?.source));
const catOf = (a: any): string => {
  const c = lc(a?.category);
  if (c) return c;
  const t = lc(a?.title);
  if (/\bbreakfast\b|\bbrunch\b/.test(t)) return 'breakfast';
  if (/\blunch\b/.test(t)) return 'lunch';
  if (/\bdinner\b/.test(t)) return 'dinner';
  return '';
};
const heldCategory = (item: any): string => {
  const t = lc(item?.resolved?.category || item?.label);
  if (/dinner|splurge/.test(t)) return 'dinner';
  if (/lunch/.test(t)) return 'lunch';
  if (/breakfast|brunch/.test(t)) return 'breakfast';
  return 'activity';
};

/** Spec §3.2 — first eligible match: same category → non-marquee filler → any. Never logistics/locked/must-do. */
function pickSwapCandidate(activities: any[], heldCat: string): number {
  const eligible = (a: any) => !isLogistics(a) && !isLockedCard(a) && !isUserMustDo(a);
  let idx = activities.findIndex((a) => eligible(a) && catOf(a) && catOf(a) === heldCat);
  if (idx >= 0) return idx;
  idx = activities.findIndex((a) => eligible(a) && !/sightseeing|museum|landmark|tour|gallery/.test(catOf(a) + lc(a?.title)));
  if (idx >= 0) return idx;
  return activities.findIndex((a) => eligible(a));
}

function buildCard(item: any, startMin: number | null, durationMin: number) {
  const title = item?.resolved?.title || item?.label || 'Saved item';
  const start = startMin != null ? hhmm(startMin) : undefined;
  const end = startMin != null ? hhmm(Math.min(startMin + durationMin, 1439)) : undefined;
  return {
    id: `placed-${item.id}-${Math.random().toString(36).slice(2, 8)}`,
    title,
    name: title,
    category: item?.resolved?.category || heldCategory(item),
    description: item?.resolved?.description || `Added from Saved for later${item?.originalMustDo ? ` — ${item.originalMustDo}` : ''}.`,
    startTime: start,
    time: start,
    endTime: end,
    durationMinutes: durationMin,
    location: item?.resolved ? { name: item.resolved.venueName, address: item.resolved.address } : undefined,
    source: 'held-item-placed',
  };
}

export async function handlePlaceHeldItem(ctx: ActionContext): Promise<Response> {
  const { supabase, userId, params } = ctx;
  const { tripId, heldItemId, dayNumber, mode } = params;

  if (!tripId || !heldItemId || dayNumber == null || !mode) {
    return errorJson('Missing tripId, heldItemId, dayNumber, or mode', 400);
  }
  if (!['preview', 'swap', 'add'].includes(mode)) {
    return errorJson('mode must be preview | swap | add', 400);
  }

  const access = await verifyTripAccess(supabase, tripId, userId, true);
  if (!access.allowed) return errorJson(access.reason || 'Access denied', 403);

  const { data: row, error } = await supabase
    .from('trips').select('itinerary_data, metadata').eq('id', tripId).single();
  if (error || !row) return errorJson('Trip not found', 404);

  const itinerary = (row.itinerary_data || {}) as any;
  const days: any[] = Array.isArray(itinerary.days) ? itinerary.days : [];
  const meta = (row.metadata || {}) as any;
  const bay: any[] = Array.isArray(meta.holding_bay) ? meta.holding_bay : [];

  const item = bay.find((h) => h?.id === heldItemId);
  if (!item) return errorJson('Held item not found in bay', 404);

  const day = days.find((d) => Number(d?.dayNumber) === Number(dayNumber));
  if (!day || !Array.isArray(day.activities)) return errorJson(`Day ${dayNumber} not found`, 404);

  const heldCat = heldCategory(item);
  const durationMin = Number(item?.resolved?.durationMin) || 90;
  const candIdx = pickSwapCandidate(day.activities, heldCat);
  const candidate = candIdx >= 0 ? day.activities[candIdx] : null;
  const nonLogistics = day.activities.filter((a: any) => !isLogistics(a));
  const allPinned = nonLogistics.length > 0 && nonLogistics.every((a: any) => isLockedCard(a) || isUserMustDo(a));

  // ── preview: no mutation ──
  if (mode === 'preview') {
    return okJson({
      success: true,
      candidate: candidate
        ? { title: candidate.title || candidate.name, startTime: candidate.startTime || candidate.time || null, category: catOf(candidate) }
        : null,
      allPinned,
    });
  }

  // ── commit ──
  let displaced: any = null;
  if (mode === 'swap') {
    if (candIdx < 0) return errorJson('No swappable card on this day', 409, { allPinned });
    const slotStart = pMin(candidate.startTime || candidate.time);
    displaced = day.activities[candIdx];
    day.activities[candIdx] = buildCard(item, slotStart, durationMin);
  } else {
    // add — append after the last timed card (+15m), bounded, then re-sort by time
    let lastEnd = 0;
    for (const a of day.activities) {
      const e = pMin(a?.endTime) ?? pMin(a?.startTime || a?.time);
      if (e != null) lastEnd = Math.max(lastEnd, e);
    }
    const start = Math.min(Math.max(lastEnd + 15, 9 * 60), 1380);
    day.activities.push(buildCard(item, start, durationMin));
    day.activities.sort((a: any, b: any) => (pMin(a.startTime || a.time) ?? 1e9) - (pMin(b.startTime || b.time) ?? 1e9));
  }

  // held item leaves the bay; a swapped-out card RE-ENTERS it (lossless, two-way)
  let newBay = bay.filter((h) => h?.id !== heldItemId);
  if (displaced) {
    newBay = [...newBay, {
      id: `held-swap-${(displaced.id || Math.random().toString(36).slice(2, 8))}`.slice(0, 60),
      source: 'user_swap',
      label: displaced.title || displaced.name || 'Swapped item',
      resolved: {
        title: displaced.title || displaced.name,
        venueName: displaced.location?.name || displaced.title || displaced.name,
        address: displaced.location?.address,
        category: displaced.category || catOf(displaced),
        durationMin: Number(displaced.durationMinutes) || 90,
        description: displaced.description,
      },
      createdAt: new Date().toISOString(),
    }];
  }

  const { persistTripItinerary } = await import('../_shared/persist-itinerary.ts');
  const { error: saveErr } = await persistTripItinerary(
    supabase, tripId, { ...itinerary, days },
    { skipContract: true, label: 'place-held-item', saveReason: 'edit-place-held-item' },
  );
  if (saveErr) {
    console.error('[place-held-item] persist failed:', saveErr);
    return errorJson('Failed to save itinerary', 500);
  }

  meta.holding_bay = newBay;
  await supabase.from('trips').update({ metadata: meta }).eq('id', tripId);

  console.log(`[place-held-item] ${mode} item=${heldItemId} day=${dayNumber} displaced=${displaced ? (displaced.title || displaced.name) : 'none'} bay=${newBay.length}`);
  return okJson({
    success: true,
    mode,
    dayNumber,
    displaced: displaced ? (displaced.title || displaced.name) : null,
    holding_bay_count: newBay.length,
  });
}
