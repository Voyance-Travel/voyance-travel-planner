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
const EXPERIENCE_VERB_RE = /^(?:watch|see|experience|enjoy|try|catch|witness|explore|wander|walk|roam|stroll|relax|unwind|hunt|sample|taste|attend|listen|find|discover|do|have|go|grab|take|spend|check\s*out|soak)\b/i;
// Experience nouns that, when present without a proper noun, indicate an
// activity wish rather than a venue.
const EXPERIENCE_NOUN_RE = /\b(?:sunset|sunrise|vibes|atmosphere|nightlife|rooftop|beach day|day trip|hidden gem|local life|street food|live music)\b/i;
// Major events / occasions / festivals. A user naming one (e.g. "plan a day in
// Atlanta for the World Cup") means it as the OCCASION/theme of the trip, not a
// venue to drop a literal "World Cup" activity card on. These read as proper
// nouns to the venue heuristic, so without this they get locked as must-do
// venues and rendered as a single literal activity — conflating the occasion
// with the real ask ("walk around, see the sights"). Classify them as soft
// experience wishes instead so they inform the vibe but never become a locked
// card.
export const EVENT_THEME_RE = /\b(?:world cup|fifa|olympics?|olympic games|paralympics?|super ?bowl|world series|nba finals|stanley cup|march madness|the masters|wimbledon|us open|french open|australian open|roland garros|grand prix|formula\s?1|f1\b|world athletics|coachella|glastonbury|tomorrowland|lollapalooza|burning man|sxsw|oktoberfest|mardi gras|carnival|carnaval|la tomatina|running of the bulls|comic ?con|new year'?s eve|marathon|pride parade|pride festival|pride week)\b/i;

/**
 * detectEventTheme — returns the matched major-event phrase (e.g. "World Cup")
 * when the text references a recognized event/occasion that is the trip's THEME
 * rather than a literal venue, else null. Used by compile-prompt to build a
 * grounded event block, and by sanitization to scrub vague "{event} vibes"
 * filler. See mem://day-trip-and-event-theme.
 */
export function detectEventTheme(text: unknown): string | null {
  const s = typeof text === 'string' ? text : '';
  if (!s.trim()) return null;
  const m = s.match(EVENT_THEME_RE);
  return m ? m[0] : null;
}
// Generic "things to do" FILLER — a vague paraphrase the NL extractor produces
// from soft intent like "walk around and see the sights" ("free downtown
// activities", "fun things to do", "cheap local spots", "explore the area").
// These name no venue; locking them as must-dos schedules literal placeholder
// cards ("Free downtown activities") instead of real attractions, so the day
// looks full but the user "didn't actually find activities". Classify them as
// a soft vibe so the generator fills the day with REAL named venues instead.
// Requires a generic noun (activities/things/spots/stuff/sights/places/area)
// AND no proper noun — a real venue ("Ponce City Market") is never matched.
const GENERIC_ACTIVITY_NOUN_RE = /\b(?:activities|things\s+to\s+do|stuff(?:\s+to\s+do)?|spots?|sights?|sightseeing|places?(?:\s+to\s+(?:go|visit|see))?|attractions?|the\s+area|around\s+town|downtown|nearby|local\s+(?:scene|gems?|favou?rites?))\b/i;
const GENERIC_FILLER_QUALIFIER_RE = /\b(?:free|fun|cheap|budget|cool|nice|good|great|popular|touristy?|local|casual|chill|relaxed|easy|walk(?:able|ing)?|explore|see|do|downtown|outdoor|indoor|hidden|off[\s-]the[\s-]beaten)\b/i;
// Venue-type nouns: when an event word appears INSIDE a named venue ("Olympic
// Park", "World Cup Stadium", "Carnival Museum"), it is a real place to visit,
// not the event itself — so it must stay a venue, not get soft-classified.
const VENUE_TYPE_RE = /\b(?:park|stadium|arena|museum|cent(?:er|re)|hall|square|gardens?|market|tower|bridge|gallery|theat(?:er|re)|stations?|plaza|pavilion|hotel|bar|club|pub|restaurant|caf[eé]|street|avenue|district|quarter|cathedral|basilica|palace|castle|temple|shrine|monument|memorial|library|aquarium|zoo)\b/i;
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
  // Strip leading bullet markers ("- Pantheon" → "Pantheon") so list-formatted
  // blobs (Smart Finish research context) resolve to bare venue names.
  s = s.replace(/^[-•*–]\s+/, '').trim();
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
  // A major event/occasion is a theme, not a venue (see EVENT_THEME_RE) —
  // unless the event word sits inside a named venue ("Olympic Park"), which
  // stays a real place to visit.
  if (EVENT_THEME_RE.test(trimmed) && !VENUE_TYPE_RE.test(trimmed)) return true;

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
  // Generic "things to do" filler (no venue identity): a generic activity noun
  // + a vague qualifier + no proper noun → soft vibe, not a must-do venue.
  if (
    !hasProperNoun &&
    GENERIC_ACTIVITY_NOUN_RE.test(trimmed) &&
    GENERIC_FILLER_QUALIFIER_RE.test(trimmed)
  ) return true;
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
    // SCAFFOLDING GUARD: Smart Finish writes its research-context blob into
    // metadata.mustDoActivities, so header/label lines flow through here —
    // "SMART_FINISH_SOURCE_NOTES:", "USER'S RESEARCHED PLACES & ACTIVITIES
    // (…):", "TRIP PRIORITIES:". A venue name never ends with a colon; one
    // such header shipped as a LOCKED sightseeing card titled
    // "SMART_FINISH_SOURCE_NOTES:" (Step-5 manual-mode QA, Seville). The
    // experience filter can't catch these (ALL-CAPS tokens read as proper
    // nouns), so drop them at the split.
    if (/:$/.test(cleaned)) continue;
    if (/\bSOURCE_NOTES\b|\bSMART_FINISH\b/i.test(cleaned)) continue;
    // Fully-quoted entry = the user's preference text echoed into the blob
    // ('"loves tapas and history"'), not a venue.
    if (/^["'“”‘’].*["'“”‘’]$/.test(cleaned)) continue;
    // "ALL-CAPS LABEL: value" line ("TRIP PRIORITIES: food, culture",
    // "USER PREFERENCES: …") — a metadata label, not a venue.
    if (/^[A-Z][A-Z0-9_'’\s&()/]*:\s/.test(cleaned)) continue;
    // A long sentence ending in a period is an instruction ("Keep all
    // user-provided anchors, then expand …"). Venue names are short and
    // unpunctuated; abbreviation-final names ("Washington D.C.") stay under
    // the 6-word floor.
    if (/\.$/.test(cleaned) && cleaned.split(/\s+/).length >= 6) continue;
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
