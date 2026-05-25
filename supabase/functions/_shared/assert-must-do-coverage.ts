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
 */

export interface CoverageResult {
  missing: string[];
  scheduled: string[];
  total: number;
}

// Canonical aliases — landmarks the AI/user might phrase multiple ways.
// Each entry: canonical → list of substring matchers (lowercase).
const ALIAS_MAP: Record<string, string[]> = {
  vatican: ['vatican', 'st. peter', 'st peter', 'sistine', "saint peter's"],
  colosseum: ['colosseum', 'colosseo'],
  pantheon: ['pantheon'],
  'trevi fountain': ['trevi'],
  'roman forum': ['roman forum', 'forum romanum', 'foro romano', 'palatine'],
  louvre: ['louvre'],
  'eiffel tower': ['eiffel'],
  'notre dame': ['notre-dame', 'notre dame'],
  'sagrada familia': ['sagrada familia', 'sagrada família'],
  acropolis: ['acropolis', 'parthenon'],
};

function normalize(s: string): string {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Return the canonical key for a must-do venue, or the normalized name itself.
 */
function canonicalize(venue: string): { canonical: string; matchers: string[] } {
  const norm = normalize(venue);
  for (const [canonical, matchers] of Object.entries(ALIAS_MAP)) {
    for (const m of matchers) {
      if (norm.includes(m)) return { canonical, matchers };
    }
  }
  // Fall back: match by the venue's own normalized name (first 3 words for fuzziness)
  const words = norm.split(' ').slice(0, 3).join(' ');
  return { canonical: norm, matchers: [norm, words].filter(Boolean) };
}

/**
 * Check whether an activity's title/name/venue matches any of the matchers.
 */
function activityMatches(act: any, matchers: string[]): boolean {
  if (!act || typeof act !== 'object') return false;
  const haystack = normalize(
    [act.title, act.name, act.venue, act.location?.name, act.location?.address, act.description]
      .filter(Boolean)
      .join(' | ')
  );
  return matchers.some(m => m && haystack.includes(m));
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

  if (!Array.isArray(mustDos) || mustDos.length === 0) {
    return { missing, scheduled, total: 0 };
  }

  // Flatten all activities across all days
  const allActivities: any[] = [];
  for (const day of Array.isArray(allDays) ? allDays : []) {
    if (Array.isArray(day?.activities)) {
      allActivities.push(...day.activities);
    }
  }

  for (const venue of mustDos) {
    if (!venue || typeof venue !== 'string') continue;
    const { matchers } = canonicalize(venue);
    const found = allActivities.some(a => activityMatches(a, matchers));
    if (found) {
      scheduled.push(venue);
    } else {
      missing.push(venue);
    }
  }

  return { missing, scheduled, total: mustDos.length };
}

// Re-export for tests
export const __test__ = { canonicalize, activityMatches, normalize };
