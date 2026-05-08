/**
 * Browser-safe mirror of supabase/functions/_shared/persist-day-contract.ts
 * + persist-itinerary.ts (artifact strip + pre-dawn hotel strip).
 *
 * Used by client write paths that hit `itinerary_days` directly (e.g. the
 * per-day upsert in itineraryAPI.ts during live progress rendering) so the
 * UI never reads dirty rows before the backend save lands.
 *
 * Keep this in sync with the Deno version. Pure JS, no Deno deps.
 */

export const PLACEHOLDER_NAME_RE = new RegExp(
  [
    'find\\s+(?:a\\s+)?(?:venue|local\\s+spot|restaurant|cafe|café|bar|spot)',
    'pick\\s+(?:a\\s+)?(?:venue|local\\s+spot|restaurant|cafe|café|bar|spot)',
    '\\bplaceholder\\b',
    '\\bneeds\\s*venue\\b',
    'needsvenuepick',
    'spa\\s+time\\s*(?:[—\\-:]\\s*find)',
    '\\btbd\\b|t\\.b\\.d\\.',
    '\\(\\s*(?:[A-Z][A-Z0-9 _-]{1,30}\\s+)?(?:slot|aesthetic\\s+slot|placeholder|name|venue)\\s*\\)',
  ].join('|'),
  'i',
);

const PROMPT_ARTIFACT_TEST_RE =
  /\(\s*(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|name|venue)\s*\)/i;
const PROMPT_ARTIFACT_REPLACE_RE =
  /\s*\(\s*(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder|name|venue)\s*\)/gi;

const HOTEL_RETURN_RE =
  /(?:return\s+to|back\s+(?:to|at)|head\s+back\s+to|head\s+to|wind\s+down\s+at)\s+(?:your\s+|the\s+|our\s+)?[^,.\n]{0,60}hotel|hotel\s+(?:check[-\s]?in|settle\s+in|wind[-\s]?down|nightcap)/i;
const WELLNESS_PLACEHOLDER_RE = /find\s+a\s+venue\s*$/i;

const HOTEL_TITLE_RE =
  /\b(?:return\s+to|check.?in|check.?out|hotel|freshen\s+up|rest\s+and\s+refresh|retire|settle|wind\s+down|end.?of.?day|back\s+to)\b/i;

const GHOST_CATEGORIES = new Set([
  'accommodation', 'hotel', 'lodging', 'stay',
  'wellness', 'spa', 'relaxation',
  'logistics', 'transport', 'transportation', 'transfer', 'transit',
]);

const PRE_DAWN_MAX_MINS = 5 * 60;

function timeToMins(raw: unknown): number | null {
  if (typeof raw !== 'string' || !raw) return null;
  const m = raw.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (/pm/i.test(raw) && h < 12) h += 12;
  if (/am/i.test(raw) && h === 12) h = 0;
  return h * 60 + mm;
}

function isLockedRow(a: any): boolean {
  if (!a) return false;
  if (a.locked === true || a.is_locked === true || a.isLocked === true) return true;
  if (a.lock_state === 'locked') return true;
  const source = String(a.source || '').toLowerCase();
  if (['user', 'manual', 'extracted', 'pinned'].includes(source)) return true;
  return false;
}

/** Strip prompt-artifact tokens from title/name/description in place. */
export function stripPromptArtifactsInActivities(activities: any[]): number {
  if (!Array.isArray(activities)) return 0;
  let touched = 0;
  for (const a of activities) {
    if (!a) continue;
    for (const key of ['title', 'name', 'description']) {
      const v = a[key];
      if (typeof v !== 'string' || !v) continue;
      if (!PROMPT_ARTIFACT_TEST_RE.test(v)) continue;
      const cleaned = v.replace(PROMPT_ARTIFACT_REPLACE_RE, '').replace(/\s{2,}/g, ' ').trim();
      if (cleaned) {
        a[key] = cleaned;
        touched++;
      }
    }
  }
  return touched;
}

/** Drop pre-dawn (00:00–04:59) hotel/return-to-hotel rows in place. */
export function stripPreDawnHotelReturns(activities: any[]): number {
  if (!Array.isArray(activities) || activities.length === 0) return 0;
  let removed = 0;
  for (let i = activities.length - 1; i >= 0; i--) {
    const act = activities[i];
    if (isLockedRow(act)) continue;
    const candidates = [act?.startTime, act?.start_time, act?.time];
    let earliest: number | null = null;
    for (const t of candidates) {
      const m = timeToMins(t);
      if (m === null) continue;
      if (earliest === null || m < earliest) earliest = m;
    }
    if (earliest === null || earliest >= PRE_DAWN_MAX_MINS) continue;
    const title = String(act?.title || act?.name || '').toLowerCase();
    const cat = String(act?.category || '').toLowerCase();
    const type = String(act?.type || '').toLowerCase();
    const isHotelEntry =
      HOTEL_TITLE_RE.test(title) ||
      cat === 'accommodation' || cat === 'stay' || cat === 'hotel' ||
      type === 'stay' || type === 'accommodation';
    if (!isHotelEntry) continue;
    activities.splice(i, 1);
    removed++;
  }
  return removed;
}

export type ContractViolation = 'ghost-row' | 'placeholder-name' | 'prompt-artifact';

export interface ContractDropReport {
  dayNumber?: number;
  title: string;
  reason: ContractViolation;
}

export function enforcePersistDayContract<T = any>(
  activities: T[],
  ctx: { dayNumber?: number } = {},
): { activities: T[]; drops: ContractDropReport[] } {
  const out: T[] = [];
  const drops: ContractDropReport[] = [];

  for (const a of activities || []) {
    if (!a) continue;
    const aa = a as any;
    const title = String(aa.title || aa.name || '');
    const placeholderBlob = [
      aa.title, aa.name, aa.venue_name, aa.description,
      aa.venue?.name, aa.restaurant?.name, aa.location?.name,
    ].filter(Boolean).join(' | ');
    const cat = String(aa.category || aa.type || '').toLowerCase();

    if (isLockedRow(a)) {
      out.push(a);
      continue;
    }

    const startMins =
      timeToMins(aa.startTime) ??
      timeToMins(aa.start_time) ??
      timeToMins(aa.time);
    const isPreDawn = startMins !== null && startMins < PRE_DAWN_MAX_MINS;
    if (isPreDawn && (GHOST_CATEGORIES.has(cat) || HOTEL_RETURN_RE.test(title) || WELLNESS_PLACEHOLDER_RE.test(title))) {
      drops.push({ dayNumber: ctx.dayNumber, title, reason: 'ghost-row' });
      continue;
    }

    if (PLACEHOLDER_NAME_RE.test(placeholderBlob)) {
      const reason: ContractViolation = /\(\s*(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|aesthetic\s+slot|placeholder|name|venue)\s*\)/i.test(placeholderBlob)
        ? 'prompt-artifact'
        : 'placeholder-name';
      drops.push({ dayNumber: ctx.dayNumber, title, reason });
      continue;
    }

    out.push(a);
  }

  return { activities: out, drops };
}

/**
 * Full client-side cleanup pipeline matching backend persistTripItinerary.
 * Returns the cleaned activities array. Mutates inputs are NOT returned —
 * caller should replace the day's activities with the result.
 */
export function cleanActivitiesForPersist(
  activities: any[],
  ctx: { dayNumber?: number } = {},
): any[] {
  if (!Array.isArray(activities)) return [];
  // Clone shallowly so we don't mutate caller's objects.
  const copy = activities.map(a => (a && typeof a === 'object' ? { ...a } : a));
  stripPromptArtifactsInActivities(copy);
  stripPreDawnHotelReturns(copy);
  const { activities: cleaned, drops } = enforcePersistDayContract(copy, ctx);
  if (drops.length > 0) {
    // eslint-disable-next-line no-console
    console.warn(
      `[client-persist-contract] day=${ctx.dayNumber ?? '?'} dropped ${drops.length} dirty row(s)`,
      drops,
    );
  }
  return cleaned;
}
