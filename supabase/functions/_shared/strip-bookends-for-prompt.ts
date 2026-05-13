/**
 * Strip late-nightlife / wrap-window cards from cross-day prompt context.
 *
 * The chain generator passes the previously-generated day's activities to the
 * next day's prompt as `previousDays` / `previousDayActivities`. When Day N
 * ends with a `late_nightlife_bookend` (start ~00:16) or any activity that
 * lands in the [00:00, 06:00) wrap window, the AI sees that as the "anchor"
 * for Day N+1 and schedules Day N+1's first card just after it. That is the
 * root cause of the Amsterdam 1:33 / 3:26 / 6:31 AM cascade.
 *
 * This helper is the single boundary that scrubs those rows before they enter
 * any cross-day prompt payload.
 *
 * See mem://constraints/itinerary/late-nightlife-no-next-day-bleed.
 */

const BOOKEND_SOURCE_RE =
  /^(bookend-readtime|bookend-overnight|bookend-validator|bookend-synthesized|late_nightlife_bookend)$/i;

const WRAP_BOUNDARY_MIN = 6 * 60;

function parseTimeMin(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

function isBookendSourceLike(a: any): boolean {
  if (!a) return false;
  const src = String(a.source || '').toLowerCase();
  if (BOOKEND_SOURCE_RE.test(src)) return true;
  const tags: unknown = a.tags;
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (BOOKEND_SOURCE_RE.test(String(t).toLowerCase())) return true;
    }
  }
  return false;
}

function isWrapWindowStart(a: any): boolean {
  const m =
    parseTimeMin(a?.startTime) ??
    parseTimeMin(a?.start_time) ??
    parseTimeMin(a?.time);
  if (m === null) return false;
  return m >= 0 && m < WRAP_BOUNDARY_MIN;
}

/** Predicate exported for tests. */
export function isCrossDayPromptNoise(a: any): boolean {
  return isBookendSourceLike(a) || isWrapWindowStart(a);
}

/**
 * Returns a shallow-cloned activities array with bookend / wrap-window rows
 * removed. Idempotent. Logs a single `[PREV_DAY_PRUNED]` line per call when
 * anything is dropped.
 */
export function stripBookendsForPrompt<T = any>(
  activities: readonly T[] | null | undefined,
  ctx: { dayNumber?: number | string; site?: string } = {},
): T[] {
  if (!Array.isArray(activities) || activities.length === 0) return [];
  const kept: T[] = [];
  const dropped: string[] = [];
  for (const a of activities) {
    if (isCrossDayPromptNoise(a)) {
      const title = String((a as any)?.title || (a as any)?.name || '').trim();
      const start = String(
        (a as any)?.startTime || (a as any)?.start_time || (a as any)?.time || '',
      );
      const src = String((a as any)?.source || 'inferred');
      dropped.push(`"${title}"@${start || '?'}(${src})`);
      continue;
    }
    kept.push(a);
  }
  if (dropped.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[PREV_DAY_PRUNED] day=${ctx.dayNumber ?? '?'} site=${ctx.site || 'cross-day-prompt'} dropped=${dropped.length} items=${dropped.join(', ')}`,
    );
  }
  return kept;
}
