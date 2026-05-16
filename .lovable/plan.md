# Add must-do diagnostic logging

Short answer: **no — we have logging in the middle of the pipeline, but two critical boundaries are silent**, which is exactly why we can't tell whether the next failing trip is a write problem, a merge problem, or a prompt problem.

## What we already log

- `compile-prompt.ts:508` — `[compile-prompt] Must-do: N total, Day X: K assigned, M events`
- `generation-core.ts:2195` — `[Stage 2] Day N: MISSING must-do activities: …` (retry trigger)
- `generation-core.ts:2204` — `[Stage 2] Day N must-do check error (non-blocking)`

## What is silent (the blind spots)

1. **Trip-creation insert** (`src/pages/Start.tsx` L2500 form path + L2915 chat path) — we don't log what `mustDoActivities` value was written to `metadata`. When the DB later shows `mh_count=0`, we can't tell if the user typed nothing vs. the UI dropped it.
2. **persist-itinerary metadata merge** (`supabase/functions/_shared/persist-itinerary.ts` L489 + L534) — the merge that's supposed to preserve `mustDoActivities` across saves logs nothing. If a regeneration wipes it, we have no breadcrumb.
3. **generation-core context build** (`generation-core.ts:314`) — we read `trip.metadata?.mustDoActivities` but don't log whether it was present/empty at generation start.

## Plan: 4 one-line log additions

| # | File | Where | Log line |
|---|------|-------|----------|
| 1 | `src/pages/Start.tsx` | After both inserts (L2500, L2915) | `console.log('[trip-create] tripId=… mustDoActivities=', formMustDoList?.length ?? 0, 'items')` |
| 2 | `supabase/functions/_shared/persist-itinerary.ts` | Inside both merge blocks (L515, L543) | `console.log('[persist-itinerary] meta-merge tripId=… priorMustDo=', !!priorMeta?.mustDoActivities, 'newMustDo=', !!callerMeta?.mustDoActivities)` |
| 3 | `supabase/functions/generate-itinerary/generation-core.ts` | At L314 after the `mustDoActivities` resolver | `console.log('[generation-core] context mustDoActivities=', context.mustDoActivities ? context.mustDoActivities.slice(0,120) : '(empty)')` |
| 4 | `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` | At L376 after `mustDoActivitiesRaw` resolves | `console.log('[compile-prompt] mustDoActivitiesRaw len=', mustDoActivitiesRaw.length, 'source=', requestMustDoText ? 'request' : 'metadata')` |

## What this buys us

For the next failing trip, a single `supabase--edge_function_logs` search on `[trip-create]` → `[persist-itinerary] meta-merge` → `[generation-core] context` → `[compile-prompt]` will pinpoint exactly which boundary dropped the value, with no further investigation needed.

## Out of scope

- No prompt changes, no schema changes, no behavior changes.
- The frontend `[trip-create]` log will surface in the user's browser console; the three edge-function logs flow to Supabase analytics. No PII (we log lengths/booleans, not user text — except the 120-char prompt slice for sanity).

After approval I'll add the four log lines and nothing else.
