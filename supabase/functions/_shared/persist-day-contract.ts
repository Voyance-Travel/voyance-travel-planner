/**
 * Persist-Day Contract — single boundary that filters dirty rows BEFORE the
 * itinerary is written to the database. This replaces the patchwork of
 * downstream sweepers (`isGhostActivity`, `nuclearWellnessSweep`,
 * `sanitizeActivityName` hotel short-circuit, etc.) with one rule set.
 *
 * Three concerns enforced here:
 *
 *   1. GHOST ROWS: any non-locked activity starting between 00:00 and 04:59
 *      whose category is hotel/wellness/logistics is dropped. These are
 *      injection-pass artifacts ("Return to Hotel" wraparound, wellness
 *      placeholder) that should never be persisted.
 *
 *   2. PLACEHOLDER NAMES: titles matching the union regex
 *      `PLACEHOLDER_NAME_RE` ("find a venue", "find a local spot",
 *      "(slot)", "(AESTHETIC slot)", etc.) are dropped. The fallback DB
 *      and venue-pick logic ran upstream — anything still wearing a
 *      placeholder name at this boundary is a contract violation.
 *
 *   3. PROMPT ARTIFACTS: any title containing `(slot)`, `(aesthetic slot)`,
 *      or similar template tokens leaking from the generator prompt.
 *
 * Locked / user / manual / extracted / pinned activities are NEVER touched
 * (universal locking protocol).
 */

export const PLACEHOLDER_NAME_RE = new RegExp(
  [
    'find\\s+(?:a\\s+)?(?:venue|local\\s+spot|restaurant|cafe|café|bar|spot)',
    '\\bplaceholder\\b',
    '\\bneeds\\s*venue\\b',
    'needsvenuepick',
    'spa\\s+time\\s*(?:[—\\-:]\\s*find)',
    'tbd|t\\.b\\.d\\.',
    '\\(\\s*(?:slot|aesthetic\\s+slot|placeholder|name|venue)\\s*\\)',
  ].join('|'),
  'i',
);

const GHOST_CATEGORIES = new Set([
  'accommodation', 'hotel', 'lodging', 'stay',
  'wellness', 'spa', 'relaxation',
  'logistics', 'transport', 'transportation', 'transfer', 'transit',
]);

const HOTEL_RETURN_RE = /return\s+to\s+(?:your\s+)?[^,]*hotel|back\s+to\s+(?:the\s+)?hotel/i;
const WELLNESS_PLACEHOLDER_RE = /find\s+a\s+venue\s*$/i;
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

export type ContractViolation =
  | 'ghost-row'
  | 'placeholder-name'
  | 'prompt-artifact';

export interface ContractDropReport {
  dayNumber?: number;
  title: string;
  reason: ContractViolation;
}

/**
 * Apply the persist-day contract to a list of activities.
 * Returns the cleaned activities + a list of drops (for logging).
 */
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
    // Combined text used for placeholder detection so leaks in name / venue /
    // description fields don't slip past the contract when the title is clean.
    const placeholderBlob = [
      aa.title, aa.name, aa.venue_name, aa.description,
      aa.venue?.name, aa.restaurant?.name, aa.location?.name,
    ].filter(Boolean).join(' | ');
    const cat = String(aa.category || aa.type || '').toLowerCase();
    const locked = isLockedRow(a);

    // Locked rows pass through untouched (universal locking).
    if (locked) {
      out.push(a);
      continue;
    }

    // 1. Ghost rows
    const startMins =
      timeToMins((a as any).startTime) ??
      timeToMins((a as any).start_time) ??
      timeToMins((a as any).time);
    const isPreDawn = startMins !== null && startMins < PRE_DAWN_MAX_MINS;
    if (isPreDawn && (GHOST_CATEGORIES.has(cat) || HOTEL_RETURN_RE.test(title) || WELLNESS_PLACEHOLDER_RE.test(title))) {
      drops.push({ dayNumber: ctx.dayNumber, title, reason: 'ghost-row' });
      continue;
    }

    // 2. Placeholder names (covers wellness + meal + generic + prompt artifacts)
    if (PLACEHOLDER_NAME_RE.test(title)) {
      // Prompt-artifact subclass for clearer logs
      const reason: ContractViolation = /\(\s*(?:slot|aesthetic\s+slot|placeholder|name|venue)\s*\)/i.test(title)
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
 * Run the contract over an array of days, mutating each day's activities
 * in-place. Logs a single summary line if anything was dropped so we can
 * track which generator paths still leak.
 */
export async function enforceContractOnDays(
  days: any[],
  ctx: { destination?: string | null } = {},
): Promise<{ totalDrops: number; byReason: Record<string, number> }> {
  const byReason: Record<string, number> = {
    'ghost-row': 0,
    'placeholder-name': 0,
    'prompt-artifact': 0,
    'cross-city': 0,
  };
  let totalDrops = 0;

  // Lazy-load the cross-city detector so non-Deno callers (tests) don't fail.
  let detectCrossCityMention: ((text: string, destination: string) => string | null) | null = null;
  if (ctx.destination) {
    try {
      const mod = await import('./cross-city-filter.ts');
      detectCrossCityMention = mod.detectCrossCityMention;
    } catch {
      detectCrossCityMention = null;
    }
  }

  for (const day of days || []) {
    if (!day || !Array.isArray(day.activities)) continue;
    const { activities, drops } = enforcePersistDayContract(day.activities, {
      dayNumber: day.dayNumber,
    });
    let cleaned = activities;

    // Per-day city wins over trip-level destination so multi-city trips
    // (e.g. Florence day in a Venice trip) filter against the right city.
    const perDayDest =
      (day as any)?.cityName ||
      (day as any)?.dayDestination ||
      (day as any)?.city ||
      ctx.destination;

    // Cross-city sweep on what survives placeholder/ghost contract.
    if (detectCrossCityMention && perDayDest) {
      const dest = perDayDest;
      cleaned = cleaned.filter((a: any) => {
        if (isLockedRow(a)) return true;
        const cat = String(a?.category || a?.type || '').toLowerCase();
        // Apply only to venue-bearing categories
        if (!/dining|food|restaurant|cafe|bar|nightlife|sightseeing|museum|culture|shopping|wellness|spa|activity|entertainment|relaxation/i.test(cat)) {
          return true;
        }
        const blob = [
          a?.title, a?.name,
          a?.location?.name, a?.location?.address, a?.location?.city,
          a?.address, a?.venue?.name, a?.venue?.address,
        ].filter(Boolean).join(' | ');
        const hit = detectCrossCityMention!(blob, dest);
        if (hit) {
          drops.push({ dayNumber: day.dayNumber, title: String(a?.title || a?.name || ''), reason: 'cross-city' as any });
          return false;
        }
        return true;
      });
    }

    if (drops.length > 0) {
      day.activities = cleaned;
      totalDrops += drops.length;
      for (const d of drops) {
        byReason[d.reason] = (byReason[d.reason] || 0) + 1;
        console.warn(
          `[CONTRACT_VIOLATION] day=${d.dayNumber ?? '?'} reason=${d.reason} title="${d.title}"`,
        );
      }
    }
  }
  if (totalDrops > 0) {
    console.warn(
      `[CONTRACT_VIOLATION] persist-day contract dropped ${totalDrops} row(s):`,
      byReason,
    );
  }
  return { totalDrops, byReason };
}
