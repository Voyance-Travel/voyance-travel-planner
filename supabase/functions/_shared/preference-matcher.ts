/**
 * preference-matcher.ts — semantic fulfillment matcher for preferences.
 *
 * Replaces title-only matching. Given a `MergedIntent` (sushi lunch, rooftop
 * drinks, hidden gem, slow pace, avoid museums), determines whether the
 * activities of a day satisfy the intent's *category* — not just its literal
 * string. Soft-only: never used by hard repair, only by trace + save-time
 * ledger annotations.
 *
 * Pure: no IO. Caller passes the day's activities.
 */

import type { MergedIntent } from './preference-spine.ts';

interface DayActivity {
  title?: string;
  name?: string;
  category?: string;
  type?: string;
  cuisine?: string;
  description?: string;
  startTime?: string;
}

/**
 * Category aliases — each entry is a list of token regexes that, if matched
 * against title|name|category|cuisine|description, fulfill that intent kind.
 * Order: more-specific first.
 */
const CATEGORY_ALIASES: Record<string, RegExp[]> = {
  sushi: [/\bsushi\b/i, /\bomakase\b/i, /\bsashimi\b/i, /\bkaiseki\b/i, /\bnigiri\b/i, /\bizakaya\b/i],
  rooftop: [/\brooftop\b/i, /\bskybar\b/i, /\bsky bar\b/i, /\bterrace\b/i, /\bpanoramic\b/i, /\bview(s)? bar\b/i, /\bobservation\b/i],
  hidden_gem: [/\bhidden gem\b/i, /\blocal favorite\b/i, /\boff[- ]?the[- ]?beaten\b/i, /\bneighborhood\b/i, /\bhole[- ]?in[- ]?the[- ]?wall\b/i, /\btucked away\b/i],
  spa: [/\bspa\b/i, /\bonsen\b/i, /\bhammam\b/i, /\bthermal\b/i, /\bmassage\b/i, /\bwellness\b/i, /\bsauna\b/i],
  wine: [/\bwine\b/i, /\bvineyard\b/i, /\bwinery\b/i, /\btasting\b/i, /\benoteca\b/i, /\bsommelier\b/i],
  cocktail: [/\bcocktail\b/i, /\bspeakeasy\b/i, /\bmixology\b/i, /\bnightcap\b/i, /\baperitif\b/i],
  museum: [/\bmuseum\b/i, /\bgallery\b/i, /\bexhibit\b/i, /\bcollection\b/i],
  market: [/\bmarket\b/i, /\bmercato\b/i, /\bsouk\b/i, /\bbazaar\b/i, /\bfood hall\b/i],
  shopping: [/\bshopping\b/i, /\bboutique\b/i, /\bmall\b/i, /\bstore\b/i],
  beach: [/\bbeach\b/i, /\bseaside\b/i, /\bshore\b/i, /\bcoast\b/i],
  hike: [/\bhike\b/i, /\btrail\b/i, /\btrek\b/i, /\bwalk\b/i, /\bnature\b/i],
  michelin: [/\bmichelin\b/i, /\bstarred\b/i, /\bfine dining\b/i, /\btasting menu\b/i],
  vegan: [/\bvegan\b/i, /\bplant[- ]?based\b/i],
  vegetarian: [/\bvegetarian\b/i, /\bvegan\b/i, /\bplant[- ]?based\b/i],
  coffee: [/\bcoffee\b/i, /\bcafé\b/i, /\bcafe\b/i, /\broastery\b/i, /\bespresso\b/i],
};

/** Token regexes used by the literal-title fallback. */
function literalTokens(title: string): RegExp[] {
  const words = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  return words.slice(0, 4).map((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'));
}

const STOPWORDS = new Set([
  'this', 'that', 'with', 'from', 'have', 'want', 'love', 'like', 'some',
  'good', 'best', 'find', 'place', 'spot', 'somewhere', 'something', 'really',
  'maybe', 'visit', 'experience', 'enjoy', 'into', 'about', 'their', 'them',
]);

/** Map an intent to its alias key (or null = literal-token fallback). */
function aliasKeyFor(intent: MergedIntent): string | null {
  const blob = `${intent.kind || ''} ${intent.title || ''} ${intent.raw || ''}`.toLowerCase();
  for (const key of Object.keys(CATEGORY_ALIASES)) {
    const re = new RegExp(`\\b${key.replace('_', '[ _-]?')}\\b`, 'i');
    if (re.test(blob)) return key;
    // Single-token kind match (e.g. kind="sushi")
    if (intent.kind && intent.kind.toLowerCase() === key) return key;
  }
  return null;
}

function activityBlob(a: DayActivity): string {
  return [
    a.title,
    a.name,
    a.category,
    a.type,
    a.cuisine,
    a.description,
  ].filter(Boolean).join(' ').toLowerCase();
}

export interface IntentMatch {
  fulfilled: boolean;
  evidenceIndex: number;
  evidenceTitle?: string;
  matchKind: 'alias' | 'literal' | 'avoid_absent' | 'avoid_present' | 'no_match';
  aliasKey?: string;
}

/**
 * Determine whether a day's activities satisfy a single intent.
 * - "must"/"should" → fulfilled when any activity matches the alias or literal.
 * - "avoid"         → fulfilled when NO activity matches (avoid_absent).
 */
export function matchIntent(intent: MergedIntent, activities: DayActivity[]): IntentMatch {
  const acts = Array.isArray(activities) ? activities : [];
  const isAvoid = intent.priority === 'avoid';
  const aliasKey = aliasKeyFor(intent);
  const patterns = aliasKey ? CATEGORY_ALIASES[aliasKey] : literalTokens(intent.title || '');
  if (patterns.length === 0) {
    return { fulfilled: !isAvoid ? false : true, evidenceIndex: -1, matchKind: 'no_match' };
  }

  for (let i = 0; i < acts.length; i++) {
    const blob = activityBlob(acts[i]);
    if (!blob) continue;
    for (const re of patterns) {
      if (re.test(blob)) {
        if (isAvoid) {
          return {
            fulfilled: false,
            evidenceIndex: i,
            evidenceTitle: acts[i].title || acts[i].name,
            matchKind: 'avoid_present',
            aliasKey: aliasKey || undefined,
          };
        }
        return {
          fulfilled: true,
          evidenceIndex: i,
          evidenceTitle: acts[i].title || acts[i].name,
          matchKind: aliasKey ? 'alias' : 'literal',
          aliasKey: aliasKey || undefined,
        };
      }
    }
  }

  if (isAvoid) {
    return { fulfilled: true, evidenceIndex: -1, matchKind: 'avoid_absent', aliasKey: aliasKey || undefined };
  }
  return { fulfilled: false, evidenceIndex: -1, matchKind: 'no_match', aliasKey: aliasKey || undefined };
}

export interface DayMatchSummary {
  dayNumber: number;
  totalIntents: number;
  fulfilledCount: number;
  missedCount: number;
  /** Per-intent records, kept small for trace. */
  details: Array<{
    title: string;
    priority: string;
    fulfilled: boolean;
    matchKind: string;
    evidenceTitle?: string;
  }>;
}

export function matchDayIntents(
  intents: MergedIntent[],
  dayNumber: number,
  activities: DayActivity[],
): DayMatchSummary {
  const relevant = intents.filter(
    (i) => i.dayNumber == null || i.dayNumber === dayNumber,
  );
  const details: DayMatchSummary['details'] = [];
  let fulfilled = 0;
  let missed = 0;
  for (const i of relevant) {
    const m = matchIntent(i, activities);
    if (m.fulfilled) fulfilled++;
    else missed++;
    if (details.length < 12) {
      details.push({
        title: i.title,
        priority: i.priority,
        fulfilled: m.fulfilled,
        matchKind: m.matchKind,
        evidenceTitle: m.evidenceTitle,
      });
    }
  }
  return {
    dayNumber,
    totalIntents: relevant.length,
    fulfilledCount: fulfilled,
    missedCount: missed,
    details,
  };
}
