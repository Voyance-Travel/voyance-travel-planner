// Slot Filler LLM — Phase 4 of the schema-driven pipeline.
//
// Takes a populated SkeletonDay (from buildEmptyDaySkeleton + Phase 3 planner
// assignments) and asks the LLM to ONLY name venues for empty slots.
//
// HARD CONTRACT:
//   - The model receives the FIXED list of empty slots with their fixed time
//     windows and per-slot aiInstruction.
//   - The model returns ONLY { fills: { slotId, name, description, ... }[] }.
//   - The model CANNOT return times, categories, or cost — the Zod schema
//     literally has no such fields. Anything time-shaped that arrives is
//     ignored at parse time.
//   - Unrecognized slotIds are dropped at merge time.
//
// Same fetch-based call pattern as `trip-planner-llm.ts` to stay aligned with
// the existing codebase convention (AI SDK migration is Phase 6).

import { z } from 'npm:zod@3.23.8';
import type {
  SkeletonDay,
  SkeletonSlot,
} from './schema-generation.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Schemas — strict, additionalProperties forbidden via .strict()
// ─────────────────────────────────────────────────────────────────────────────

export const SlotFillSchema = z
  .object({
    slotId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    venueAddress: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
    durationMin: z.number().int().positive().max(600).nullable().optional(),
  })
  .strict();

export const SlotFillerResponseSchema = z
  .object({
    fills: z.array(SlotFillSchema).default([]),
  })
  .strict();

export type SlotFill = z.infer<typeof SlotFillSchema>;
export type SlotFillerResponse = z.infer<typeof SlotFillerResponseSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotFillerInput {
  skeleton: SkeletonDay;
  /** Trip-level context that helps the model pick on-brand venues. */
  archetype?: string | null;
  budgetTier?: string | null;
  /** Optional: titles of must-dos referenced by mustDoRef so the model knows what to schedule. */
  mustDoTitlesById?: Record<string, string>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Packet builder — pure, exported for tests
// ─────────────────────────────────────────────────────────────────────────────

export interface SlotPacket {
  slotId: string;
  slotType: string;
  required: boolean;
  mealType?: string;
  timeWindow: { earliest: string; latest: string; durationMinMax: [number, number] } | null;
  aiInstruction: string;
  mustDoTitle?: string;
}

export function buildSlotPackets(input: SlotFillerInput): SlotPacket[] {
  const titles = input.mustDoTitlesById ?? {};
  return input.skeleton.slots
    .filter((s) => s.status === 'empty')
    .map((s) => {
      const tw = s.timeWindow
        ? {
            earliest: s.timeWindow.earliest,
            latest: s.timeWindow.latest,
            durationMinMax: [s.timeWindow.duration.min, s.timeWindow.duration.max] as [number, number],
          }
        : null;
      const mustDoTitle = s.mustDoRef ? titles[s.mustDoRef] : undefined;
      const inst = s.aiInstruction ?? `Pick a believable ${s.slotType} in ${input.skeleton.destination}.`;
      return {
        slotId: s.slotId,
        slotType: s.slotType,
        required: s.required,
        mealType: s.mealType,
        timeWindow: tw,
        aiInstruction: mustDoTitle ? `${inst} (Must-do: "${mustDoTitle}")` : inst,
        mustDoTitle,
      };
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(input: SlotFillerInput, packets: SlotPacket[]): string {
  const slotLines = packets
    .map((p) => {
      const tw = p.timeWindow
        ? `${p.timeWindow.earliest}–${p.timeWindow.latest} (${p.timeWindow.durationMinMax[0]}–${p.timeWindow.durationMinMax[1]} min)`
        : 'flex';
      return `  - slotId="${p.slotId}" type=${p.slotType}${p.mealType ? ` meal=${p.mealType}` : ''} window=${tw}${p.required ? ' REQUIRED' : ''}\n    instruction: ${p.aiInstruction}`;
    })
    .join('\n');

  const dest = input.skeleton.destination;
  return `You are the SLOT FILLER for Day ${input.skeleton.dayNumber} of a trip to ${dest}.
Archetype: ${input.archetype ?? 'unspecified'} | Pattern: ${input.skeleton.patternGroup} | Budget: ${input.budgetTier ?? 'unspecified'}

Your ONLY job: for each empty slot below, return a real, named venue or experience that fits the slot's instruction and time window. You may NOT change times, you may NOT add slots, you may NOT skip required slots, you may NOT return categories or costs.

EMPTY SLOTS TO FILL:
${slotLines || '  (none)'}

Return ONLY valid JSON of this exact shape — no markdown, no commentary:
{
  "fills": [
    {
      "slotId": "<exact slotId from above>",
      "name": "real venue or experience name",
      "description": "one or two sentences describing what the traveler will actually do here",
      "venueAddress": "street address in ${dest} (optional, null if unknown)",
      "neighborhood": "neighborhood name (optional)",
      "durationMin": <integer minutes within the window's min..max (optional)>
    }
  ]
}

Rules:
- Use the exact slotId strings from the list above. Do not invent slotIds.
- Every REQUIRED slot must appear in fills. Optional slots SHOULD appear too.
- Venue must exist in ${dest}. No "TBD", no "find a spot", no chain placeholders.
- If a slot has a Must-do title, your fill MUST be that exact venue.`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM call
// ─────────────────────────────────────────────────────────────────────────────

export interface FillerCallResult {
  ok: boolean;
  response?: SlotFillerResponse;
  /** Slots that were sent as packets but have no fill in the validated response. */
  unfilledSlotIds: string[];
  error?: string;
  rawText?: string;
  durationMs: number;
  attempts: number;
}

const GATEWAY_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';
const FILLER_MODEL = 'google/gemini-3-flash-preview';
const FILLER_TIMEOUT_MS = 12_000;

/** Internal fetcher type so tests can inject a stub. */
type FetchFn = typeof fetch;

export interface FillerCallOptions {
  apiKey?: string;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Test seam: override fetch (default: globalThis.fetch). */
  fetchImpl?: FetchFn;
  /** Test seam: override model. */
  model?: string;
}

export async function fillDaySkeleton(
  input: SlotFillerInput,
  opts: FillerCallOptions = {},
): Promise<FillerCallResult> {
  const t0 = Date.now();
  const packets = buildSlotPackets(input);

  // Fast skip: no empty slots → nothing to fill.
  if (packets.length === 0) {
    return {
      ok: true,
      response: { fills: [] },
      unfilledSlotIds: [],
      durationMs: Date.now() - t0,
      attempts: 0,
    };
  }

  const apiKey = opts.apiKey ?? Deno.env.get('LOVABLE_API_KEY') ?? '';
  if (!apiKey) {
    return {
      ok: false,
      unfilledSlotIds: packets.map((p) => p.slotId),
      error: 'LOVABLE_API_KEY missing',
      durationMs: Date.now() - t0,
      attempts: 0,
    };
  }

  const prompt = buildPrompt(input, packets);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const model = opts.model ?? FILLER_MODEL;
  const timeoutMs = opts.timeoutMs ?? FILLER_TIMEOUT_MS;

  let lastError = '';
  let lastRaw = '';
  // Single retry on parse failure (plan's "single retry on parse failure").
  for (let attempt = 1; attempt <= 2; attempt++) {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), timeoutMs);
    const signal = opts.signal
      ? AbortSignal.any([opts.signal, ctrl.signal])
      : ctrl.signal;

    let raw = '';
    try {
      const resp = await fetchImpl(GATEWAY_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        signal,
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are a slot-filling assistant. You receive a list of empty schedule slots and you ONLY return venue names that fit each slot. You never invent slotIds, never return times, never return categories or costs. Output strict JSON only.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 2500,
        }),
      });
      if (!resp.ok) {
        lastError = `filler HTTP ${resp.status}`;
        continue;
      }
      const data = await resp.json();
      raw = String(data?.choices?.[0]?.message?.content ?? '');
      lastRaw = raw;
    } catch (err) {
      lastError = `filler fetch failed: ${(err as Error).message}`;
      continue;
    } finally {
      clearTimeout(timeout);
    }

    const stripped = raw
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch (err) {
      lastError = `filler JSON parse failed: ${(err as Error).message}`;
      continue;
    }

    const validated = SlotFillerResponseSchema.safeParse(parsed);
    if (!validated.success) {
      lastError = `filler schema validation failed: ${validated.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`;
      continue;
    }

    // Drop fills whose slotId isn't in the packet set.
    const allowed = new Set(packets.map((p) => p.slotId));
    const cleanFills = validated.data.fills.filter((f) => allowed.has(f.slotId));
    // Deduplicate by slotId (last one wins) so a confused model can't double-fill.
    const dedup = new Map<string, SlotFill>();
    for (const f of cleanFills) dedup.set(f.slotId, f);
    const final = Array.from(dedup.values());

    const filledIds = new Set(final.map((f) => f.slotId));
    const unfilledSlotIds = packets.map((p) => p.slotId).filter((id) => !filledIds.has(id));

    return {
      ok: true,
      response: { fills: final },
      unfilledSlotIds,
      durationMs: Date.now() - t0,
      attempts: attempt,
      rawText: raw,
    };
  }

  return {
    ok: false,
    unfilledSlotIds: packets.map((p) => p.slotId),
    error: lastError || 'filler failed',
    rawText: lastRaw,
    durationMs: Date.now() - t0,
    attempts: 2,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Merge — pure helper that copies fills back into the skeleton (filled state)
// ─────────────────────────────────────────────────────────────────────────────

export function mergeFillsIntoSkeleton(
  skeleton: SkeletonDay,
  fills: SlotFill[],
): SkeletonDay {
  const byId = new Map(fills.map((f) => [f.slotId, f]));
  const newSlots: SkeletonSlot[] = skeleton.slots.map((s) => {
    const fill = byId.get(s.slotId);
    if (!fill || s.status === 'filled') return s;
    const window = s.timeWindow;
    const dur = fill.durationMin
      ? Math.max(window?.duration.min ?? fill.durationMin, Math.min(window?.duration.max ?? fill.durationMin, fill.durationMin))
      : window?.duration.min ?? 60;
    const startTime = window?.earliest ?? '00:00';
    const [hh, mm] = startTime.split(':').map(Number);
    const endMin = hh * 60 + mm + dur;
    const endTime = `${String(Math.floor(endMin / 60) % 24).padStart(2, '0')}:${String(endMin % 60).padStart(2, '0')}`;
    return {
      ...s,
      status: 'filled',
      filledData: {
        title: fill.name,
        category: slotTypeToCategory(s.slotType, s.mealType),
        startTime,
        endTime,
        location: fill.venueAddress ?? fill.neighborhood ?? undefined,
        notes: fill.description,
        source: s.mustDoRef ? 'must_do' : 'system',
      },
    };
  });
  return { ...skeleton, slots: newSlots };
}

function slotTypeToCategory(slotType: string, mealType?: string): string {
  if (slotType === 'meal' && mealType) return mealType;
  switch (slotType) {
    case 'evening':
      return 'evening';
    case 'must_do':
      return 'activity';
    case 'transport':
      return 'transit';
    case 'arrival':
    case 'departure':
      return 'transport';
    case 'hotel_checkin':
    case 'hotel_checkout':
      return 'accommodation';
    case 'unscheduled':
      return 'free_time';
    default:
      return slotType;
  }
}

export { buildPrompt as __buildFillerPrompt };
