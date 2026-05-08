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
export const RESERVATION_LABEL_LEAK_RE =
  /\b(?:(?:Reservation|Booking)\s+(?:Urgency|Window|Lead\s*Time)|Lead\s*Time)\s*:\s*[^.\n]*\.?/gi;

// Orphan key:value with an empty / dot-only value occupying its own segment.
// We only strip when the value is empty or a lone punctuation mark so we do
// not eat real "Note: closed Mondays." content.
// Matches either a full-line "Label: ." or an inline ". Label: ." segment.
export const ORPHAN_EMPTY_LABEL_RE =
  /(?:^|(?<=[.!?]\s)|\n)\s*[A-Z][A-Za-z][A-Za-z ]{1,40}\s*:\s*[.\u2026]?\s*(?=$|\n|[.!?]\s|[A-Z])/g;

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
