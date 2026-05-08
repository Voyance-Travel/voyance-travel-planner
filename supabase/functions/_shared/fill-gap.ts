/**
 * Shared "fill dead gap" helper.
 *
 * Given an unplanned window between two activities, asks the AI gateway for a
 * single real, named venue/activity to slot in. Returns null on any failure
 * (caller decides whether to retry or fall back). Used by:
 *   - refresh-day (on-demand "Fill the gap" UI button)
 *   - generate-itinerary repair pass (auto-fill at generation time)
 *
 * Hard rules enforced inside:
 *   - Real venue names only (generic-name guard rejects "Local Café" etc).
 *   - Activity must fully fit inside [startMin+15, endMin-15] with ≥45 min duration.
 *   - No duplication against existing day or avoid list.
 */

const LOVABLE_GATEWAY = 'https://ai.gateway.lovable.dev/v1/chat/completions';

function parseTime(t: string | undefined): number | null {
  if (!t) return null;
  const m = String(t).match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

function minutesToTime(m: number): string {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export interface FillGapInput {
  activities: Array<{ id?: string; title?: string; startTime?: string; endTime?: string }>;
  destination: string;
  /** HH:MM — end of the activity that comes BEFORE the gap */
  gapStartTime: string;
  /** HH:MM — start of the activity that comes AFTER the gap */
  gapEndTime: string;
  beforeId?: string;
  afterId?: string;
  archetype?: string;
  dietaryRestrictions?: string[];
  budgetTier?: string;
  tripCurrency?: string;
  avoidIds?: string[];
}

export interface FilledActivity {
  id: string;
  title: string;
  description: string;
  category: string;
  startTime: string;
  endTime: string;
  location: { name: string; address: string };
  cost: { amount: number; currency: string };
  rationale: string;
  isLocked: false;
  source: string;
}

/**
 * Returns a proposed activity to insert into the gap, or null if no real
 * suggestion could be obtained (caller should fall back).
 */
export async function proposeGapFiller(
  input: FillGapInput,
  opts: { source?: string } = {},
): Promise<FilledActivity | null> {
  const {
    activities, destination, gapStartTime, gapEndTime,
    beforeId, afterId, archetype,
    dietaryRestrictions = [], budgetTier = 'standard', tripCurrency = 'USD',
    avoidIds = [],
  } = input;

  const apiKey = Deno.env.get('LOVABLE_API_KEY');

  const startMin = (parseTime(gapStartTime) ?? 0) + 15;
  const endMin = (parseTime(gapEndTime) ?? 0) - 15;
  if (endMin - startMin < 45) return null;

  const beforeAct = activities.find(a => a.id === beforeId);
  const afterAct = activities.find(a => a.id === afterId);

  const existingTitles = activities.map(a => a.title).filter(Boolean) as string[];
  const avoidList = [...existingTitles, ...avoidIds].join(', ');
  const dietary = dietaryRestrictions.length ? dietaryRestrictions.join(', ') : 'none';

  // If no AI key, jump straight to curated fallback
  if (!apiKey) {
    return await curatedFallback({
      destination, startMin, endMin, existingTitles, avoidIds,
      tripCurrency, opts,
    });
  }

  const systemPrompt = `You are a local concierge in ${destination} suggesting ONE real activity to fill an unplanned window in a traveler's day.

WINDOW: ${minutesToTime(startMin)}–${minutesToTime(endMin)} (${endMin - startMin} minutes available, including 15-min buffers).
NEIGHBORHOOD CONTEXT: previous activity = ${beforeAct?.title || 'none'} (ends ${gapStartTime}), next activity = ${afterAct?.title || 'none'} (starts ${gapEndTime}).
TRAVELER STYLE: ${archetype || 'flexible_wanderer'}.
BUDGET TIER: ${budgetTier}.
DIETARY RESTRICTIONS: ${dietary}.

HARD RULES:
- Use a REAL named venue/landmark in ${destination} (no generic stubs like "Local Café").
- Activity must fit fully inside ${minutesToTime(startMin)}–${minutesToTime(endMin)} with at least 45 minutes duration.
- Do NOT duplicate any of these: ${avoidList || '(none)'}.
- Be geographically sensible — close to the previous activity if possible.
- If you cannot find a real venue, return { "fallback": true } and nothing else.

OUTPUT (JSON only, no markdown):
{
  "title": "Real venue name",
  "description": "1-2 sentence pitch (max 160 chars).",
  "category": "activity|dining|explore|wellness|culture|shopping",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "venueName": "Real venue name",
  "address": "Street address or neighborhood",
  "rationale": "One short sentence (max 100 chars)."
}`;

  let aiResponse: Response;
  try {
    aiResponse = await fetch(LOVABLE_GATEWAY, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Suggest one activity for the unplanned window.' },
        ],
        temperature: 0.85,
        max_tokens: 400,
      }),
    });
  } catch (e) {
    console.error('[fill-gap] AI gateway fetch failed:', e);
    return null;
  }

  if (!aiResponse.ok) {
    const txt = await aiResponse.text().catch(() => '');
    console.warn('[fill-gap] AI gateway non-OK:', aiResponse.status, txt.slice(0, 200));
    return null;
  }

  const aiData = await aiResponse.json();
  const content: string = aiData?.choices?.[0]?.message?.content || '';
  let parsed: any = null;
  try {
    const m = content.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) {
    console.warn('[fill-gap] parse failed:', e);
  }
  if (!parsed || parsed.fallback) return null;

  // Snap to window if AI returned out-of-window times
  const sMin = parseTime(parsed.startTime);
  const eMin = parseTime(parsed.endTime);
  if (sMin === null || eMin === null || sMin < startMin || eMin > endMin || eMin - sMin < 45) {
    const dur = Math.min(
      Math.max(60, (sMin !== null && eMin !== null) ? eMin - sMin : 90),
      endMin - startMin,
    );
    parsed.startTime = minutesToTime(startMin);
    parsed.endTime = minutesToTime(startMin + dur);
  }

  // Generic-name guard
  const genericRe = /^(local|café|cafe|bistro|restaurant|bar|spa|museum|gallery|park|free time|afternoon|morning|evening|leisure|relax|explore)( |$)/i;
  if (!parsed.title || genericRe.test(String(parsed.title).trim())) return null;

  // Dedup against existing + avoid list (substring overlap)
  const titleLower = String(parsed.title).toLowerCase();
  const dup = [...existingTitles, ...avoidIds].some(t => {
    const tl = String(t).toLowerCase();
    return tl === titleLower
      || (tl.length > 4 && titleLower.includes(tl))
      || (titleLower.length > 4 && tl.includes(titleLower));
  });
  if (dup) return null;

  return {
    id: `gap-fill-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: parsed.title,
    description: parsed.description || '',
    category: parsed.category || 'activity',
    startTime: parsed.startTime,
    endTime: parsed.endTime,
    location: { name: parsed.venueName || parsed.title, address: parsed.address || '' },
    cost: { amount: 0, currency: tripCurrency },
    rationale: parsed.rationale || '',
    isLocked: false,
    source: opts.source || 'fill_dead_gap',
  };
}
