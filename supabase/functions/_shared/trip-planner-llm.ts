// Trip Planner LLM — Phase 3 of the schema-driven pipeline.
//
// Runs ONCE per trip, BEFORE the per-day chain starts.
//
// Input: the per-day SkeletonDay[] (already populated with arrival/departure
//   pins, meal slots, and pre-allocated must-do slots) plus must-do metadata
//   and trip-wide context.
// Output (Zod-validated):
//   - dayAssignments: which neighborhood + which must-dos belong on which day
//   - omitted: must-dos the Planner believes cannot fit, with a reason
//
// The result is stored on `trips.metadata.trip_plan` and surfaced to the UI
// (OmittedMustDosBanner) BEFORE generation completes so the user can decide
// to swap, drop, or accept.
//
// PHASE 3 GUARANTEES:
// - Strictly additive. Failures are logged and swallowed.
// - The legacy per-day prompt path is unchanged.
// - Phase 4 (slot-fill) will consume `trip_plan.dayAssignments` to constrain
//   the Filler LLM. Until then, the assignments are observable data only.

import { z } from 'npm:zod@3.25.76';
import type { SkeletonDay, OmittedMustDo } from './schema-generation.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Schemas (single source of truth for parse + downstream consumers)
// ─────────────────────────────────────────────────────────────────────────────

export const PlannerSlotAssignmentSchema = z.object({
  slotId: z.string().min(1),
  mustDoRef: z.string().min(1),
});

export const PlannerDayAssignmentSchema = z.object({
  dayNumber: z.number().int().positive(),
  neighborhood: z.string().nullable().optional(),
  rationale: z.string().nullable().optional(),
  mustDoSlots: z.array(PlannerSlotAssignmentSchema).default([]),
});

export const PlannerOmittedSchema = z.object({
  mustDoTitle: z.string().min(1),
  reason: z.enum([
    'not_enough_time',
    'wrong_day_type',
    'no_compatible_slot',
    'duplicate',
    'low_priority_after_anchors',
    'other',
  ]),
  detail: z.string().nullable().optional(),
  suggestion: z.string().nullable().optional(),
});

export const TripPlanSchema = z.object({
  dayAssignments: z.array(PlannerDayAssignmentSchema).default([]),
  omitted: z.array(PlannerOmittedSchema).default([]),
});

export type PlannerSlotAssignment = z.infer<typeof PlannerSlotAssignmentSchema>;
export type PlannerDayAssignment = z.infer<typeof PlannerDayAssignmentSchema>;
export type PlannerOmitted = z.infer<typeof PlannerOmittedSchema>;
export type TripPlan = z.infer<typeof TripPlanSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Inputs
// ─────────────────────────────────────────────────────────────────────────────

export interface TripPlannerInput {
  destination: string;
  totalDays: number;
  archetype?: string | null;
  patternGroup?: string | null;
  budgetTier?: string | null;
  /** Per-day skeletons produced by buildEmptyDaySkeleton. */
  skeletons: SkeletonDay[];
  /** User-specified must-dos (id, title, optional category/priority/fixedDay). */
  mustDos: Array<{
    id: string;
    title: string;
    category?: string | null;
    priority?: number | null;
    fixedDayNumber?: number | null;
  }>;
  /** Already-locked anchors (e.g. hotel, flight, manual cards) the planner
   * must respect. Free-form strings — the model only needs to know they exist. */
  anchorSummaries?: string[];
  /** Optional pre-merged omitted list from deterministic skeleton allocation
   * (e.g. must-do had no compatible slot type on any day). */
  preOmitted?: OmittedMustDo[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Prompt
// ─────────────────────────────────────────────────────────────────────────────

function buildPrompt(input: TripPlannerInput): string {
  const skeletonSummary = input.skeletons
    .map((d) => {
      const slots = d.slots
        .map((s) => {
          const tw = s.timeWindow
            ? `${s.timeWindow.earliest}–${s.timeWindow.latest}`
            : 'flex';
          const filled = s.filledData ? ` [PINNED: ${s.filledData.title}]` : '';
          const md = s.mustDoRef ? ` [mustDoRef=${s.mustDoRef}]` : '';
          return `    - ${s.slotId} (${s.slotType}, ${tw}${
            s.required ? ', REQUIRED' : ''
          })${filled}${md}`;
        })
        .join('\n');
      return `Day ${d.dayNumber} (${d.dayType}, ${d.constraints.dayStartTime}–${d.constraints.dayEndTime}):\n${slots}`;
    })
    .join('\n\n');

  const mustDoList = input.mustDos
    .map(
      (m, i) =>
        `  ${i + 1}. id=${m.id} | "${m.title}"${
          m.category ? ` (${m.category})` : ''
        }${m.fixedDayNumber ? ` [fixed day ${m.fixedDayNumber}]` : ''}${
          m.priority != null ? ` [priority=${m.priority}]` : ''
        }`,
    )
    .join('\n');

  const anchorBlock = input.anchorSummaries?.length
    ? `\n\nLOCKED ANCHORS (do NOT move or override):\n${input.anchorSummaries
        .map((a) => `  - ${a}`)
        .join('\n')}`
    : '';

  const preOmittedBlock = input.preOmitted?.length
    ? `\n\nALREADY OMITTED BY DETERMINISTIC ALLOCATOR (echo into omitted with the same reason):\n${input.preOmitted
        .map((o) => `  - "${o.title}" (${o.reason})`)
        .join('\n')}`
    : '';

  return `You are the TRIP PLANNER — a deterministic intelligence layer that decides which user-requested must-dos fit which day of a ${input.totalDays}-day trip to ${input.destination}, BEFORE per-day generation begins.

Traveler context:
  - Archetype: ${input.archetype || 'unspecified'}
  - Pattern group: ${input.patternGroup || 'unspecified'}
  - Budget tier: ${input.budgetTier || 'unspecified'}

EMPTY DAY SKELETONS (slot IDs are immutable — reference them exactly):
${skeletonSummary}

USER MUST-DOS (id is immutable — reference exactly):
${mustDoList || '  (none)'}${anchorBlock}${preOmittedBlock}

YOUR JOB:
1. For each must-do, decide the best day + best slot it belongs in. Honour fixedDayNumber when present.
2. Prefer geographic clustering (same neighborhood per day).
3. If a must-do CANNOT fit (no compatible slot, day type mismatch like all-day-event on a half-day arrival, or simply not enough time across the trip), put it in "omitted" with a clear reason and a one-sentence suggestion.
4. Do NOT invent new must-dos. Do NOT rename them. Do NOT change times.
5. Per-day neighborhood is a short label like "Trastevere" or "Centro Storico"; null if you can't choose one.

Return ONLY valid JSON matching this exact shape — no markdown, no commentary:
{
  "dayAssignments": [
    { "dayNumber": 1, "neighborhood": "string|null", "rationale": "string|null",
      "mustDoSlots": [{ "slotId": "from skeleton", "mustDoRef": "from must-do id" }] }
  ],
  "omitted": [
    { "mustDoTitle": "string", "reason": "not_enough_time|wrong_day_type|no_compatible_slot|duplicate|low_priority_after_anchors|other",
      "detail": "string|null", "suggestion": "string|null" }
  ]
}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// LLM call
// ─────────────────────────────────────────────────────────────────────────────

export interface PlannerCallResult {
  ok: boolean;
  plan?: TripPlan;
  error?: string;
  rawText?: string;
}

const GATEWAY_URL = 'https://openrouter.ai/api/v1/chat/completions';
const PLANNER_MODEL = 'google/gemini-2.5-flash';
const PLANNER_TIMEOUT_MS = 25_000;

export async function callTripPlannerLLM(
  input: TripPlannerInput,
  opts: { apiKey?: string; signal?: AbortSignal } = {},
): Promise<PlannerCallResult> {
  // Fast skip: no must-dos AND no preOmitted → empty plan, no LLM call needed.
  if ((!input.mustDos || input.mustDos.length === 0) && !input.preOmitted?.length) {
    return { ok: true, plan: { dayAssignments: [], omitted: [] } };
  }

  const apiKey = opts.apiKey ?? Deno.env.get('OPENROUTER_API_KEY') ?? '';
  if (!apiKey) {
    return { ok: false, error: 'OPENROUTER_API_KEY missing' };
  }

  const prompt = buildPrompt(input);
  const ctrl = new AbortController();
  const timeout = setTimeout(() => ctrl.abort(), PLANNER_TIMEOUT_MS);
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, ctrl.signal])
    : ctrl.signal;

  let raw = '';
  try {
    const resp = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        'Lovable-API-Key': apiKey,
        'Content-Type': 'application/json',
      },
      signal,
      body: JSON.stringify({
        model: PLANNER_MODEL,
        messages: [
          {
            role: 'system',
            content:
              'You are a deterministic trip-planning intelligence layer. Return ONLY valid JSON matching the schema given by the user. No markdown fences, no commentary.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 3500,
      }),
    });
    if (!resp.ok) {
      return { ok: false, error: `planner HTTP ${resp.status}` };
    }
    const data = await resp.json();
    raw = String(data?.choices?.[0]?.message?.content ?? '');
  } catch (err) {
    return { ok: false, error: `planner fetch failed: ${(err as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }

  // Strip markdown fences defensively.
  const stripped = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch (err) {
    return { ok: false, error: `planner JSON parse failed: ${(err as Error).message}`, rawText: raw };
  }

  const validated = TripPlanSchema.safeParse(parsed);
  if (!validated.success) {
    return {
      ok: false,
      error: `planner schema validation failed: ${validated.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')}`,
      rawText: raw,
    };
  }

  // Cross-check: reject assignments referencing slotIds / mustDoRefs that
  // don't exist in the input. Drop bad rows rather than failing the whole call.
  const validSlotIds = new Set<string>();
  for (const d of input.skeletons) for (const s of d.slots) validSlotIds.add(s.slotId);
  const validMustDoIds = new Set(input.mustDos.map((m) => m.id));

  const cleanedAssignments: PlannerDayAssignment[] = validated.data.dayAssignments.map(
    (d) => ({
      ...d,
      mustDoSlots: d.mustDoSlots.filter(
        (s) => validSlotIds.has(s.slotId) && validMustDoIds.has(s.mustDoRef),
      ),
    }),
  );

  return {
    ok: true,
    plan: {
      dayAssignments: cleanedAssignments,
      omitted: validated.data.omitted,
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (testable without an LLM)
// ─────────────────────────────────────────────────────────────────────────────

export { buildPrompt as __buildPlannerPrompt };
