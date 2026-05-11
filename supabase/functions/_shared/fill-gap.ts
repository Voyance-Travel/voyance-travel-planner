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
  /** Bug 4: soft category preference (e.g. 'dining' for evening gaps). */
  preferCategory?: 'dining' | 'culture' | 'activity';
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
    preferCategory,
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
${preferCategory ? `\nPREFERRED CATEGORY: ${preferCategory} — pick a real ${preferCategory} venue if a believable option exists; otherwise return another category that fits the WINDOW.\n` : ''}

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

  // Two attempts: first creative, second tighter "must pick something" prompt.
  const attempts: Array<{ temperature: number; suffix: string }> = [
    { temperature: 0.85, suffix: '' },
    {
      temperature: 0.6,
      suffix:
        '\n\nIMPORTANT: Do NOT return {"fallback": true}. Even if uncertain, pick the closest well-known landmark, café, gelateria, gallery, or shop you know in this neighborhood. A real but mediocre choice beats an empty slot.',
    },
  ];

  let parsed: any = null;
  for (const attempt of attempts) {
    let aiResponse: Response;
    try {
      aiResponse = await fetch(LOVABLE_GATEWAY, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: systemPrompt + attempt.suffix },
            { role: 'user', content: 'Suggest one activity for the unplanned window.' },
          ],
          temperature: attempt.temperature,
          max_tokens: 400,
        }),
      });
    } catch (e) {
      console.error('[fill-gap] AI gateway fetch failed (attempt):', e);
      continue;
    }

    if (!aiResponse.ok) {
      const txt = await aiResponse.text().catch(() => '');
      console.warn('[fill-gap] AI gateway non-OK:', aiResponse.status, txt.slice(0, 200));
      continue;
    }

    const aiData = await aiResponse.json();
    const content: string = aiData?.choices?.[0]?.message?.content || '';
    let candidate: any = null;
    try {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) candidate = JSON.parse(m[0]);
    } catch (e) {
      console.warn('[fill-gap] parse failed:', e);
      continue;
    }
    if (!candidate || candidate.fallback) continue;

    // Generic-name guard
    const genericRe = /^(local|café|cafe|bistro|restaurant|bar|spa|museum|gallery|park|free time|afternoon|morning|evening|leisure|relax|explore)( |$)/i;
    if (!candidate.title || genericRe.test(String(candidate.title).trim())) continue;

    // Dedup against existing + avoid list (substring overlap)
    const tLower = String(candidate.title).toLowerCase();
    const dup = [...existingTitles, ...avoidIds].some(t => {
      const tl = String(t).toLowerCase();
      return tl === tLower
        || (tl.length > 4 && tLower.includes(tl))
        || (tLower.length > 4 && tl.includes(tLower));
    });
    if (dup) continue;

    parsed = candidate;
    break;
  }

  // Curated fallback when both AI attempts failed
  if (!parsed) {
    console.warn(`[fill-gap] AI exhausted both attempts for ${destination} (${gapStartTime}-${gapEndTime}); trying curated fallback`);
    return await curatedFallback({
      destination, startMin, endMin, existingTitles, avoidIds,
      tripCurrency, opts,
    });
  }

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

// ─────────────────────────────────────────────────────────────────────────────
// Curated fallback: query verified_venues for the destination as last resort.
// Returns a real, named activity so we never leave a 3h+ hole in the day.
// ─────────────────────────────────────────────────────────────────────────────
interface CuratedFallbackArgs {
  destination: string;
  startMin: number;
  endMin: number;
  existingTitles: string[];
  avoidIds: string[];
  tripCurrency: string;
  opts: { source?: string };
}

async function curatedFallback(args: CuratedFallbackArgs): Promise<FilledActivity | null> {
  const { destination, startMin, endMin, existingTitles, avoidIds, tripCurrency, opts } = args;
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[fill-gap] curated fallback unavailable: no service-role env');
    return null;
  }

  try {
    const { createClient } = await import('npm:@supabase/supabase-js@2.90.1');
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const destNorm = destination.split(',')[0].trim();
    const { data, error } = await supabase
      .from('verified_venues')
      .select('name, address, category, rating')
      .ilike('destination', `%${destNorm}%`)
      .in('category', ['museum', 'culture', 'gallery', 'shopping', 'cafe', 'café', 'activity', 'sightseeing', 'attraction'])
      .order('rating', { ascending: false, nullsFirst: false })
      .limit(20);

    if (error || !data?.length) {
      console.warn('[fill-gap] curated fallback: no verified_venues match for', destNorm, error?.message);
      return null;
    }

    const avoidLower = new Set(
      [...existingTitles, ...avoidIds].map(t => String(t).toLowerCase())
    );
    const pick = (data as any[]).find((v) => {
      const nLower = String(v.name || '').toLowerCase();
      if (!nLower) return false;
      for (const a of avoidLower) {
        if (a === nLower) return false;
        if (a.length > 4 && nLower.includes(a)) return false;
        if (nLower.length > 4 && a.includes(nLower)) return false;
      }
      return true;
    });

    if (!pick) {
      console.warn('[fill-gap] curated fallback: all verified venues already used');
      return null;
    }

    const dur = Math.min(90, endMin - startMin);
    return {
      id: `gap-fill-curated-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: pick.name,
      description: `Visit ${pick.name} during your free afternoon window.`,
      category: pick.category || 'activity',
      startTime: minutesToTime(startMin),
      endTime: minutesToTime(startMin + dur),
      location: { name: pick.name, address: pick.address || '' },
      cost: { amount: 0, currency: tripCurrency },
      rationale: 'Curated fallback from verified venues.',
      isLocked: false,
      source: opts.source ? `${opts.source}_curated` : 'fill_dead_gap_curated',
    };
  } catch (e) {
    console.error('[fill-gap] curated fallback threw:', e);
    return null;
  }
}

