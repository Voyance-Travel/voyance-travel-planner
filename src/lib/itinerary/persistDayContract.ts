/**
 * Browser-safe mirror of supabase/functions/_shared/persist-day-contract.ts
 * + persist-itinerary.ts (artifact strip + pre-dawn hotel strip).
 *
 * Used by client write paths that hit `itinerary_days` directly (e.g. the
 * per-day upsert in itineraryAPI.ts during live progress rendering) so the
 * UI never reads dirty rows before the backend save lands.
 *
 * IMPORTANT — placeholder/artifact field scope (2026-05-08 outage fix):
 *  - PLACEHOLDER_NAME_RE matches placeholder *prose* ("find a venue",
 *    "find a local spot in <city>", "Spa Time — find a venue", "TBD",
 *    "needsVenuePick"). It is ONLY tested against IDENTIFIER fields:
 *    title, name, venue_name, venue.name, restaurant.name, location.name.
 *    It is NEVER tested against `description` — descriptions routinely
 *    contain phrases like "find a cafe nearby" or "pick a restaurant"
 *    that are legitimate travel prose. Scanning descriptions caused
 *    every generation to be marked `failed` (see plan.md / outage notes).
 *
 *  - PROMPT_ARTIFACT_RE matches template tokens that leaked from the
 *    generator prompt: `(slot)`, `(AESTHETIC slot)`, `(<TAG> slot)`,
 *    `(placeholder)`. It does NOT match bare `(name)` / `(venue)` —
 *    those occur in normal prose like "the (venue) listed above".
 *    Artifacts ARE scanned in description (where prompt tokens leak),
 *    but the strip pass cleans them in identifier fields without
 *    dropping the activity unless the field becomes empty.
 *
 * Keep this in sync with the Deno version. Pure JS, no Deno deps.
 */

// Placeholder PROSE patterns for IDENTIFIER fields only.
// Each alternative is a substring pattern that, when found anywhere in
// title/name/venue_name, indicates the field is a placeholder.
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

// Prompt-artifact tokens — narrow set, NO bare (name)/(venue) which appear
// in legitimate prose.
// Two alternatives:
//   (a) "(... slot)" / "(... placeholder)" — labelled prompt slot tokens.
//   (b) "(ALLCAPS_WITH_UNDERSCORE)" — bare prompt-template tokens like
//       "(FLEX_WINDOW)", "(NARRATIVE_MOOD)", "(DEEP_CONTEXT)". The required
//       underscore is what distinguishes them from legit acronyms like
//       "(USA)" / "(NYC)" which must NOT be stripped.
const PROMPT_ARTIFACT_TEST_RE =
  /\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/i;
const PROMPT_ARTIFACT_REPLACE_RE =
  /\s*\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)/gi;

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

    // IDENTIFIER fields only — never description.
    const idBlob = [
      aa.title, aa.name, aa.venue_name,
      aa.venue?.name, aa.restaurant?.name, aa.location?.name,
    ].filter(Boolean).join(' | ');

    // FULL blob (incl. description) only used for prompt-artifact detection,
    // since prompt tokens like "(AESTHETIC slot)" do leak into descriptions.
    const fullBlob = [idBlob, aa.description].filter(Boolean).join(' | ');

    const cat = String(aa.category || aa.type || '').toLowerCase();

    if (isLockedRow(a)) {
      out.push(a);
      continue;
    }

    // 1. Ghost rows (pre-dawn hotel/wellness)
    const startMins =
      timeToMins(aa.startTime) ??
      timeToMins(aa.start_time) ??
      timeToMins(aa.time);
    const isPreDawn = startMins !== null && startMins < PRE_DAWN_MAX_MINS;
    if (isPreDawn && (GHOST_CATEGORIES.has(cat) || HOTEL_RETURN_RE.test(title) || WELLNESS_PLACEHOLDER_RE.test(title))) {
      drops.push({ dayNumber: ctx.dayNumber, title, reason: 'ghost-row' });
      continue;
    }

    // 2. Prompt artifacts — scanned in identifier fields AND description.
    if (PROMPT_ARTIFACT_TEST_RE.test(fullBlob)) {
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
 * Full client-side cleanup pipeline matching backend persistTripItinerary.
 * Returns the cleaned activities array.
 */
export function cleanActivitiesForPersist(
  activities: any[],
  ctx: { dayNumber?: number } = {},
): any[] {
  if (!Array.isArray(activities)) return [];
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
