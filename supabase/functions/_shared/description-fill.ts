/**
 * Batched LLM description fill — backstops the phantom-ref scrubber + intermittent
 * AI omissions that leave activity descriptions blank or generic.
 *
 * Strategy: ONE Gemini-flash call per day for ALL flagged activities (vs. per-activity
 * round-trips). Strict JSON tool output: { id, description }[]. Hard 8s timeout —
 * on failure, leaves descriptions empty (no generic placeholder per Density Protocol).
 *
 * Wired post-`repairDay` in action-generate-trip-day.ts + action-generate-day.ts.
 *
 * Memory: mem://constraints/itinerary/description-coverage
 */

import { FAILURE_CODES } from '../generate-itinerary/pipeline/types.ts';
import {
  shouldSkipDescriptionCheck,
  RESTAURANT_RECOMMENDATION_RE,
} from '../generate-itinerary/pipeline/validate-day.ts';

const DESC_MIN_CHARS = 30;
const FILL_TIMEOUT_MS = 8000;

const DINING_CATS_LOWER = new Set([
  'dining', 'restaurant', 'food', 'breakfast', 'lunch', 'dinner', 'brunch', 'drinks',
]);

function isRestaurantActivity(act: any): boolean {
  if (!act || typeof act !== 'object') return false;
  const cat = String(act.category || '').toLowerCase();
  if (DINING_CATS_LOWER.has(cat)) return true;
  const sub = String(act.subcategory || '').toLowerCase();
  return /restaurant|dining|food|brunch|lunch|dinner|breakfast/.test(sub);
}

function needsFill(act: any): { needs: boolean; isRestaurant: boolean } {
  if (shouldSkipDescriptionCheck(act)) return { needs: false, isRestaurant: false };
  const desc = typeof act.description === 'string' ? act.description.trim() : '';
  const isRest = isRestaurantActivity(act);
  if (desc.length < DESC_MIN_CHARS) return { needs: true, isRestaurant: isRest };
  if (isRest && !RESTAURANT_RECOMMENDATION_RE.test(desc)) return { needs: true, isRestaurant: true };
  return { needs: false, isRestaurant: isRest };
}

interface FillTarget {
  id: string;
  index: number;
  title: string;
  venue: string;
  category: string;
  subcategory: string;
  isRestaurant: boolean;
}

const FILL_TOOL = {
  type: 'function' as const,
  function: {
    name: 'fill_descriptions',
    description: 'Return one insider description per activity id.',
    parameters: {
      type: 'object',
      properties: {
        descriptions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id:          { type: 'string' },
              description: { type: 'string', minLength: 30, maxLength: 280 },
            },
            required: ['id', 'description'],
          },
        },
      },
      required: ['descriptions'],
    },
  },
};

export interface DescriptionFillCounters {
  scanned: number;
  flagged: number;
  filled: number;
  skipped: number;
  errored: boolean;
}

export async function fillMissingDescriptions(
  activities: any[],
  destination: string | undefined,
  apiKey: string | undefined,
  dayNumber: number,
): Promise<DescriptionFillCounters> {
  const counters: DescriptionFillCounters = {
    scanned: Array.isArray(activities) ? activities.length : 0,
    flagged: 0,
    filled: 0,
    skipped: 0,
    errored: false,
  };

  if (!Array.isArray(activities) || activities.length === 0) return counters;
  if (!apiKey) {
    counters.errored = true;
    console.warn(`[DESC_FILL] day=${dayNumber} no LOVABLE_API_KEY — skipping`);
    return counters;
  }

  const targets: FillTarget[] = [];
  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];
    const { needs, isRestaurant } = needsFill(act);
    if (!needs) continue;
    counters.flagged++;
    const id = String(act?.id ?? `idx-${i}`);
    targets.push({
      id,
      index: i,
      title: String(act?.title || act?.name || '').slice(0, 120),
      venue: String(act?.location?.name || act?.venue_name || '').slice(0, 120),
      category: String(act?.category || ''),
      subcategory: String(act?.subcategory || ''),
      isRestaurant,
    });
  }

  if (targets.length === 0) return counters;

  const dest = destination || 'the destination';
  const prompt = [
    `You are a senior travel concierge. For each activity below in ${dest}, write ONE insider-value description (30–200 chars).`,
    ``,
    `Rules:`,
    `- Restaurants: lead with an actionable verb — "Order the ...", "Try the ...", "Request a table ...", "Ask for ...", "Don't miss the ...". Name a signature dish/area/timing.`,
    `- Attractions/museums: ONE specific tip — entrance, what to focus on, light/crowd timing.`,
    `- Experiences/tours: ONE specific calibration — what to wear/bring, skill level, what to expect.`,
    `- NO generic openings ("This is a great…", "You'll love…", "Amazing…").`,
    `- NO references to other activities not in this list.`,
    `- Plain prose, no markdown, no emoji.`,
    ``,
    `Activities:`,
    ...targets.map(t => {
      const tag = t.isRestaurant ? 'RESTAURANT' : t.category.toUpperCase() || 'ACTIVITY';
      const venue = t.venue && t.venue !== t.title ? ` — venue: ${t.venue}` : '';
      return `- id="${t.id}" [${tag}] ${t.title}${venue}`;
    }),
    ``,
    `Return descriptions for EVERY id via the fill_descriptions tool.`,
  ].join('\n');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FILL_TIMEOUT_MS);

  try {
    const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }],
        tools: [FILL_TOOL],
        tool_choice: { type: 'function', function: { name: 'fill_descriptions' } },
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      counters.errored = true;
      console.warn(`[DESC_FILL] day=${dayNumber} HTTP ${res.status} — skipping`);
      await res.text().catch(() => {});
      return counters;
    }

    const data = await res.json();
    const toolCall = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = toolCall?.function?.arguments;
    const args = typeof argsRaw === 'string' ? JSON.parse(argsRaw) : argsRaw;
    const list: Array<{ id: string; description: string }> = Array.isArray(args?.descriptions) ? args.descriptions : [];

    const byId = new Map(list.map(d => [String(d.id), String(d.description || '').trim()]));

    for (const t of targets) {
      const next = byId.get(t.id);
      if (!next || next.length < DESC_MIN_CHARS) {
        counters.skipped++;
        continue;
      }
      // Restaurant guard: only accept if it now contains a recommendation verb
      if (t.isRestaurant && !RESTAURANT_RECOMMENDATION_RE.test(next)) {
        counters.skipped++;
        continue;
      }
      const act = activities[t.index];
      if (!act) { counters.skipped++; continue; }
      act.description = next;
      counters.filled++;
    }

    console.log(`[DESC_FILL] day=${dayNumber} flagged=${counters.flagged} filled=${counters.filled} skipped=${counters.skipped}`);
  } catch (err) {
    counters.errored = true;
    const msg = err instanceof Error ? err.message : String(err);
    console.warn(`[DESC_FILL] day=${dayNumber} failed: ${msg}`);
  } finally {
    clearTimeout(timer);
  }

  return counters;
}

// Re-export FAILURE_CODES key for callers
export const DESCRIPTION_FILL_CODES = [
  FAILURE_CODES.MISSING_DESCRIPTION,
  FAILURE_CODES.GENERIC_DESCRIPTION,
  FAILURE_CODES.RESTAURANT_MISSING_RECOMMENDATION,
] as const;
