/**
 * ledger-check.ts — Post-generation validation of the Day Truth Ledger / Day Brief.
 *
 * Runs AFTER applyAnchorsWin. Catches the cases anchor-guard can't:
 *  - Fuzzy duplicates of "alreadyDone" titles on later days.
 *  - Activities that violate a known closure today.
 *  - Missing user-required ('must') intents that the AI silently dropped —
 *    inserts a visible placeholder activity so the front-end can surface it
 *    rather than letting the user's request vanish.
 *  - Vibe clashes against forward state (e.g. two splurge dinners back-to-back).
 *
 * Returns a list of warnings + a (possibly mutated) days array. Does NOT
 * regenerate; that's the caller's choice.
 */

import type { DayLedger, LedgerUserIntent } from './day-ledger.ts';

export interface LedgerCheckWarning {
  dayNumber: number;
  kind:
    | 'missing_user_intent'
    | 'missing_user_intent_restored'
    | 'repeat_already_done'
    | 'closure_violation'
    | 'vibe_clash';
  detail: string;
}

export interface LedgerCheckResult {
  days: any[];
  warnings: LedgerCheckWarning[];
  removed: number;
  /** Number of placeholder activities inserted to surface missing must-items. */
  inserted: number;
}

function fuzzyMatch(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  return false;
}

/**
 * Daily anchors are activities that BY DESIGN repeat every day:
 *   - Returns/transfers to/from the hotel
 *   - Midday "freshen up" / wellness refresh
 *   - In-hotel breakfast (when applicable)
 *   - Hotel check-in/out
 * They must bypass the repeat-already-done dedup, otherwise every day after
 * day 1 is stripped of its structural anchors. Core memory: "Believable
 * Human Day" and "Universal Locking Protocol".
 */
const DAILY_ANCHOR_PATTERNS: RegExp[] = [
  /^\s*(return to|travel to|taxi to|head back to|back to|drive to|walk back to|transfer to)\b.*\b(hotel|resort|inn|stay|accommodation|lodging|villa|riad|ryokan|airbnb|marriott|hilton|hyatt|four seasons|ritz|peninsula|mandarin|aman|rosewood|park hyatt)\b/i,
  /^\s*(freshen up|wellness refresh|midday (break|refresh|rest)|siesta|recharge|rest at|relax at|break at)\b/i,
  /^\s*check[\- ]?(in|out)\b/i,
  /^\s*(breakfast|coffee) at (the )?(hotel|marriott|hilton|hyatt|four seasons|ritz|peninsula|mandarin|aman|rosewood|park hyatt|your)\b/i,
  /\bhotel\b.*\b(refresh|freshen|wellness|return|drop off|drop-off)\b/i,
];

const DAILY_ANCHOR_CATEGORIES = new Set([
  'transport', 'transportation', 'transit', 'accommodation', 'lodging', 'hotel',
]);

function isDailyAnchor(activity: any): boolean {
  const title = String(activity?.title || activity?.name || '').toLowerCase();
  if (!title) return false;
  for (const pat of DAILY_ANCHOR_PATTERNS) {
    if (pat.test(title)) return true;
  }
  // Category-based: any transport/accommodation entry whose title references "hotel"
  // is a daily ritual, not a unique attraction.
  const cat = String(activity?.category || activity?.type || '').toLowerCase();
  if (DAILY_ANCHOR_CATEGORIES.has(cat) && /\bhotel|resort|inn|lodging|stay\b/.test(title)) {
    return true;
  }
  // Wellness category that explicitly references the hotel/freshen-up pattern
  if (cat === 'wellness' && /\b(freshen|refresh|midday|siesta|hotel)\b/.test(title)) {
    return true;
  }
  return false;
}

function buildPlaceholderForIntent(intent: LedgerUserIntent, dayNumber: number) {
  const startTime = intent.startTime || (
    intent.kind === 'breakfast' ? '08:30' :
    intent.kind === 'lunch' ? '13:00' :
    intent.kind === 'dinner' ? '19:30' :
    intent.kind === 'drinks' ? '18:00' :
    intent.kind === 'spa' ? '15:00' :
    '11:00'
  );
  const endTime = intent.endTime || (() => {
    const m = startTime.match(/(\d{1,2}):(\d{2})/);
    if (!m) return undefined;
    const total = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + 90;
    const hh = String(Math.floor(total / 60) % 24).padStart(2, '0');
    const mm = String(total % 60).padStart(2, '0');
    return `${hh}:${mm}`;
  })();
  return {
    id: `placeholder-${dayNumber}-${intent.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
    title: intent.title,
    name: intent.title,
    description: `User-requested ${intent.kind}. Confirm and finalize details.`,
    category: intent.kind === 'avoid' ? 'note' : (intent.kind === 'activity' ? 'activity' : intent.kind),
    startTime,
    endTime,
    location: { name: '', address: '' },
    cost: { amount: 0, currency: 'USD' },
    isLocked: false,
    lockedSource: intent.lockedSource,
    isUserRequested: true,
    placeholder: true,
    intentSource: intent.source,
    note: intent.note,
  } as Record<string, any>;
}

function isSplurgeDinner(a: any): boolean {
  const t = (a?.title || a?.name || '').toLowerCase();
  if (!t.includes('dinner')) return false;
  const cost = a?.cost?.amount ?? a?.estimatedCost?.amount ?? 0;
  if (typeof cost === 'number' && cost >= 100) return true;
  // Flag well-known luxury markers in the title
  if (/\b(michelin|tasting menu|chef'?s table|omakase)\b/i.test(t)) return true;
  return false;
}

export async function ledgerCheck(
  days: any[],
  ledgers: DayLedger[],
  opts?: { supabase?: any; tripId?: string },
): Promise<LedgerCheckResult> {
  const warnings: LedgerCheckWarning[] = [];
  let removed = 0;
  let inserted = 0;
  if (!Array.isArray(days) || !Array.isArray(ledgers) || ledgers.length === 0) {
    return { days, warnings, removed, inserted };
  }

  const ledgerByDay = new Map<number, DayLedger>();
  for (const l of ledgers) ledgerByDay.set(l.dayNumber, l);

  // ── Fallback verification: if any day's ledger has empty userIntent BUT
  // the structured `trip_day_intents` table has 'must' rows for that day,
  // the compile-prompt fetch likely failed. Re-fetch and merge in.
  if (opts?.supabase && opts?.tripId) {
    try {
      const emptyDays = ledgers.filter((l) => !l.userIntent || l.userIntent.length === 0).map((l) => l.dayNumber);
      if (emptyDays.length > 0) {
        const { fetchActiveDayIntents } = await import('../_shared/day-intents-store.ts');
        const rows = await fetchActiveDayIntents(opts.supabase, opts.tripId);
        for (const r of rows) {
          if (r.status === 'fulfilled') continue;
          if (r.day_number == null) continue;
          if (!emptyDays.includes(r.day_number)) continue;
          const ledger = ledgerByDay.get(r.day_number);
          if (!ledger) continue;
          ledger.userIntent.push({
            title: r.title,
            kind: r.intent_kind as any,
            priority: r.priority as any,
            startTime: r.start_time || undefined,
            endTime: r.end_time || undefined,
            locked: !!r.locked,
            lockedSource: r.locked_source || undefined,
            source: r.source_entry_point as any,
            note: (r.raw_text as string) || undefined,
          } as LedgerUserIntent);
        }
      }
    } catch (e) {
      console.warn('[ledger-check] fallback fetch failed (non-blocking):', String(e));
    }
  }

  const out = days.map((d) => ({
    ...d,
    activities: Array.isArray(d.activities) ? [...d.activities] : [],
  }));


  for (const day of out) {
    const dayNum = (day.dayNumber as number) || 0;
    const ledger = ledgerByDay.get(dayNum);
    if (!ledger) continue;

    // 1) Check missing userIntent — for 'must' items, INSERT a visible placeholder
    //    so the user can see their request. Anchor-guard handles locked items;
    //    this catches soft 'must' intents (fine-tune, assistant chat) that the
    //    AI silently ignored.
    for (const u of ledger.userIntent) {
      const present = day.activities.some((a: any) =>
        fuzzyMatch(a.title || a.name || '', u.title)
      );
      if (present) continue;

      if (u.priority === 'must' && !u.locked && u.kind !== 'avoid') {
        // Insert placeholder so the user sees their intent surfaced.
        const placeholder = buildPlaceholderForIntent(u, dayNum);
        day.activities.push(placeholder);
        inserted++;
        warnings.push({
          dayNumber: dayNum,
          kind: 'missing_user_intent_restored',
          detail: `User-requested "${u.title}" was missing on day ${dayNum} — inserted a placeholder so the user can confirm or replace it.`,
        });
      } else {
        warnings.push({
          dayNumber: dayNum,
          kind: 'missing_user_intent',
          detail: `User-locked "${u.title}" missing on day ${dayNum} (anchor-guard should restore it).`,
        });
      }
    }

    // 2) Repeat-of-alreadyDone — drop offending activity (only if not user-locked).
    //    EXEMPTION: daily anchors (Return to Hotel, Freshen Up, Check-in, in-hotel
    //    breakfast, hotel transfers) are SUPPOSED to repeat every day. Without
    //    this exemption every day after day 1 was being stripped of its
    //    Believable-Human structure (see Core memory).
    const doneSet = ledger.alreadyDone.map((p) => p.title.toLowerCase());
    day.activities = day.activities.filter((a: any) => {
      if (a.locked || a.isLocked || a.lockedSource) return true;
      if (isDailyAnchor(a)) return true;
      const t = (a.title || a.name || '').toLowerCase().trim();
      if (!t) return true;
      const repeat = doneSet.some((d) => fuzzyMatch(t, d));
      if (repeat) {
        warnings.push({
          dayNumber: dayNum,
          kind: 'repeat_already_done',
          detail: `Removed "${a.title || a.name}" on day ${dayNum} — already scheduled on a prior day.`,
        });
        removed++;
        return false;
      }
      return true;
    });

    // 3) Closure violation — drop activity whose title matches a closure example
    for (const c of ledger.closures) {
      if (!c.examples || c.examples.length === 0) continue;
      day.activities = day.activities.filter((a: any) => {
        if (a.locked || a.isLocked || a.lockedSource) return true;
        const t = (a.title || a.name || '').toLowerCase().trim();
        const venue = (a.venue_name || a.location?.name || '').toLowerCase();
        const matchesClosed = c.examples!.some((ex) => {
          const exL = ex.toLowerCase();
          return t.includes(exL) || venue.includes(exL);
        });
        if (matchesClosed) {
          warnings.push({
            dayNumber: dayNum,
            kind: 'closure_violation',
            detail: `Removed "${a.title || a.name}" on day ${dayNum} — ${c.reason}.`,
          });
          removed++;
          return false;
        }
        return true;
      });
    }

    // 4) Vibe clash — flag (do not remove) if today AND a forward day are both splurge dinners
    if (ledger.forwardState && ledger.forwardState.length > 0) {
      const todaySplurge = day.activities.find((a: any) => isSplurgeDinner(a));
      const tomorrowSplurge = ledger.forwardState.find(
        (f) => f.dayNumber === dayNum + 1 && f.kind === 'dinner'
      );
      if (todaySplurge && tomorrowSplurge) {
        warnings.push({
          dayNumber: dayNum,
          kind: 'vibe_clash',
          detail: `Two splurge dinners back-to-back: "${todaySplurge.title || todaySplurge.name}" (day ${dayNum}) and "${tomorrowSplurge.title}" (day ${dayNum + 1}). Consider a casual option one of these nights.`,
        });
      }
    }
  }

  return { days: out, warnings, removed, inserted };
}
