// Refill Slots LLM — Phase 5/6 companion to the Slot Filler.
//
// Takes the `needsRefill[]` list produced by `cleanupDay` (one entry per slot
// the cleanup pass dropped) and asks the LLM to ONLY name a replacement venue
// for those specific slots. Same strict slot-fill Zod contract as
// `slot-filler-llm.ts`: no times, no categories, no costs — the model literally
// cannot return them.
//
// Bounded: single attempt, 8s timeout, leaves slots empty on failure. The
// caller decides what to do with unfilled slots (typically display as
// "free time" — safer than a hallucination).

import { z } from 'npm:zod@3.25.76';
import type { NeedsRefillEntry } from './itinerary-cleanup.ts';

export const RefillSchema = z
  .object({
    slotId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    venueAddress: z.string().nullable().optional(),
    neighborhood: z.string().nullable().optional(),
  })
  .strict();

export const RefillResponseSchema = z
  .object({
    fills: z.array(RefillSchema).default([]),
  })
  .strict();

export type Refill = z.infer<typeof RefillSchema>;
export type RefillResponse = z.infer<typeof RefillResponseSchema>;

export interface RefillInput {
  destination: string;
  archetype?: string | null;
  budgetTier?: string | null;
  needsRefill: NeedsRefillEntry[];
  /** Neighbour venue names — helps the model pick something close to the prev/next anchor. */
  contextVenues?: { before?: string; after?: string };
  /** Venues we've already used elsewhere in the trip — don't suggest them again. */
  usedVenues?: string[];
}

export interface RefillCallOptions {
  lovableApiKey?: string;
  model?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

export interface RefillResult {
  ok: boolean;
  response?: RefillResponse;
  unfilledSlotIds: string[];
  durationMs: number;
  attempts: number;
  error?: string;
  rawText?: string;
}

const GATEWAY_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3-flash-preview';

export function buildRefillPrompt(input: RefillInput): string {
  const lines: string[] = [];
  lines.push(`You are refilling specific dropped slots for a ${input.destination} day-plan.`);
  if (input.archetype) lines.push(`Traveler archetype: ${input.archetype}.`);
  if (input.budgetTier) lines.push(`Budget tier: ${input.budgetTier}.`);
  if (input.contextVenues?.before) lines.push(`The previous activity is at: ${input.contextVenues.before}.`);
  if (input.contextVenues?.after) lines.push(`The next activity is at: ${input.contextVenues.after}.`);
  if (input.usedVenues?.length) {
    lines.push(`DO NOT suggest these venues (already used): ${input.usedVenues.slice(0, 20).join(', ')}.`);
  }
  lines.push('');
  lines.push('For EACH slot below, return one real venue name + a one-sentence description.');
  lines.push('Pick venues within a 15-minute walk of the previous/next activity when possible.');
  lines.push('NEVER return times, categories, or prices — only name, description, venueAddress, neighborhood.');
  lines.push('');
  lines.push('SLOTS TO REFILL:');
  lines.push(JSON.stringify(input.needsRefill, null, 2));
  lines.push('');
  lines.push('Respond with strict JSON: { "fills": [ { "slotId": "...", "name": "...", "description": "...", "venueAddress": "...", "neighborhood": "..." } ] }');
  return lines.join('\n');
}

export async function refillDroppedSlots(
  input: RefillInput,
  opts: RefillCallOptions = {},
): Promise<RefillResult> {
  const t0 = Date.now();
  if (input.needsRefill.length === 0) {
    return { ok: true, response: { fills: [] }, unfilledSlotIds: [], durationMs: 0, attempts: 0 };
  }

  const apiKey = opts.lovableApiKey ?? Deno.env.get('OPENROUTER_API_KEY') ?? '';
  if (!apiKey) {
    return {
      ok: false,
      unfilledSlotIds: input.needsRefill.map((r) => r.slotId),
      error: 'missing OPENROUTER_API_KEY',
      durationMs: Date.now() - t0,
      attempts: 0,
    };
  }

  const model = opts.model ?? DEFAULT_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 8000;
  const prompt = buildRefillPrompt(input);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let raw = '';
  try {
    const resp = await fetchImpl(GATEWAY_URL, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You replace dropped venues for specific slot IDs. You never invent slotIds and never return times, categories, or prices. Output strict JSON only.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 1200,
      }),
    });
    if (!resp.ok) {
      return {
        ok: false,
        unfilledSlotIds: input.needsRefill.map((r) => r.slotId),
        error: `refill HTTP ${resp.status}`,
        durationMs: Date.now() - t0,
        attempts: 1,
      };
    }
    const data = await resp.json();
    raw = String(data?.choices?.[0]?.message?.content ?? '');
  } catch (err) {
    return {
      ok: false,
      unfilledSlotIds: input.needsRefill.map((r) => r.slotId),
      error: `refill fetch failed: ${(err as Error).message}`,
      durationMs: Date.now() - t0,
      attempts: 1,
      rawText: raw,
    };
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
    return {
      ok: false,
      unfilledSlotIds: input.needsRefill.map((r) => r.slotId),
      error: `refill JSON parse failed: ${(err as Error).message}`,
      durationMs: Date.now() - t0,
      attempts: 1,
      rawText: raw,
    };
  }

  const validated = RefillResponseSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      unfilledSlotIds: input.needsRefill.map((r) => r.slotId),
      error: `refill schema validation failed: ${validated.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
      durationMs: Date.now() - t0,
      attempts: 1,
      rawText: raw,
    };
  }

  const allowed = new Set(input.needsRefill.map((r) => r.slotId));
  const cleanFills = validated.data.fills.filter((f) => allowed.has(f.slotId));
  const dedup = new Map<string, Refill>();
  for (const f of cleanFills) dedup.set(f.slotId, f);
  const final = Array.from(dedup.values());

  const filledIds = new Set(final.map((f) => f.slotId));
  const unfilledSlotIds = input.needsRefill.map((r) => r.slotId).filter((id) => !filledIds.has(id));

  return {
    ok: true,
    response: { fills: final },
    unfilledSlotIds,
    durationMs: Date.now() - t0,
    attempts: 1,
    rawText: raw,
  };
}
