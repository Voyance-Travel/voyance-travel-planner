/**
 * Single source of truth for reading user-selected must-do venues out of
 * `trips.metadata`. Handles both `string[]` and comma/newline-joined string
 * shapes that have accumulated across creation paths (start form, chat
 * planner, manual paste, multi-city leg split).
 *
 * Used by:
 *   - action-generate-trip-day.ts (pre-persist injection + DB-sourced coverage)
 *   - action-save-itinerary.ts (coverage restamp)
 *   - inject-missing-must-dos displacement repair
 *
 * The string filter intentionally drops leading "Day N:" / "Day N -" prefixes
 * and any trailing time tokens so the matcher in assert-must-do-coverage.ts
 * sees the bare venue name (e.g. "Pantheon", not "Day 2: Pantheon 14:00").
 */

const DAY_PREFIX_RE = /^\s*Day\s+\d+\s*[:\-–]\s*/i;
const TRAILING_TIME_RE = /\s*(?:~?\d{1,2}(?::\d{2})?\s*(?:AM|PM)?(?:\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)?)\s*$/i;

function cleanVenue(raw: string): string {
  let s = String(raw || '').trim();
  if (!s) return '';
  // Strip leading "Day N:" prefix
  s = s.replace(DAY_PREFIX_RE, '').trim();
  // Strip trailing time tokens like "9am-5pm" or "7:30 PM"
  s = s.replace(TRAILING_TIME_RE, '').trim();
  // Drop trailing comma fragments
  s = s.replace(/[,;]+$/g, '').trim();
  return s;
}

/**
 * Extract a clean array of selected-attraction venue names from a trip's
 * `metadata.mustDoActivities` blob. Always returns string[] (possibly empty).
 */
export function extractMustDoVenues(metadata: unknown): string[] {
  const meta = (metadata || {}) as Record<string, unknown>;
  const raw = (meta as any).mustDoActivities;
  if (!raw) return [];

  let entries: string[] = [];
  if (Array.isArray(raw)) {
    entries = raw
      .filter((v) => typeof v === 'string')
      .flatMap((s) => String(s).split(/\n+/));
  } else if (typeof raw === 'string') {
    // Split on newlines OR commas that precede a "Day N" marker.
    entries = raw.split(/\n+|,\s*(?=Day\s+\d+\b)/i);
  } else {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const cleaned = cleanVenue(e);
    if (!cleaned) continue;
    // Drop obvious non-venues that crept in from chat planner extraction.
    if (/^(do\s+)?(flight|hotel|check.?in|check.?out|transfer)\b/i.test(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

export const __test__ = { cleanVenue };
