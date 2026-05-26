/**
 * Post-generation must-do coverage assertion.
 *
 * Verifies every venue in `metadata.mustDoActivities` appears in at least one
 * day's activities (fuzzy match via canonical name + alias list).
 *
 * Wired into action-generate-trip-day.ts AFTER Phase 5 (table sync) and BEFORE
 * Phase 6 (freeze). Stamps `metadata.must_do_coverage = { missing, scheduled }`
 * + appends `MUST_DO_UNCOVERED` to `generation_health.persistGateCodes`.
 *
 * Closes the Rome `d18b2e8a…` class of bug where 3 of 4 user-selected
 * landmarks (Pantheon, Trevi, Vatican) silently dropped from the itinerary.
 *
 * IMPORTANT — Whole-word matching + restricted haystack:
 *  - The previous version did substring `includes` against
 *    `[title, name, venue, location.name, location.address, description]`.
 *    That let "Travel to …" match "Trevi" and let any narrative description
 *    referencing a landmark falsely mark it scheduled. Result: the Rome trip
 *    showed `missing=[]` while Days 2–3 had no Pantheon/Trevi/Vatican.
 *  - We now require `\b<matcher>\b` boundaries AND only consider the venue
 *    identity fields: `title | name | venue | location.name`. Descriptions
 *    and addresses are ignored.
 */

export interface CoverageResult {
  missing: string[];
  scheduled: string[];
  /** Per-venue trace: which activity satisfied each canonical key. */
  matchedActivityIds?: Record<string, string | null>;
  total: number;
}

// Canonical aliases — landmarks the AI/user might phrase multiple ways.
// Each entry: canonical → list of matcher tokens (lowercase). Matchers are
// applied with `\b…\b` word boundaries against the activity venue/title.
const ALIAS_MAP: Record<string, string[]> = {
  vatican: ['vatican', 'st peter', "st peter's", 'saint peter', 'sistine'],
  'st peter\'s basilica': ['st peter', "st peter's", 'saint peter', 'basilica di san pietro'],
  'vatican museums': ['vatican museum', 'vatican museums', 'musei vaticani'],
  colosseum: ['colosseum', 'colosseo'],
  pantheon: ['pantheon'],
  'trevi fountain': ['trevi fountain', 'fontana di trevi', 'trevi'],
  'roman forum': ['roman forum', 'forum romanum', 'foro romano', 'palatine'],
  louvre: ['louvre', 'musee du louvre', 'musée du louvre'],
  'eiffel tower': ['eiffel tower', 'eiffel', 'tour eiffel'],
  'notre dame': ['notre dame', 'notre-dame'],
  'sagrada familia': ['sagrada familia', 'sagrada família'],
  acropolis: ['acropolis', 'parthenon'],
  // Buenos Aires
  'teatro colon': ['teatro colon', 'teatro colón', 'colon theatre', 'colon theater'],
  'recoleta cemetery': ['recoleta cemetery', 'cementerio de la recoleta', 'cementerio recoleta'],
  caminito: ['caminito', 'caminito street', 'la boca caminito'],
  'san telmo market': ['san telmo market', 'mercado de san telmo', 'feria de san telmo', 'san telmo feria'],
};

/**
 * Categories whose rows can NEVER satisfy a venue-level must-do.
 * A "Travel to Teatro Colón" transport row mentions the venue but doesn't
 * schedule a visit; same for hotel returns, airport transfers, etc.
 */
const NON_QUALIFYING_CATEGORY_RE =
  /\b(transport|transit|transfer|logistics|airport|flight|accommodation|hotel.?return|hotel.?checkout|checkout|return|bookend)\b/i;

/**
 * Title prefixes that indicate the card is travelling TO the venue, not
 * spending time at it. Block "Travel to X" / "Walk to X" / "Transfer to X"
 * from satisfying an X must-do.
 */
const TRAVEL_PREFIX_RE = /^\s*(?:travel|walk|drive|ride|transfer|head|go|getting|en\s+route|on\s+the\s+way)\s+(?:to|towards?|over\s+to|back\s+to)\b/i;

function normalize(s: string): string {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    // Drop diacritics
    .replace(/[\u0300-\u036f]/g, '')
    // Drop punctuation we don't want to match across (keep word chars + spaces)
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Escape a token for safe use in a RegExp. */
function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build matchers for a must-do venue:
 *  - if any alias-map key/matcher matches the venue text, use that group's
 *    matchers PLUS the canonical key;
 *  - otherwise fall back to the venue's normalized name (and its first 3 words)
 *    so unknown venues still self-match.
 */
function canonicalize(venue: string): { canonical: string; matchers: string[] } {
  const norm = normalize(venue);
  for (const [canonical, matchers] of Object.entries(ALIAS_MAP)) {
    for (const m of matchers) {
      if (norm.includes(m)) {
        const set = new Set<string>([canonical, ...matchers]);
        return { canonical, matchers: Array.from(set).filter(Boolean) };
      }
    }
  }
  const words = norm.split(' ').filter(Boolean);
  const head = words.slice(0, 3).join(' ');
  return {
    canonical: norm,
    matchers: Array.from(new Set([norm, head].filter(Boolean))),
  };
}

/**
 * Whole-word match: matcher must appear bounded by non-word chars (or
 * start/end of string). Prevents "Trevi" matching "Travel to …" and
 * "Pantheon" matching "pantheonic vibes".
 */
function matchesWord(haystack: string, matcher: string): boolean {
  if (!haystack || !matcher) return false;
  // Allow multi-word matchers (e.g. "st peter") — escape, then anchor with \b.
  // For a matcher that ends in punctuation-stripped form, both ends are word chars.
  const re = new RegExp(`(?:^|\\W)${escapeRe(matcher)}(?:\\W|$)`, 'i');
  return re.test(haystack);
}

/**
 * Activities whose category or title make them ineligible as a must-do
 * "visit". Transport rows mention the venue but represent travel TO it.
 * Hotel-return / checkout / flight rows also frequently embed the name.
 */
function isNonQualifyingActivity(act: any): boolean {
  if (!act || typeof act !== 'object') return false;
  const cat = String(act.category || '').toLowerCase();
  if (NON_QUALIFYING_CATEGORY_RE.test(cat)) return true;
  const title = String(act.title || act.name || '');
  if (TRAVEL_PREFIX_RE.test(title)) return true;
  const src = String(act.source || '').toLowerCase();
  if (/bookend|hotel.?return|hotel.?checkout/.test(src)) return true;
  return false;
}

/**
 * Check whether an activity's identity fields match any matcher.
 *
 * Restricted haystack: title | name | venue | location.name. We DO NOT
 * search description / location.address — those frequently mention a
 * landmark in narrative prose without scheduling it (e.g. "near the
 * Pantheon, …"), which was the source of the Rome false-positive.
 *
 * Non-qualifying categories ("transport", "Travel to …") are filtered
 * upstream by the caller.
 */
function activityMatches(act: any, matchers: string[]): boolean {
  if (!act || typeof act !== 'object') return false;
  if (isNonQualifyingActivity(act)) return false;
  const haystack = normalize(
    [act.title, act.name, act.venue, act.venue_name, act.location?.name]
      .filter(Boolean)
      .join(' | ')
  );
  return matchers.some(m => matchesWord(haystack, m));
}

interface ActivityWithDay { act: any; dayNumber: number }

function parseHHMM(t: any): number | null {
  if (typeof t !== 'string') return null;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (Number.isNaN(h) || Number.isNaN(mm)) return null;
  return h * 60 + mm;
}

/**
 * A matched must-do card is considered "viable" only if it doesn't
 * substantially overlap another real (non-transit, non-bookend) activity
 * on the same day. Overlapping injected cards visually disappear behind
 * the row that was already there — the user perceives them as missing.
 */
function isVenueViableOnDay(
  matched: any,
  dayNumber: number,
  allWithDay: ActivityWithDay[],
): boolean {
  const start = parseHHMM(matched.startTime ?? matched.start_time ?? matched.time);
  const end = parseHHMM(matched.endTime ?? matched.end_time);
  if (start === null || end === null || end <= start) return true; // can't judge
  for (const { act, dayNumber: dn } of allWithDay) {
    if (dn !== dayNumber) continue;
    if (act === matched) continue;
    if (isNonQualifyingActivity(act)) continue;
    const s2 = parseHHMM(act.startTime ?? act.start_time ?? act.time);
    const e2 = parseHHMM(act.endTime ?? act.end_time);
    if (s2 === null || e2 === null || e2 <= s2) continue;
    const overlap = Math.max(0, Math.min(end, e2) - Math.max(start, s2));
    const matchedDur = end - start;
    // Substantial overlap = ≥50% of the matched card's duration AND ≥20 min.
    if (overlap >= 20 && overlap >= matchedDur * 0.5) return false;
  }
  return true;
}

/**
 * Assert that every must-do venue appears in at least one day.
 */
export function assertMustDoCoverage(
  allDays: any[],
  mustDos: string[]
): CoverageResult {
  const missing: string[] = [];
  const scheduled: string[] = [];
  const matchedActivityIds: Record<string, string | null> = {};

  if (!Array.isArray(mustDos) || mustDos.length === 0) {
    return { missing, scheduled, total: 0, matchedActivityIds };
  }

  // Flatten all activities across all days, tagged with their dayNumber so
  // we can detect overlaps within the matched card's day.
  const allWithDay: ActivityWithDay[] = [];
  for (const day of Array.isArray(allDays) ? allDays : []) {
    const dn = Number(day?.dayNumber) || 0;
    if (Array.isArray(day?.activities)) {
      for (const act of day.activities) allWithDay.push({ act, dayNumber: dn });
    }
  }

  for (const venue of mustDos) {
    if (!venue || typeof venue !== 'string') continue;
    const { matchers } = canonicalize(venue);
    // Find the BEST candidate: prefer viable (non-overlapping) matches.
    let viable: ActivityWithDay | null = null;
    let anyHit: ActivityWithDay | null = null;
    for (const entry of allWithDay) {
      if (!activityMatches(entry.act, matchers)) continue;
      if (!anyHit) anyHit = entry;
      if (isVenueViableOnDay(entry.act, entry.dayNumber, allWithDay)) {
        viable = entry;
        break;
      }
    }
    const hit = viable || null;
    if (hit) {
      scheduled.push(venue);
      matchedActivityIds[venue] = typeof hit.act.id === 'string' ? hit.act.id : null;
    } else {
      missing.push(venue);
      matchedActivityIds[venue] = null;
      if (anyHit) {
        console.warn(
          `[MUST_DO_OVERLAP_DEMOTE] venue="${venue}" matched day=${anyHit.dayNumber} title="${anyHit.act?.title || anyHit.act?.name}" overlaps a real activity → marking missing`,
        );
      }
    }
  }

  return { missing, scheduled, total: mustDos.length, matchedActivityIds };
}

// Re-export for tests
export const __test__ = { canonicalize, activityMatches, normalize, matchesWord, isNonQualifyingActivity, isVenueViableOnDay };
