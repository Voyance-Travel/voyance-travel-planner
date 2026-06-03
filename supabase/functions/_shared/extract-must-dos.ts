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
 *
 * Venue vs experience:
 *   `extractMustDoVenues` returns only entries that name a real place (proper
 *   noun present, no experience-verb prefix). Descriptive experience phrases
 *   like "Watch the sunset from a rooftop overlooking the Bosphorus" are
 *   excluded from the venue list (they have no venue identity to match) and
 *   exposed separately via `extractMustDoExperiences`. The coverage hard gate
 *   in `action-generate-trip-day.ts` consumes venues only — experiences are
 *   conveyed to the AI as soft USER WISHES via the preference spine.
 */

const DAY_PREFIX_RE = /^\s*Day\s+\d+\s*[:\-–]\s*/i;
const TRAILING_TIME_RE = /\s*(?:~?\d{1,2}(?::\d{2})?\s*(?:AM|PM)?(?:\s*[-–]\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)?)\s*$/i;

// Experience-verb prefix: descriptive activity, not a venue name.
const EXPERIENCE_VERB_RE = /^(?:watch|see|experience|enjoy|try|catch|witness|explore|wander|stroll|relax|unwind|hunt|sample|taste|attend|listen|find|discover|do|have|go|grab|take|spend)\b/i;
// Experience nouns that, when present without a proper noun, indicate an
// activity wish rather than a venue.
const EXPERIENCE_NOUN_RE = /\b(?:sunset|sunrise|vibes|atmosphere|nightlife|rooftop|beach day|day trip|hidden gem|local life|street food|live music)\b/i;
// Tokens that should NOT count as proper nouns when capitalized
// (sentence-initial articles, prepositions, etc.).
const STOPWORDS = new Set([
  'the','a','an','and','or','but','of','in','on','at','to','from','with','by',
  'for','over','under','near','into','onto','off','up','down','around','along',
  'through','watch','see','enjoy','try','catch','explore','wander','stroll',
  'experience','witness','attend','sample','taste','have','do','go','grab',
]);

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
 * True if the entry reads as a descriptive experience rather than a venue.
 * Heuristics:
 *  - Starts with an experience verb ("Watch the sunset…"), OR
 *  - Mentions an experience noun (sunset/rooftop/…) AND has no proper-noun
 *    token, OR
 *  - >7 words AND has no proper-noun token.
 *
 * A "proper noun" here is any non-first capitalized token that isn't a common
 * stopword. We exclude position 0 because a sentence-initial cap doesn't
 * disambiguate proper nouns from sentence case.
 */
function isExperiencePhrase(s: string): boolean {
  if (!s) return false;
  const trimmed = s.trim();
  if (EXPERIENCE_VERB_RE.test(trimmed)) return true;

  const tokens = trimmed.split(/\s+/);
  const hasProperNoun = tokens.some((tok, idx) => {
    if (idx === 0) return false;
    const cleaned = tok.replace(/[^\p{L}'’\-]/gu, '');
    if (!cleaned) return false;
    if (STOPWORDS.has(cleaned.toLowerCase())) return false;
    // Capitalized first letter (handles accented chars via Unicode)
    return /^\p{Lu}/u.test(cleaned);
  });

  if (EXPERIENCE_NOUN_RE.test(trimmed) && !hasProperNoun) return true;
  if (tokens.length > 7 && !hasProperNoun) return true;
  return false;
}

/**
 * Internal: split a raw metadata blob into cleaned entries (no
 * venue-vs-experience classification yet, just normalization + dedup).
 */
function splitMustDoEntries(metadata: unknown): string[] {
  const meta = (metadata || {}) as Record<string, unknown>;
  const raw = (meta as any).mustDoActivities;
  if (!raw) return [];

  let entries: string[] = [];
  if (Array.isArray(raw)) {
    entries = raw
      .filter((v) => typeof v === 'string')
      .flatMap((s) => String(s).split(/\n+/));
  } else if (typeof raw === 'string') {
    entries = raw.split(/\n+|,\s*(?=Day\s+\d+\b)/i);
  } else {
    return [];
  }

  const out: string[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const cleaned = cleanVenue(e);
    if (!cleaned) continue;
    if (/^(do\s+)?(flight|hotel|check.?in|check.?out|transfer)\b/i.test(cleaned)) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(cleaned);
  }
  return out;
}

/**
 * Extract a clean array of selected-attraction venue names from a trip's
 * `metadata.mustDoActivities` blob. Descriptive experience phrases (no venue
 * identity) are excluded — see `extractMustDoExperiences` for those.
 * Always returns string[] (possibly empty).
 */
export function extractMustDoVenues(metadata: unknown): string[] {
  return splitMustDoEntries(metadata).filter((s) => !isExperiencePhrase(s));
}

/**
 * Extract descriptive experience phrases (e.g. "Watch the sunset from a
 * rooftop overlooking the Bosphorus"). Used by the preference spine to
 * surface soft USER WISHES — NEVER fed to the coverage hard gate.
 */
export function extractMustDoExperiences(metadata: unknown): string[] {
  return splitMustDoEntries(metadata).filter((s) => isExperiencePhrase(s));
}

export const __test__ = { cleanVenue, isExperiencePhrase, splitMustDoEntries };
