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

// Placeholder PROSE patterns. Tested ONLY against IDENTIFIER fields
// (title/name/venue_name/venue.name/restaurant.name/location.name) — never
// against `description`. Scanning descriptions matches legitimate prose
// like "find a cafe nearby" / "pick a restaurant" and was the cause of
// the 2026-05-08 "generation failed" outage.
export const PLACEHOLDER_NAME_RE = new RegExp(
  [
    'find\\s+(?:a\\s+)?(?:venue|local\\s+spot|restaurant|cafe|café|bar|spot)',
    'pick\\s+(?:a\\s+)?(?:venue|local\\s+spot|restaurant|cafe|café|bar|spot)',
    '\\bplaceholder\\b',
    '\\bneeds\\s*venue\\b',
    'needsvenuepick',
    'spa\\s+time\\s*(?:[—\\-:]\\s*find)',
    '\\btbd\\b|t\\.b\\.d\\.',
  ].join('|'),
  'i',
);

// Prompt-artifact tokens. Narrow — does NOT include bare `(name)` /
// `(venue)` which routinely appear in legitimate description prose.
// Also matches bare ALLCAPS-with-underscore tokens like "(FLEX_WINDOW)" /
// "(NARRATIVE_MOOD)" / "(DEEP_CONTEXT)". Underscore requirement keeps it
// from matching legit acronyms like "(USA)" / "(NYC)".
export const PROMPT_ARTIFACT_RE =
  /\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/i;

const GHOST_CATEGORIES = new Set([
  'accommodation', 'hotel', 'lodging', 'stay',
  'wellness', 'spa', 'relaxation',
  'logistics', 'transport', 'transportation', 'transfer', 'transit',
]);

// Broadened: matches "Return to Hotel", "Return to the hotel",
// "Return to Four Seasons Hotel", "Back at hotel", "Back to your hotel",
// "Hotel check-in / settle in", and the "12:15 AM hotel bleed" wraparound
// where the row has no real venue beyond the word "hotel".
const HOTEL_RETURN_RE = /(?:return\s+to|back\s+(?:to|at)|head\s+back\s+to|head\s+to|wind\s+down\s+at)\s+(?:your\s+|the\s+|our\s+)?[^,.\n]{0,60}hotel|hotel\s+(?:check[-\s]?in|settle\s+in|wind[-\s]?down|nightcap)/i;
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
    // IDENTIFIER fields only — never description. Description prose like
    // "find a cafe nearby" must not trigger placeholder drops.
    const idBlob = [
      aa.title, aa.name, aa.venue_name,
      aa.venue?.name, aa.restaurant?.name, aa.location?.name,
    ].filter(Boolean).join(' | ');
    // Description IS scanned, but only for prompt artifacts.
    const fullBlob = [idBlob, aa.description].filter(Boolean).join(' | ');
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

    // 2. Prompt artifacts (identifier fields + description).
    if (PROMPT_ARTIFACT_RE.test(fullBlob)) {
      drops.push({ dayNumber: ctx.dayNumber, title, reason: 'prompt-artifact' });
      continue;
    }

    // 3. Placeholder PROSE — identifier fields ONLY.
    if (PLACEHOLDER_NAME_RE.test(idBlob)) {
      drops.push({ dayNumber: ctx.dayNumber, title, reason: 'placeholder-name' });
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
