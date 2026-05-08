/**
 * Shared regex + helpers to strip prompt-template label leaks from
 * user-facing activity body fields (description, tips, notes, etc.).
 *
 * Root cause: `buildReservationUrgencyPrompt()` injects a prompt header
 * ("RESERVATION URGENCY REQUIREMENTS") plus the JSON field name
 * `reservationUrgency`. The model occasionally echoes this label into
 * description/tips as `Reservation Urgency: ` (sometimes with no value
 * and a trailing period). Same shape can occur for sibling labels
 * (`Booking Urgency`, `Reservation Window`, `Booking Window`,
 * `Lead Time`).
 *
 * Used by:
 *  - generate-itinerary/pipeline/repair-day.ts (body-leak scrub)
 *  - generate-itinerary/pipeline/validate-day.ts (body-leak detection)
 *  - generate-itinerary/action-save-itinerary.ts (final pre-persist sweep)
 *  - src/utils/activityNameSanitizer.ts re-implements the same regexes
 *    for the UI sanitizer (kept literal in TS for the front-end bundle).
 *
 * See mem://constraints/itinerary/reservation-urgency-prompt-leak
 */

// Strip the entire "Reservation Urgency: …" / "Booking Urgency: …" segment
// up to the next sentence boundary (or end of string).
// - Tolerates value being empty, a lone period, or any non-period text.
// - Case-insensitive, global.
// Covers spaced label form ("Reservation Urgency:"), camelCase JSON key
// ("reservationUrgency:"), and snake_case ("reservation_urgency:").
export const RESERVATION_LABEL_LEAK_RE =
  /\b(?:reservation[_\s]?urgency|booking[_\s]?(?:urgency|window)|lead[_\s]?time)\s*:\s*[^.\n]*\.?/gi;

// Orphan key:value with an empty / dot-only value occupying its own segment.
// We only strip when the value is empty or a lone punctuation mark so we do
// not eat real "Note: closed Mondays." content. Accepts camelCase JSON keys
// (lowercase first letter) too — that's the `reservationUrgency: .` shape.
export const ORPHAN_EMPTY_LABEL_RE =
  /(?:^|(?<=[.!?]\s)|\n)\s*[A-Za-z][A-Za-z][A-Za-z ]{1,40}\s*:\s*[.\u2026]?\s*(?=$|\n|[.!?]\s|[A-Z])/g;

const BODY_FIELDS = [
  'description',
  'tips',
  'tip',
  'insiderTip',
  'insider_tip',
  'notes',
  'note',
  'details',
  'longDescription',
  'long_description',
] as const;

function scrubString(s: unknown): string | null {
  if (typeof s !== 'string' || !s) return null;
  const before = s;
  const after = s
    .replace(RESERVATION_LABEL_LEAK_RE, '')
    .replace(ORPHAN_EMPTY_LABEL_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+\./g, '.')
    .trim();
  return after === before ? null : after;
}

export interface BodyLeakScrubResult {
  changed: boolean;
  fields: string[];
}

/**
 * In-place scrub of all known body fields on an activity. Returns which
 * fields were modified for observability.
 */
export function scrubBodyPromptLeaks(act: any): BodyLeakScrubResult {
  if (!act || typeof act !== 'object') return { changed: false, fields: [] };
  const fields: string[] = [];
  for (const key of BODY_FIELDS) {
    const next = scrubString(act[key]);
    if (next !== null) {
      act[key] = next;
      fields.push(key);
    }
  }
  return { changed: fields.length > 0, fields };
}

/**
 * Pure detector — does any body field contain a known prompt-leak pattern?
 * Cheap to call from validate-day.
 */
export function hasBodyPromptLeak(act: any): { field: string } | null {
  if (!act || typeof act !== 'object') return null;
  for (const key of BODY_FIELDS) {
    const v = act[key];
    if (typeof v !== 'string' || !v) continue;
    // Reset lastIndex on the global regex before each .test()
    RESERVATION_LABEL_LEAK_RE.lastIndex = 0;
    ORPHAN_EMPTY_LABEL_RE.lastIndex = 0;
    if (RESERVATION_LABEL_LEAK_RE.test(v) || ORPHAN_EMPTY_LABEL_RE.test(v)) {
      return { field: key };
    }
  }
  return null;
}

const TITLE_FIELDS = ['title', 'name', 'subtitle'] as const;

/**
 * Title-side scrub for the same prompt-template label leaks. Card titles
 * occasionally include "Reservation Urgency: ." when the model misroutes the
 * urgency value into the title slot. Also collapses an empty/dot-only
 * `reservationUrgency` JSON field so the UI badge stops rendering "Reservation
 * Urgency: ." See plan.md §2.
 */
export function scrubTitleLeaks(act: any): BodyLeakScrubResult {
  if (!act || typeof act !== 'object') return { changed: false, fields: [] };
  const fields: string[] = [];
  for (const key of TITLE_FIELDS) {
    const next = scrubString(act[key]);
    if (next !== null) {
      // Never blank a title — fall back to a safe placeholder
      act[key] = next || (key === 'title' || key === 'name' ? 'Activity' : '');
      fields.push(key);
    }
  }
  // reservationUrgency value: drop if it's the leaked label string itself or
  // collapses to empty / a lone period.
  const ru = act.reservationUrgency ?? act.reservation_urgency;
  if (typeof ru === 'string') {
    const trimmed = ru.trim();
    const looksLikeLeak = /^reservation[_\s]?urgency\s*:/i.test(trimmed) || trimmed === '.' || trimmed === '';
    if (looksLikeLeak) {
      delete act.reservationUrgency;
      delete act.reservation_urgency;
      fields.push('reservationUrgency');
    }
  }
  return { changed: fields.length > 0, fields };
}

// ─── Sentence integrity (fragment guard) ────────────────────────────────────
//
// Catches AI-generated sentence fragments that survived the label scrubs:
//   - "spot for together"  → dangling preposition + pronoun, no subject
//   - "perfect for two together."
//   - "ideal with for both."
//   - "Good for ."  → trailing preposition before period
//
// We only DROP the broken sentence within a multi-sentence string. Single-
// sentence fields are left alone if dropping would blank them — fragments are
// cosmetic, not safety-critical, and an empty description is worse UX than
// a slightly-off one. (`hasSentenceFragment` still reports them so telemetry
// can surface a count.)
//
// Conservative patterns — only match clear fragments, never legitimate prose.
const FRAGMENT_PATTERNS: RegExp[] = [
  // dangling "<prep> together/two/both" with no preceding noun anchor
  /\b(?:for|with|to|of|on|at|in)\s+(?:together|two|both)\b(?!\s+\w{3,})/i,
  // "<prep> <prep>"  (e.g. "for with", "ideal with for both")
  /\b(?:for|with|to|on|at|in|of)\s+(?:for|with|to|on|at|in|of)\b/i,
  // sentence-end dangling preposition before period: "perfect for ."
  /\b(?:for|with|to|on|at|in|of|by)\s*[.!?]/i,
];

function isFragmentSentence(sentence: string): boolean {
  const trimmed = sentence.trim();
  if (!trimmed) return false;
  // Whitelist: ≥6 words AND starts with capital → almost certainly real prose
  const words = trimmed.split(/\s+/);
  if (words.length >= 6 && /^[A-Z]/.test(trimmed)) {
    // Still flag if a fragment pattern matches outright
    return FRAGMENT_PATTERNS.some((re) => re.test(trimmed));
  }
  // Short fragments OR non-capitalized starts → check patterns
  return FRAGMENT_PATTERNS.some((re) => re.test(trimmed));
}

/**
 * Drop fragment sentences from a string. Returns null if unchanged. Never
 * returns an empty string — if every sentence looks broken, returns null
 * (caller keeps the original; we'd rather show suspicious prose than nothing).
 */
export function scrubSentenceFragments(s: unknown): string | null {
  if (typeof s !== 'string' || !s) return null;
  // Split on sentence boundaries while preserving punctuation
  const parts = s.split(/(?<=[.!?])\s+/);
  if (parts.length < 2) {
    // Single-sentence: only flag, don't strip (would blank the field)
    return null;
  }
  const kept = parts.filter((p) => !isFragmentSentence(p));
  if (kept.length === parts.length) return null;
  if (kept.length === 0) return null;
  const rebuilt = kept.join(' ').replace(/\s{2,}/g, ' ').replace(/\s+\./g, '.').trim();
  return rebuilt === s ? null : rebuilt;
}

/**
 * In-place scrub of fragment sentences across body + title fields. Returns
 * which fields changed.
 */
export function scrubSentenceFragmentsOnAct(act: any): BodyLeakScrubResult {
  if (!act || typeof act !== 'object') return { changed: false, fields: [] };
  const fields: string[] = [];
  for (const key of [...BODY_FIELDS, ...TITLE_FIELDS]) {
    const next = scrubSentenceFragments(act[key]);
    if (next !== null) {
      act[key] = next;
      fields.push(key);
    }
  }
  return { changed: fields.length > 0, fields };
}

export function hasSentenceFragment(act: any): { field: string } | null {
  if (!act || typeof act !== 'object') return null;
  for (const key of [...BODY_FIELDS, ...TITLE_FIELDS]) {
    const v = act[key];
    if (typeof v !== 'string' || !v) continue;
    const parts = v.split(/(?<=[.!?])\s+/);
    if (parts.some(isFragmentSentence)) return { field: key };
  }
  return null;
}

export function hasTitleLeak(act: any): { field: string } | null {
  if (!act || typeof act !== 'object') return null;
  for (const key of TITLE_FIELDS) {
    const v = act[key];
    if (typeof v !== 'string' || !v) continue;
    RESERVATION_LABEL_LEAK_RE.lastIndex = 0;
    ORPHAN_EMPTY_LABEL_RE.lastIndex = 0;
    if (RESERVATION_LABEL_LEAK_RE.test(v) || ORPHAN_EMPTY_LABEL_RE.test(v)) {
      return { field: key };
    }
  }
  const ru = act.reservationUrgency ?? act.reservation_urgency;
  if (typeof ru === 'string') {
    const t = ru.trim();
    if (/^reservation[_\s]?urgency\s*:/i.test(t) || t === '.') return { field: 'reservationUrgency' };
  }
  return null;
}
