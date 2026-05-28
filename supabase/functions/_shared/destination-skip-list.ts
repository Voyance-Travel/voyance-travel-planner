/**
 * Destination Skip List — canonical source used by BOTH:
 *   - The Voyance Intelligence "Why we skipped" UI panel (FE: src/utils/itineraryValidator.ts)
 *   - The generation pipeline (prompt injection, validate-day, repair-day, refill)
 *
 * Pre-2026-05-28 these two surfaces ran on independent lists, so the generator
 * would happily emit "Robot Restaurant" in Tokyo even though the UI then flagged
 * it as a skip-list violation. See mem://constraints/itinerary/destination-skip-list.
 *
 * Two tiers:
 *  1. Hardcoded seed keywords (mirrored from FE) — always applied.
 *  2. AI-generated alternatives cached in `destination_insights_cache`
 *     (written by `generate-skip-list` edge fn). Hydrated lazily.
 */

export interface SkipListEntry {
  /** Lowercased substring to match against title / description. */
  keyword: string;
  /** Optional positive copy describing the better local alternative. */
  alternative?: string;
  /** Optional reason — surfaced in prompt so model has substitute reasoning. */
  reason?: string;
  /** Where this entry came from. */
  source: 'hardcoded' | 'ai_cache';
}

const HARDCODED_SKIP_LIST: Record<string, Array<Omit<SkipListEntry, 'source'>>> = {
  paris: [
    { keyword: 'seine cruise' }, { keyword: 'river cruise' }, { keyword: 'bateaux' },
    { keyword: 'dinner cruise' }, { keyword: 'sunset cruise on seine' },
    { keyword: 'boat cruise on seine' }, { keyword: 'cruise on the seine' },
    { keyword: 'champs-elysees restaurant' }, { keyword: 'champs elysees dining' },
    { keyword: 'montmartre portrait' }, { keyword: 'place du tertre artists' },
  ],
  tokyo: [
    { keyword: 'robot restaurant' }, { keyword: 'robot show' },
    { keyword: 'skytree observation' }, { keyword: 'tokyo skytree' },
  ],
  rome: [
    { keyword: 'piazza navona restaurant' }, { keyword: 'navona restaurant' },
    { keyword: 'eating at piazza navona' },
    { keyword: 'via veneto restaurant' }, { keyword: 'dining on via veneto' },
  ],
  london: [
    { keyword: 'leicester square restaurant' }, { keyword: 'leicester square dining' },
    { keyword: 'hard rock cafe' },
  ],
  barcelona: [
    { keyword: 'rambla restaurant' }, { keyword: 'las ramblas dining' },
    { keyword: 'eating on la rambla' },
    { keyword: 'barceloneta beachfront restaurant' }, { keyword: 'beach paella barceloneta' },
  ],
};

/**
 * Pick the city key for a destination string (handles "Tokyo, Japan",
 * "Greater Tokyo", etc.). Returns null if no seed coverage.
 */
function pickCityKey(destination: string): string | null {
  const destLower = destination.toLowerCase().trim();
  for (const city of Object.keys(HARDCODED_SKIP_LIST)) {
    if (destLower.includes(city) || city.includes(destLower.split(',')[0].trim())) {
      return city;
    }
  }
  return null;
}

/**
 * Resolve the merged skip list for a destination.
 *
 * Reads hardcoded seeds + AI cache (if supabase passed). Always returns at
 * least an empty array — never throws on cache failure.
 */
export async function getDestinationSkipList(
  destination: string,
  supabase?: any,
): Promise<SkipListEntry[]> {
  if (!destination) return [];

  const out: SkipListEntry[] = [];
  const seen = new Set<string>();

  // Tier 1: hardcoded seeds
  const cityKey = pickCityKey(destination);
  if (cityKey) {
    for (const e of HARDCODED_SKIP_LIST[cityKey]) {
      const k = e.keyword.toLowerCase().trim();
      if (k && !seen.has(k)) {
        seen.add(k);
        out.push({ ...e, source: 'hardcoded' });
      }
    }
  }

  // Tier 2: AI cache. Stored under `destination_insights_cache` with key
  // `skip_list:<destLower>`. Tolerant of missing rows / schema drift.
  if (supabase) {
    try {
      const cacheKey = `skip_list:${destination.toLowerCase().trim()}`;
      const { data } = await supabase
        .from('destination_insights_cache')
        .select('insights, expires_at')
        .eq('destination', cacheKey)
        .maybeSingle();
      if (data?.insights) {
        const rows = Array.isArray(data.insights)
          ? data.insights
          : (Array.isArray((data.insights as any)?.items) ? (data.insights as any).items : []);
        for (const r of rows) {
          if (!r || typeof r !== 'object') continue;
          const name = String((r as any).name || (r as any).keyword || '').trim();
          if (!name) continue;
          const k = name.toLowerCase();
          if (seen.has(k)) continue;
          seen.add(k);
          out.push({
            keyword: k,
            alternative: typeof (r as any).localAlternative === 'string'
              ? (r as any).localAlternative
              : (typeof (r as any).alternative === 'string' ? (r as any).alternative : undefined),
            reason: typeof (r as any).reason === 'string' ? (r as any).reason : undefined,
            source: 'ai_cache',
          });
        }
      }
    } catch (e) {
      console.warn('[destination-skip-list] cache read failed (non-blocking):', (e as Error).message);
    }
  }

  return out;
}

/**
 * Test whether an activity (title + optional description) trips the skip list.
 *
 * Mirrors the FE matcher: substring match against lowercased title or
 * description, keywords shorter than 3 chars ignored, returns the first hit.
 */
export function matchesDestinationSkipList(
  title: string,
  description: string | undefined,
  list: SkipListEntry[],
): SkipListEntry | null {
  if (!list || list.length === 0) return null;
  const t = (title || '').toLowerCase();
  const d = (description || '').toLowerCase();
  for (const entry of list) {
    const k = entry.keyword;
    if (!k || k.length < 3) continue;
    if (t.includes(k) || d.includes(k)) return entry;
  }
  return null;
}

/**
 * Render the skip list as a prompt-friendly bullet block. Returns empty
 * string when list is empty so callers can interpolate unconditionally.
 */
export function renderSkipListPromptBlock(list: SkipListEntry[]): string {
  if (!list || list.length === 0) return '';
  const lines: string[] = [];
  lines.push('🚫 DESTINATION SKIP LIST — DO NOT PLACE THESE');
  lines.push('─'.repeat(50));
  lines.push('Activities matching ANY item below are FORBIDDEN. If you would normally suggest one, use the listed local alternative instead. The user has been told these are tourist traps; placing one contradicts our own intelligence panel.');
  for (const e of list.slice(0, 24)) { // hard cap so prompt stays sane
    const alt = e.alternative ? ` → use instead: ${e.alternative}` : '';
    lines.push(`   ❌ ${e.keyword}${alt}`);
  }
  return lines.join('\n');
}
