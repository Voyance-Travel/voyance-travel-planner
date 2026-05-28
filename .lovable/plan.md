# Wire the Existing Schema System Into Real Generation

## What I got wrong last turn

I said "build the skeleton." You correctly pointed out you already did. The system is in `src/types/schema-generation.ts` and `src/config/pattern-group-configs.ts`, built as "Fix 22A-E" with the explicit comment "ZERO dependencies on existing generation code." It is fully typed: `DaySchema → DaySlot[] → SlotTimeWindow / SlotFilledData / mealType / aiInstruction`. Five pattern groups (packed / social / balanced / indulgent / gentle) with full configs. Archetype→group mapping done. Tests exist.

**It is only wired into the preview pane** (`ItineraryGenerator.tsx` → `fullPreviewService.ts`). The actual generator (`pipeline/compile-day-schema.ts`) returns prompt *text*, throws the typed schema away, and the LLM is asked to invent the day from scratch. That is the root cause of every "missing meal / nightcap at 9 AM / Trevi ignored" failure.

## What you're describing (3-layer intelligence model)

```text
User submits form
       │
       ▼
┌────────────────────────────────────────────────────┐
│ Layer 1: PLANNER (deterministic + 1 LLM call)      │
│   - buildTripSkeleton uses existing DaySchema      │
│   - PatternGroupConfig picks slot density          │
│   - DayType picks arrival / standard / departure   │
│   - Planner LLM: "Given hotel, must-dos, days,     │
│      lay out logistics. Which day for Trevi?       │
│      Which neighborhood for breakfast Day 2?       │
│      Where will time not allow X?"                 │
│   - Output: filled DaySchema[] + omittedList       │
└────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────┐
│ Layer 2: FILLER (parallel LLM call per day)        │
│   - Per slot: "Name 1 real venue in <neighborhood> │
│      that fits <slotType>, <DNA>, <dietary>,       │
│      <budget tier>. Return name + description."    │
│   - LLM cannot change time, slot, order, schema    │
│   - Verified-venues DB used first, LLM second      │
└────────────────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────────────────┐
│ Layer 3: CLEANUP (deterministic + targeted LLM)    │
│   - Deterministic: dedupe, transit, dietary, route │
│   - If a slot ended unfilled or was rejected:      │
│      one focused LLM call to refill that slot only │
│   - Persist with commit gate                       │
└────────────────────────────────────────────────────┘
       │
       ▼
Done. No 20-step repair stack needed.
User sees: "Trevi reserved Day 1. Pantheon won't fit
in 2 days — swap or skip?" BEFORE generation starts.
```

This is exactly what the existing `schema-generation.ts` was designed for. We don't build new types. We connect what exists.

## How we get there without tossing existing code

### Phase 1 — Lift the schema system from FE-only to shared

The types live in `src/types/schema-generation.ts` (frontend). Backend can't import them. Mirror them to `supabase/functions/_shared/schema-generation.ts` (and the pattern-group configs to `supabase/functions/_shared/pattern-group-configs.ts`). Single source of truth, two import paths. No type drift.

### Phase 2 — Replace `compileDaySchema` output

`pipeline/compile-day-schema.ts:18` currently returns `{ dayConstraints: string }`. Change it to also return `daySchema: DaySchema` populated with empty slots based on:
- `DayType` (already classified — arrival band / standard / departure band)
- `PatternGroupConfig` (read from `trips.metadata.pattern_group`, already stored)
- Must-dos pre-allocated into compatible slots
- Meals pre-allocated at config-driven times

The existing prompt-text output stays for backwards compatibility during migration. New consumers read `daySchema` directly.

### Phase 3 — Add the Planner LLM call (Layer 1)

New shared module: `supabase/functions/_shared/trip-planner-llm.ts`.

Single call **before** the per-day chain starts. Input: hotel, flight, must-dos, days, DNA, pattern group, empty trip skeleton. Output: assignment decisions + omitted list, validated against a Zod schema (no free-form JSON parsing).

```ts
{
  dayAssignments: [{ dayNumber, neighborhood, mustDoSlots: [{slotId, mustDoRef}] }],
  omitted: [{ mustDoTitle, reason: 'not_enough_time' | 'wrong_day_type' }]
}
```

The omitted list is surfaced in the trip-builder confirmation step (uses existing `WhyWeSkippedSection.tsx` component pattern) so the user decides BEFORE generation: swap, drop, or accept.

### Phase 4 — Convert the per-day LLM call to a slot-fill contract (Layer 2)

`action-generate-day.ts` currently sends free-form prompt → free-form JSON. Replace with:
- Input to LLM: the populated `DaySchema` with empty `filledData` on activity/meal slots + per-slot `aiInstruction`
- Output schema (AI SDK `Output.object`): `{ slotId, name, description, venueAddress, durationMin }[]` only
- Merge: walk skeleton, write filled-data per slot. Cannot change time, cannot add slots.

This shrinks the prompt from ~8KB of instructions to ~2KB of context per slot. Fewer tokens, fewer hallucinations, no time invention.

### Phase 5 — Cleanup layer (Layer 3)

Most of the existing 20-step repair stack becomes unreachable (the LLM can no longer break the things they fix). Keep the genuinely useful deterministic ones:
- Transit recompute (real distances)
- Cross-city dedup
- Verified-venue snap (replace LLM names with verified DB matches when score >0.9)
- Cost-ledger write

Add **one focused refill LLM call** for any slot that came back empty, invalid, or got rejected by a cleanup pass. Bounded retry, then mark the slot user-actionable.

Delete (eventually): `enforceRequiredMealsFinalGuard`, `injectMissingMustDos`, `sanitizeSchedule` pre-dawn meal repair, `assertNoCrossDayBleed`, ~12 repair steps. They're patching problems the schema model prevents.

### Phase 6 — AI SDK adoption for all 3 LLM calls

Today's LLM calls are hand-rolled `fetch` to the AI gateway with manual JSON parsing. Switch to AI SDK + `Output.object` + Zod schemas. Eliminates a whole class of parse failures and aligns with the platform standard.

## What we keep

- All the verified venue pools, cost reference data, must-do allocation heuristics, archetype configs, hotel/flight context resolution. Those layers stay.
- The frontend preview (`fullPreviewService`) — it shares the schema types so it stays accurate to what the backend produces.
- Commit gate as final sanity check.

## What we delete

After phases 4–5 ship clean for one week:
- ~60% of `repair-day.ts`
- `enforceRequiredMealsFinalGuard`
- `injectMissingMustDos` (must-dos are slot-allocated, never missing)
- `sanitizeSchedule` meal-repair branch
- Free-form prompt branches in `compile-prompt.ts`

## Sized phases

| Phase | Effort | User-visible result |
|---|---|---|
| 1 — share types BE/FE | small | none yet |
| 2 — `compileDaySchema` returns DaySchema object | medium | none yet, parity only |
| 3 — Planner LLM + omitted list UI | medium | user sees "Trevi won't fit" before generation |
| 4 — Filler slot-fill LLM | large | meals always present, nightcap-at-9-AM impossible |
| 5 — Cleanup + retire repair stack | medium | faster generation, fewer failures |
| 6 — AI SDK adoption | medium | parse failures vanish |

Phases 1–3 are reviewable as one unit (no behavior change yet, but the foundation moves). Phases 4–5 ship behind a `useSchemaGeneration` flag, A/B against current pipeline on 20 trips before flipping default.

## Answering your question directly

> Does that sound better than what we're currently doing?

Yes. And it's most of the way built — Fix 22A-E gave us the type system, configs, archetype mappings, and preview wiring. What's missing is the wiring into the real backend pipeline and the three-layer LLM split. We don't toss anything. We connect what's already there and retire what becomes redundant.

Approve and I'll start with Phase 1+2 (lift schema to shared, make compileDaySchema return the typed object). That's the foundation; without it phases 3–5 can't be built. It's purely additive — old prompt-text output stays live until phase 4 cuts over.


## Phase 1+2 — DONE (2026-05-28)

- `_shared/schema-generation.ts` — backend mirror of FE Fix-22A-E types (Skeleton prefix to avoid clash with legacy `pipeline/types.ts::DaySchema`)
- `_shared/pattern-group-configs.ts` + `_shared/archetype-group-mapping.ts` — backend mirrors
- `_shared/build-day-skeleton.ts` — deterministic populated `SkeletonDay` builder (arrival/departure pins, meal-band slots, must-do allocation with `mustDoRef`, evening windows ≥18:00)
- `compileDaySchema` returns `{ ...legacy, daySkeleton, daySkeletonOmitted }`; failures are non-fatal — legacy prompt-text path unchanged
- 5 unit tests pass (`build-day-skeleton.test.ts`)

Behavior unchanged. Next: Phase 3 — Planner LLM call that fills `daySkeleton` assignment decisions and surfaces `omitted` to the UI BEFORE generation.
