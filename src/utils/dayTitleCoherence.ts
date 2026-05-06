/**
 * Client-side mirror of supabase/functions/generate-itinerary/pipeline/coherence-day-title.ts.
 *
 * Pure, read-only display helper: when a saved day's title doesn't intersect
 * any neighborhood / venue / category signal from its activities, we render
 * a derived label instead. The stored day is NOT mutated.
 */

interface ActivityLike {
  title?: string;
  name?: string;
  category?: string;
  type?: string;
  neighborhood?: string;
  location?: { neighborhood?: string; name?: string; address?: string } | null;
}

export interface DayLike {
  dayNumber?: number;
  title?: string;
  theme?: string;
  activities?: ActivityLike[];
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'and', 'or', 'with', '&',
  'day', 'days', 'morning', 'afternoon', 'evening', 'night',
  'tour', 'walk', 'visit', 'explore', 'experience',
  'to', 'from', 'for', 'by',
]);

const LOGISTICS_RE =
  /\b(arrival|departure|check[\s-]?in|check[\s-]?out|return\s+to|freshen\s+up|settle\s+in|luggage\s+drop|bag\s+drop|transfer|transit|airport|taxi|uber|metro|bus|train|drive\s+to|ride\s+to)\b/i;

const ALLOW_GENERIC_RE =
  /^(arrival|departure|free day|rest day|travel day|day\s*\d+(\s+in\s+.+)?)$/i;

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t) && t.length > 2);
}

function isLogistics(act: ActivityLike): boolean {
  const t = `${act.title || ''} ${act.name || ''}`;
  if (LOGISTICS_RE.test(t)) return true;
  const cat = (act.category || act.type || '').toLowerCase();
  return cat === 'transport' || cat === 'travel' || cat === 'transit' || cat === 'accommodation' || cat === 'stay';
}

function getNeighborhood(act: ActivityLike): string | undefined {
  return act.neighborhood || act.location?.neighborhood;
}

function topCount<T>(items: T[]): { value: T; count: number } | null {
  if (!items.length) return null;
  const counts = new Map<T, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  let best: { value: T; count: number } | null = null;
  for (const [value, count] of counts) {
    if (!best || count > best.count) best = { value, count };
  }
  return best;
}

function categoryVibe(activities: ActivityLike[]): string | null {
  const counts = { dining: 0, cultural: 0, sightseeing: 0, shopping: 0, relaxation: 0 };
  for (const a of activities) {
    const c = (a.category || a.type || '').toLowerCase();
    if (c in counts) (counts as Record<string, number>)[c]++;
  }
  if (counts.dining >= 3) return 'food';
  if (counts.cultural >= 2) return 'museum';
  if (counts.shopping >= 2) return 'shopping';
  if (counts.relaxation >= 2) return 'relaxation';
  if (counts.sightseeing >= 3) return 'sightseeing';
  return null;
}

function vibeLabel(vibe: string, city: string): string {
  switch (vibe) {
    case 'food': return `Culinary Day in ${city}`;
    case 'museum': return `Museum & Culture in ${city}`;
    case 'shopping': return `Shopping in ${city}`;
    case 'relaxation': return `Slow Day in ${city}`;
    case 'sightseeing': return `Sightseeing in ${city}`;
    default: return `Day in ${city}`;
  }
}

function deriveTitle(day: DayLike, city: string): string {
  const acts = (day.activities || []).filter((a) => !isLogistics(a));
  if (acts.length === 0) {
    const titles = (day.activities || []).map((a) => (a.title || '').toLowerCase());
    if (titles.some((t) => /arrival|check.?in/.test(t))) return `Arrival in ${city}`;
    if (titles.some((t) => /departure|check.?out/.test(t))) return `Departure from ${city}`;
    return `Day ${day.dayNumber ?? ''} in ${city}`.trim();
  }

  const neighborhoods = acts.map(getNeighborhood).filter((n): n is string => !!n && n.trim().length > 1);
  const topHood = topCount(neighborhoods);

  const headline = acts.find((a) => {
    const c = (a.category || a.type || '').toLowerCase();
    return c !== 'dining';
  }) || acts[0];
  const headlineName = (headline?.title || headline?.name || '').replace(/\s*-\s*.+$/, '').trim();

  if (topHood && topHood.count >= 2 && headlineName) return `${topHood.value} & ${headlineName}`;
  if (topHood && topHood.count >= 2) return `${topHood.value} in ${city}`;

  const vibe = categoryVibe(acts);
  if (vibe) return vibeLabel(vibe, city);

  if (headlineName) return `${headlineName} in ${city}`;
  return `Day ${day.dayNumber ?? ''} in ${city}`.trim();
}

function isCoherent(title: string, day: DayLike): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  if (ALLOW_GENERIC_RE.test(trimmed)) return true;

  const titleTokens = new Set(tokenize(trimmed));
  if (titleTokens.size === 0) return false;

  const acts = (day.activities || []).filter((a) => !isLogistics(a));
  if (acts.length === 0) return ALLOW_GENERIC_RE.test(trimmed);

  const signalTokens = new Set<string>();
  for (const a of acts) {
    const hood = getNeighborhood(a);
    if (hood) tokenize(hood).forEach((t) => signalTokens.add(t));
    const venue = a.title || a.name || '';
    if (venue) tokenize(venue).forEach((t) => signalTokens.add(t));
  }

  const vibe = categoryVibe(acts);
  if (vibe === 'food') ['food', 'culinary', 'taste', 'gastronomy', 'dining'].forEach((t) => signalTokens.add(t));
  if (vibe === 'museum') ['art', 'museum', 'culture', 'cultural', 'gallery', 'history'].forEach((t) => signalTokens.add(t));
  if (vibe === 'shopping') ['shopping', 'market', 'boutique'].forEach((t) => signalTokens.add(t));
  if (vibe === 'relaxation') ['spa', 'wellness', 'relax', 'slow', 'rest'].forEach((t) => signalTokens.add(t));

  for (const t of titleTokens) {
    if (signalTokens.has(t)) return true;
  }
  return false;
}

/**
 * Returns the title to display for a day. Prefers the stored title when
 * coherent; otherwise returns a derived label. Never mutates the day.
 */
export function getDisplayDayTitle(
  day: DayLike | null | undefined,
  city?: string | null,
): string {
  if (!day) return '';
  const cityName = (city || '').trim() || 'the city';
  const oldTitle = (day.title || day.theme || '').trim();
  const acts = day.activities || [];

  // Not enough signal — keep whatever the stored title is.
  if (acts.length < 3) return oldTitle;

  if (oldTitle && isCoherent(oldTitle, day)) return oldTitle;

  const newTitle = deriveTitle(day, cityName);
  if (oldTitle && newTitle !== oldTitle) {
    try {
      console.warn(`[client-day-title] Day ${day.dayNumber ?? '?'}: "${oldTitle}" → "${newTitle}"`);
    } catch {
      // ignore
    }
  }
  return newTitle;
}
