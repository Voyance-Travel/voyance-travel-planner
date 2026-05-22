/**
 * chronology-validator — single canonical rule set for per-day timing
 * coherence. Wired at:
 *
 *   • write-time:  persist-itinerary.ts (chokepoint — every JSONB write)
 *   • read-time:   src/utils/itineraryParser.ts (mirror — display safety net)
 *   • backfill:    TripDetail mount-time self-heal (legacy persisted trips)
 *
 * Issues detected (in priority order):
 *
 *   • UNSORTED_BY_START   — activities not in dayChronoKey order
 *   • PREDAWN_NON_BOOKEND — non-bookend, non-locked card with start <06:00
 *                            (after upstream predawn-cascade already ran)
 *   • BACKWARD_JUMP       — startTime[i+1] < startTime[i] by >5 min and
 *                            not a legitimate late-night wrap
 *
 * Heals are deterministic and IN-PLACE:
 *
 *   • sort each day's activities by dayChronoKey (wrap-aware: 23:30 nightcap
 *     precedes 00:10 bookend on same day)
 *   • for Day N >= 2 only, drop any remaining PREDAWN_NON_BOOKEND row
 *     (Day 1 may legitimately start with very-early arrival logistics)
 *
 * If issues remain after heal, the validator returns `criticalAfterHeal=true`
 * — the persist boundary stamps `metadata.quality.chronology_trace` and the
 * write still proceeds (we never silently block customer flow, only stamp
 * for observability — see `trips_with_chronology_issues` view).
 *
 * See mem://constraints/itinerary/chronology-validator-three-gates.
 */

const BOOKEND_SOURCE_RE =
  /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i;

const BOOKEND_TITLE_RE =
  /\b(return to|check[-\s]?in|check[-\s]?out|freshen up|wind down|head back to|retire to|end of day at)\b/i;

const LOGISTICS_TITLE_RE =
  /^(walk to|stroll to|transfer to|drive to|taxi to|ride to|metro to|bus to|train to|tram to|shuttle to|departure flight|arrival flight|flight )\b/i;

const LOCKED_SOURCE_RE = /^(user|user_added|manual|extracted|pinned)$/i;

function parseTimeMin(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  if (!Number.isFinite(h) || !Number.isFinite(mm)) return null;
  return h * 60 + mm;
}

function pickStartMin(a: any): number | null {
  return (
    parseTimeMin(a?.startTime) ??
    parseTimeMin(a?.start_time) ??
    parseTimeMin(a?.time)
  );
}

/**
 * Wrap-aware chronological key matching `dayChronoKey` semantics: a card
 * starting in the [00:00, 06:00) window that follows a late-evening card
 * (>=18:00) sorts AFTER the evening card on the same day (late-night
 * bookends / nightcaps wrap past midnight on the same logical day).
 */
function chronoKey(min: number | null, anchorEveningMin: number | null): number {
  if (min === null) return 24 * 60 + 60; // unknown sorts to tail
  if (min < 6 * 60 && anchorEveningMin !== null && anchorEveningMin >= 18 * 60) {
    // Treat as next-morning continuation — add 24h so it sits after the
    // evening anchor.
    return min + 24 * 60;
  }
  return min;
}

function isBookendLike(a: any): boolean {
  if (!a) return false;
  const src = String(a?.source || '').toLowerCase();
  if (BOOKEND_SOURCE_RE.test(src)) return true;
  const tags = a?.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (BOOKEND_SOURCE_RE.test(String(t).toLowerCase())) return true;
    }
  }
  const title = String(a?.title || a?.name || '');
  if (BOOKEND_TITLE_RE.test(title)) return true;
  if (LOGISTICS_TITLE_RE.test(title)) return true;
  const cat = String(a?.category || '').toLowerCase();
  if (/^(flight|airport[-_ ]?transfer|transfer[-_ ]?to[-_ ]?airport|checkout|check[-_ ]?out|accommodation|stay|logistics)$/i.test(cat)) {
    return true;
  }
  return false;
}

function isLockedLike(a: any): boolean {
  if (!a) return false;
  if (a.isLocked === true || a.locked === true || a.is_locked === true) return true;
  if (a.lock_state === 'locked') return true;
  const src = String(a?.source || '').toLowerCase();
  if (LOCKED_SOURCE_RE.test(src)) return true;
  const basis = String(a?.cost?.basis || a?.estimatedCost?.basis || '').toLowerCase();
  if (basis === 'user' || basis === 'user_override' || basis === 'booked') return true;
  return false;
}

export type ChronologyCode =
  | 'UNSORTED_BY_START'
  | 'PREDAWN_NON_BOOKEND'
  | 'BACKWARD_JUMP';

export interface ChronologyIssue {
  code: ChronologyCode;
  dayNumber: number | string;
  index: number;
  title: string;
  startTime?: string | null;
  detail?: string;
}

export interface ChronologyResult<TDay = any> {
  days: TDay[];
  issues: ChronologyIssue[];       // issues found BEFORE heal
  remainingIssues: ChronologyIssue[]; // issues that survived heal
  healed: boolean;
  criticalAfterHeal: boolean;
  sortedDayCount: number;
  droppedCount: number;
}

/** Detect issues on a single day (no mutation). */
function detectDayIssues(
  activities: any[],
  dayNumber: number | string,
): ChronologyIssue[] {
  const issues: ChronologyIssue[] = [];
  if (!Array.isArray(activities) || activities.length === 0) return issues;

  // Sortedness check using wrap-aware key.
  let prevKey: number | null = null;
  let eveningAnchor: number | null = null;
  for (let i = 0; i < activities.length; i++) {
    const a = activities[i];
    const startMin = pickStartMin(a);
    if (startMin !== null && startMin >= 18 * 60) eveningAnchor = startMin;
    const key = chronoKey(startMin, eveningAnchor);
    if (prevKey !== null && key + 5 < prevKey) {
      issues.push({
        code: 'BACKWARD_JUMP',
        dayNumber,
        index: i,
        title: String(a?.title || a?.name || '(unnamed)'),
        startTime: a?.startTime ?? a?.start_time ?? a?.time ?? null,
        detail: `prevKey=${prevKey} thisKey=${key}`,
      });
    }
    prevKey = key;

    // Predawn non-bookend check.
    if (startMin !== null && startMin < 6 * 60) {
      if (!isBookendLike(a) && !isLockedLike(a)) {
        issues.push({
          code: 'PREDAWN_NON_BOOKEND',
          dayNumber,
          index: i,
          title: String(a?.title || a?.name || '(unnamed)'),
          startTime: a?.startTime ?? a?.start_time ?? a?.time ?? null,
        });
      }
    }
  }

  // Unsorted check — compare against wrap-aware sort order.
  const sorted = [...activities]
    .map((a, idx) => ({ a, idx, key: 0 }))
    .reduce<{ list: Array<{ a: any; idx: number; key: number }>; anchor: number | null }>(
      (acc, item) => {
        const startMin = pickStartMin(item.a);
        if (startMin !== null && startMin >= 18 * 60) acc.anchor = startMin;
        item.key = chronoKey(startMin, acc.anchor);
        acc.list.push(item);
        return acc;
      },
      { list: [], anchor: null },
    )
    .list.sort((x, y) => x.key - y.key);

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].idx !== i) {
      issues.push({
        code: 'UNSORTED_BY_START',
        dayNumber,
        index: i,
        title: String(activities[i]?.title || activities[i]?.name || '(unnamed)'),
        startTime: activities[i]?.startTime ?? activities[i]?.start_time ?? activities[i]?.time ?? null,
      });
      break; // one issue per day is enough for telemetry
    }
  }

  return issues;
}

/** Sort a single day's activities using wrap-aware chronoKey. */
export function sortActivitiesChrono<T extends Record<string, any>>(activities: readonly T[]): T[] {
  if (!Array.isArray(activities) || activities.length <= 1) return [...(activities || [])];
  let anchor: number | null = null;
  const keyed = activities.map((a) => {
    const startMin = pickStartMin(a);
    if (startMin !== null && startMin >= 18 * 60) anchor = startMin;
    return { a, key: chronoKey(startMin, anchor) };
  });
  // Stable sort by key.
  return keyed
    .map((item, i) => ({ ...item, i }))
    .sort((x, y) => (x.key - y.key) || (x.i - y.i))
    .map((item) => item.a);
}

/**
 * Validate + heal chronology across a `days` array. Pure function: returns
 * a NEW `days` array; never mutates input.
 */
export function validateChronology<TDay extends Record<string, any> = any>(
  days: readonly TDay[] | null | undefined,
  opts: { site?: string } = {},
): ChronologyResult<TDay> {
  const list = Array.isArray(days) ? [...days] : [];
  const allIssuesPre: ChronologyIssue[] = [];
  const allIssuesPost: ChronologyIssue[] = [];
  let sortedDayCount = 0;
  let droppedCount = 0;

  const healed: TDay[] = list.map((day, dayIdx) => {
    if (!day || typeof day !== 'object') return day;
    const dayNumber = (day as any).dayNumber ?? (dayIdx + 1);
    const acts: any[] = Array.isArray((day as any).activities) ? (day as any).activities : [];
    if (acts.length === 0) return day;

    const pre = detectDayIssues(acts, dayNumber);
    if (pre.length > 0) allIssuesPre.push(...pre);

    let next = acts;

    // Heal 1 — sort (idempotent + safe).
    const wasUnsorted = pre.some((i) => i.code === 'UNSORTED_BY_START');
    if (wasUnsorted) {
      next = sortActivitiesChrono(next);
      sortedDayCount++;
    }

    // Heal 2 — drop predawn non-bookend on Day N>=2 only. Day 1 may have a
    // legitimate 02:00 arrival flight / 03:30 hotel checkin if the user
    // landed red-eye; we trust the bookend detector to recognize those.
    if (dayIdx >= 1) {
      const before = next.length;
      next = next.filter((a) => {
        const startMin = pickStartMin(a);
        if (startMin === null || startMin >= 6 * 60) return true;
        if (isBookendLike(a) || isLockedLike(a)) return true;
        return false;
      });
      droppedCount += before - next.length;
    }

    // Re-detect.
    const post = detectDayIssues(next, dayNumber);
    if (post.length > 0) allIssuesPost.push(...post);

    if (next === acts) return day;
    return { ...(day as any), activities: next } as TDay;
  });

  const healedFlag = sortedDayCount > 0 || droppedCount > 0;
  const criticalAfterHeal = allIssuesPost.some(
    (i) => i.code === 'PREDAWN_NON_BOOKEND' || i.code === 'BACKWARD_JUMP',
  );

  if (healedFlag) {
    // eslint-disable-next-line no-console
    console.log(
      `[CHRONOLOGY_HEALED] site=${opts.site || 'unknown'} sortedDays=${sortedDayCount} dropped=${droppedCount} issuesPre=${allIssuesPre.length} issuesPost=${allIssuesPost.length}`,
    );
  } else if (allIssuesPre.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[CHRONOLOGY_VALIDATOR] site=${opts.site || 'unknown'} issues=${allIssuesPre.length} (no heal applied)`,
    );
  }
  if (criticalAfterHeal) {
    // eslint-disable-next-line no-console
    console.warn(
      `[CHRONOLOGY_BLOCKED] site=${opts.site || 'unknown'} remaining=${allIssuesPost.length} sample=${JSON.stringify(allIssuesPost.slice(0, 3))}`,
    );
  }

  return {
    days: healed,
    issues: allIssuesPre,
    remainingIssues: allIssuesPost,
    healed: healedFlag,
    criticalAfterHeal,
    sortedDayCount,
    droppedCount,
  };
}
