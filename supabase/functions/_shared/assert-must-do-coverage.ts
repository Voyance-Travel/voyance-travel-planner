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

interface ActivityWithDay {
  act: any;
  dayNumber: number;
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
  // Mexico City
  teotihuacan: ['teotihuacan', 'teotihuacán', 'pyramids of teotihuacan', 'piramides de teotihuacan'],
  zocalo: ['zocalo', 'zócalo', 'plaza de la constitucion', 'plaza de la constitución'],
  'palacio de bellas artes': ['bellas artes', 'palacio de bellas artes', 'palace of fine arts'],
  'casa azul': ['casa azul', 'frida kahlo museum', 'museo frida kahlo'],
  // Istanbul
  'hagia sophia': ['hagia sophia', 'ayasofya', 'aya sofya'],
  'blue mosque': ['blue mosque', 'sultan ahmed mosque', 'sultanahmet camii'],
  'topkapi palace': ['topkapi', 'topkapı', 'topkapi palace', 'topkapı sarayı'],
  'grand bazaar': ['grand bazaar', 'kapali carsi', 'kapalı çarşı'],
  'basilica cistern': ['basilica cistern', 'yerebatan', 'yerebatan sarnici', 'yerebatan sarnıcı'],
  // Lisbon
  'tram 28': ['tram 28', 'electrico 28', 'eléctrico 28', 'tram 28 ride', 'ride tram', 'ride tram 28', 'tram 28 through alfama'],
  'belem tower': ['belem tower', 'torre de belem', 'torre de belém'],
  'jeronimos monastery': ['jeronimos', 'jerónimos', 'mosteiro dos jeronimos', 'mosteiro dos jerónimos'],
  // Amsterdam
  'canal boat tour': ['canal boat tour', 'canal cruise', 'boat tour', 'take a canal boat tour', 'canal tour', 'amsterdam canal cruise', 'canal sightseeing cruise'],
  'anne frank house': ['anne frank house', 'anne frank huis'],
  rijksmuseum: ['rijksmuseum'],
  'van gogh museum': ['van gogh museum', 'van gogh'],
};

/**
 * Named transit/water-experience patterns that are user-selected ATTRACTIONS,
 * not in-transit logistics. Tram 28, Funicular da Bica, Tram 1 (Lisbon),
 * canal boat tours, ferry rides — when the user lists them as must-dos they
 * are the destination, not the means of getting somewhere. These must NOT be
 * disqualified by NON_QUALIFYING_CATEGORY_RE just because the AI categorised
 * the row as `transport`.
 */
const NAMED_TRANSIT_EXPERIENCE_RE =
  /\b(tram|el[eé]ctrico|funicular|cable\s*car|gondola|cog\s*railway)\s*\d+\b|\b(canal\s+(?:boat|cruise|tour|sightseeing)|boat\s+tour|river\s+cruise|harbor\s+cruise|ferry\s+ride)\b/i;

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
    // Turkish dotless ı / capital İ don't decompose under NFKD — fold to 'i'
    // so "Topkapı Sarayı" matches the alias 'topkapi'.
    .replace(/[\u0131\u0130]/g, 'i')
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
  const title = String(act.title || act.name || '');
  // ESCAPE HATCH: named transit/water experiences (Tram 28, canal boat tour,
  // funicular, cable car, ferry ride) are user-selected attractions, not
  // logistics. Allow them through even if the AI tagged them `transport`.
  if (NAMED_TRANSIT_EXPERIENCE_RE.test(title)) {
    // Still block pure "travel to" framings.
    if (TRAVEL_PREFIX_RE.test(title)) return true;
    return false;
  }
  const cat = String(act.category || '').toLowerCase();
  if (NON_QUALIFYING_CATEGORY_RE.test(cat)) return true;
  if (TRAVEL_PREFIX_RE.test(title)) return true;
  const src = String(act.source || '').toLowerCase();
  if (/bookend|hotel.?return|hotel.?checkout/.test(src)) return true;
  return false;
}

/**
 * Build the identity haystack for an activity. Restricted to title | name |
 * venue | venue_name | location.name. We DO NOT search description /
 * location.address — those frequently mention a landmark in narrative prose
 * without scheduling it (e.g. "near the Pantheon, …").
 */
function activityIdentityHaystack(act: any): string {
  return normalize(
    [act.title, act.name, act.venue, act.venue_name, act.location?.name]
      .filter(Boolean)
      .join(' | ')
  );
}

/**
 * Exact/alias matcher pass. Non-qualifying categories ("transport",
 * "Travel to …") are filtered up front so they can't satisfy a venue.
 */
function activityMatches(act: any, matchers: string[]): boolean {
  if (!act || typeof act !== 'object') return false;
  if (isNonQualifyingActivity(act)) return false;
  const haystack = activityIdentityHaystack(act);
  return matchers.some(m => matchesWord(haystack, m));
}

// =============================================================================
// FUZZY VENUE MATCHING (conservative fallback)
// =============================================================================
//
// The exact/alias matcher above misses when the AI schedules the user's
// venue under a wrapper-style title ("Dinner at Roscioli" vs the user's
// "Eat at Roscioli"), a transliteration ("Topkapı Sarayı" vs "Topkapi
// Palace"), or a shortened form ("Topkapi" vs "Topkapi Palace"). Those are
// the systematic source of `itinerary_status='partial'` even when the trip
// is honestly complete.
//
// This layer extracts "core" identity tokens — dropping generic wrappers
// (tour/visit/dinner/…) and stop words — then requires either:
//   - shared distinctive tokens (≥1 token of length ≥5 shared exactly), AND
//   - if both venue and activity contribute ≥2 cores, ≥2 shared OR ≥7-char
//     shared token (to keep "Galata Tower" from matching "Galata Bridge"), OR
//   - close edit-distance on the venue's anchor token (transliterations).
//
// Refuses to fire on description/address fields or on non-qualifying
// categories — same defenses as the exact pass.

const FUZZY_STOPS = new Set([
  'the', 'of', 'at', 'in', 'on', 'to', 'for', 'and', 'with', 'by', 'from',
  'a', 'an', 'st', 'de', 'la', 'le', 'el', 'di',
]);

const FUZZY_GENERIC_WRAPPERS = new Set([
  // activity verbs/wrappers
  'tour', 'tours', 'guided', 'private', 'visit', 'visits', 'visiting',
  'experience', 'experiences', 'reservation', 'reservations',
  'walk', 'stroll', 'exploration', 'exploring', 'wander', 'wandering',
  'morning', 'afternoon', 'evening', 'night', 'nightly',
  'early', 'late', 'leisurely', 'scenic', 'exclusive', 'priority',
  'skip', 'line', 'self', 'free', 'roam',
  // dining wrappers (so "Eat at Roscioli" ≈ "Dinner at Roscioli")
  'eat', 'dine', 'dining', 'meal', 'meals', 'taste', 'tasting', 'tastings',
  'sample', 'attend', 'dinner', 'lunch', 'breakfast', 'brunch', 'drinks',
  'reservation', 'reservations',
]);


function coreTokens(s: string): string[] {
  return normalize(s).split(/\s+/).filter((t) =>
    t.length >= 3 && !FUZZY_STOPS.has(t) && !FUZZY_GENERIC_WRAPPERS.has(t)
  );
}

function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[m][n];
}

function fuzzyVenueMatch(venueText: string, actHaystack: string): boolean {
  const vCores = coreTokens(venueText);
  const aCores = coreTokens(actHaystack);
  if (vCores.length === 0 || aCores.length === 0) return false;
  const aSet = new Set(aCores);
  const shared = vCores.filter((t) => aSet.has(t));
  const hasDistinctive = shared.some((t) => t.length >= 5);

  if (hasDistinctive) {
    const minCores = Math.min(vCores.length, aCores.length);
    // Single-core on either side — the shared distinctive token suffices
    // ("Pantheon" ≈ "Pantheon Visit", "Eat at Roscioli" ≈ "Dinner at Roscioli").
    if (minCores === 1) return true;
    // Multi-core on BOTH sides — require ≥2 shared tokens so divergent
    // qualifiers ("Galata Tower" vs "Galata Bridge", "Recoleta Cemetery"
    // vs "Recoleta Neighborhood Walk", "Park Güell" vs "Park Ciutadella")
    // can't collide on a single shared word.
    if (shared.length >= 2) return true;
    return false;
  }


  // Edit-distance fallback for transliterations / minor spelling drift.
  for (const v of vCores) {
    if (v.length < 5) continue;
    for (const a of aCores) {
      if (a.length < 5) continue;
      if (Math.abs(a.length - v.length) > 2) continue;
      const allowed = Math.max(1, Math.floor(v.length / 6));
      if (editDistance(v, a) <= allowed) return true;
    }
  }
  return false;
}

function activityMatchesFuzzy(act: any, venueText: string): boolean {
  if (!act || typeof act !== 'object') return false;
  if (isNonQualifyingActivity(act)) return false;
  return fuzzyVenueMatch(venueText, activityIdentityHaystack(act));
}



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
    // Pass 1: exact/alias matcher. Prefer viable (non-overlapping) hits.
    let viable: ActivityWithDay | null = null;
    let anyHit: ActivityWithDay | null = null;
    let matchMode: 'exact' | 'fuzzy' | null = null;
    for (const entry of allWithDay) {
      if (!activityMatches(entry.act, matchers)) continue;
      if (!anyHit) { anyHit = entry; matchMode = 'exact'; }
      if (isVenueViableOnDay(entry.act, entry.dayNumber, allWithDay)) {
        viable = entry;
        break;
      }
    }
    // Pass 2: conservative fuzzy match (wrapper-stripped token overlap +
    // edit-distance). Only runs when the exact pass finds nothing — never
    // overrides a known overlap demotion.
    if (!viable && !anyHit) {
      for (const entry of allWithDay) {
        if (!activityMatchesFuzzy(entry.act, venue)) continue;
        if (!anyHit) { anyHit = entry; matchMode = 'fuzzy'; }
        if (isVenueViableOnDay(entry.act, entry.dayNumber, allWithDay)) {
          viable = entry;
          break;
        }
      }
    }
    // Accept overlapping hit as scheduled (the card IS in the itinerary; the
    // overlap is independently surfaced by TripHealthPanel). Prevents bogus
    // "Partial" badge when a must-do happens to sit next to another card.
    const hit = viable || anyHit || null;
    if (hit) {
      scheduled.push(venue);
      matchedActivityIds[venue] = typeof hit.act.id === 'string' ? hit.act.id : null;
      if (matchMode === 'fuzzy') {
        console.info(
          `[MUST_DO_FUZZY_MATCH] venue="${venue}" matched day=${hit.dayNumber} title="${hit.act?.title || hit.act?.name}"`,
        );
      }
      if (!viable && anyHit) {
        console.info(
          `[MUST_DO_OVERLAP_ACCEPTED] venue="${venue}" day=${anyHit.dayNumber} title="${anyHit.act?.title || anyHit.act?.name}" mode=${matchMode}`,
        );
      }
    } else {
      missing.push(venue);
      matchedActivityIds[venue] = null;
    }
  }

  return { missing, scheduled, total: mustDos.length, matchedActivityIds };
}

/**
 * Remove redundant injected must-do cards.
 *
 * The deterministic must-do injector (inject-missing-must-dos.ts) runs inside
 * the per-day chain against whatever days are visible at that moment. Under the
 * V2 self-invoke race, an earlier-day invocation can fire the injector before
 * later days' real placements are merged in — so it injects a card for a venue
 * the AI *did* schedule on another day, producing a duplicate that lands on the
 * last (departure) day. Because injected cards are locked `must_do` anchors, the
 * cross-day de-dup correctly refuses to drop them, so the duplicate survives.
 *
 * This pass runs ONCE on the finalized, complete itinerary (where every day's
 * real activities are present) and drops an injected card iff the SAME venue is
 * already covered by a NON-injected (AI- or user-placed) activity. The genuinely
 * missing must-do (no real placement anywhere) is kept. Mutates `allDays`.
 */
export function dropRedundantInjectedMustDos(
  allDays: any[],
): { dropped: Array<{ venue: string; dayNumber: number }> } {
  const dropped: Array<{ venue: string; dayNumber: number }> = [];
  const days = Array.isArray(allDays) ? allDays : [];
  // The "real" itinerary the user/AI actually built — injected cards excluded.
  const nonInjected = days.map((d) => ({
    ...d,
    activities: (Array.isArray(d?.activities) ? d.activities : []).filter(
      (a: any) => String(a?.source || '') !== 'must-do-injection',
    ),
  }));
  for (const day of days) {
    const acts = Array.isArray(day?.activities) ? day.activities : [];
    for (let i = acts.length - 1; i >= 0; i--) {
      const a = acts[i];
      if (String(a?.source || '') !== 'must-do-injection') continue;
      const venue = String(a?.title || a?.name || '').trim();
      if (!venue) continue;
      // Is this venue already satisfied by a real (non-injected) card anywhere?
      const cov = assertMustDoCoverage(nonInjected, [venue]);
      if (cov.scheduled.length > 0) {
        acts.splice(i, 1);
        dropped.push({ venue, dayNumber: Number(day?.dayNumber) || 0 });
        console.log(
          `[MUST_DO_INJECT_DEDUP] dropped redundant injected "${venue}" from day=${day?.dayNumber} (already placed by a real card)`,
        );
      }
    }
  }
  return { dropped };
}

// Re-export for tests
export const __test__ = { canonicalize, activityMatches, activityMatchesFuzzy, fuzzyVenueMatch, coreTokens, normalize, matchesWord, isNonQualifyingActivity, isVenueViableOnDay };
