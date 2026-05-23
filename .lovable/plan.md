# Itinerary Generation — Full Observability Pass

Goal: every silent regression we've been guessing at (meal-overlap insertion, §15z misses, dead-gap skips, missing bookends, validation drops, persist-time rewrites) should produce one **attributed, structured log line** so the next bad trip tells us the exact stage to patch.

No behavior change. Pure logging + one already-existing `StageLogger` finally wired up.

## Sentinels to add

All log lines follow the format `[<STAGE_CODE>] tripId=… day=N …key=val` so they're greppable in Supabase edge-function logs.

### 1. Meal-guard / floating-meal insertion (`_shared/post-meal-guard-fill.ts`, `_shared/timing-cascade.ts::assignFloatingMealTimes`)
- `[MEAL_INSERT_DECISION] day=N slot=lunch picked=12:30 collides_with=<id|title>(11:55-13:10) action=push_to=13:15|keep|skip reason=…`
- `[MEAL_INSERT_NO_VENUE] day=N slot=… reason=pool_exhausted|cross_city|dietary`
- `[MEAL_GUARD_SUMMARY] day=N inserted=K skipped=M collisions=C`

### 2. Dead-gap fill (`pipeline/fill-dead-gaps.ts`)
- `[DEAD_GAP_SCAN] day=N gaps=[{start,end,mins,beforeId,afterId}]`
- `[DEAD_GAP_DECISION] day=N gap=13:30-16:45 mins=195 decision=fill|skip reason=next_is_freshenup|budget_cap|category_filter|pool_empty|under_threshold`
- `[DEAD_GAP_SUMMARY] day=N filled=K skipped=M`

### 3. Bookend / hotel-return (`universal-quality-pass.ts::runStep8`, `_shared/bookend-verification.ts`)
- `[BOOKEND_INVOKE] day=N caller=quality|post-meal|save|persist lastEnd=… isDeparture=… injected=Y/N reason=…`
- `[BOOKEND_NOT_INVOKED] day=N reason=arrival_unknown|isDeparture|last_end_before_14:00|locked_tail|already_present|<6h_remaining`

### 4. Departure-day §15z (`pipeline/repair-day.ts::enforceDepartureDayLogistics`)
- Already added `[DEPARTURE_15Z_RAN/SKIPPED]`. Extend with per-action delta:
- `[DEPARTURE_15Z_ACTION] day=N action=retime_checkout|retime_transfer|prune_post_cutoff target=<id|title> from=… to=… reason=…`
- `[DEPARTURE_15Z_SUMMARY] day=N flight=… buffer=… checkout_cap=… actions=K`

### 5. Validation-gate drops (`pipeline/validation-gate.ts`)
- `[VALIDATION_GATE_DROP] day=N code=LOGISTICS_SEQUENCE|OVERLAP|… target=<id|title> severity=critical action=drop|blank|downgrade`
- `[VALIDATION_GATE_SUMMARY] day=N drops=K blanks=M downgrades=D`

### 6. Persist-cascade (already added `[PERSIST_CASCADE]`)
- Extend with `[PERSIST_CASCADE_DETAIL] day=N moved=<id> from=12:30 to=13:15 reason=overlap|same_start|buffer`

### 7. Save-time normalize (`action-save-itinerary.ts`)
- `[SAVE_NORMALIZE] day=N steps=[normalizeDays, predawnCascade, departureNet, postCheckoutPrune, bookendVerify] mutations=K`

### 8. Wire `StageLogger` (already built, currently unused)
`pipeline/stage-logger.ts` already persists per-stage artifacts to `trips.metadata.pipeline_logs.day_N`. Wire it into `action-generate-trip-day.ts` so every generated day stamps:
- compile-facts timing + size
- compile-schema output
- prompt summary (first 2k chars)
- raw AI response (first 5k)
- validation results array
- repair actions array
- per-stage timings

This is the single biggest leverage point — once it's on, any future "why did this day look weird" is one DB read away.

### 9. Top-of-pipeline trace ID
Generate `genTraceId = crypto.randomUUID().slice(0,8)` at the top of `action-generate-trip-day.ts` and prefix every log emitted during that invocation. Same for `action-save-itinerary.ts`. Lets us follow one day's full lifecycle across hundreds of interleaved log lines.

### 10. Console-noise discipline
- Gate purely informational logs behind `DEBUG_LOGS` env (existing `debugLog` helper in `_shared/debug-log.ts`).
- All `[STAGE_CODE]`-prefixed sentinels stay on **always** — they're the diagnostic surface.

## Touch list

```text
supabase/functions/_shared/post-meal-guard-fill.ts        — MEAL_INSERT_*
supabase/functions/_shared/timing-cascade.ts              — PERSIST_CASCADE_DETAIL, MEAL collision in assignFloatingMealTimes
supabase/functions/_shared/bookend-verification.ts        — BOOKEND_INVOKE/NOT_INVOKED at every call site
supabase/functions/generate-itinerary/universal-quality-pass.ts  — BOOKEND_INVOKE in runStep8
supabase/functions/generate-itinerary/pipeline/fill-dead-gaps.ts — DEAD_GAP_*
supabase/functions/generate-itinerary/pipeline/repair-day.ts     — DEPARTURE_15Z_ACTION/SUMMARY
supabase/functions/generate-itinerary/pipeline/validation-gate.ts — VALIDATION_GATE_DROP/SUMMARY
supabase/functions/generate-itinerary/action-generate-trip-day.ts — wire StageLogger + genTraceId
supabase/functions/generate-itinerary/action-save-itinerary.ts    — SAVE_NORMALIZE + genTraceId
supabase/functions/_shared/persist-itinerary.ts                   — PERSIST_CASCADE_DETAIL
```

No new files. No schema migration (StageLogger already writes to `trips.metadata` which is jsonb).

## How we'll use it

Next time a trip surfaces a weird artifact:
1. Grep edge-function logs for `tripId=<id>` → full chronological trace via `genTraceId`.
2. Read `trips.metadata.pipeline_logs.day_N` for the AI response + validation + repair history.
3. Match the artifact to the exact `[STAGE_CODE]` that introduced it.
4. Patch that stage. No more whack-a-mole.

## Out of scope

- No retry/auto-heal logic added — pure visibility.
- No new validators or repair passes.
- No frontend changes.
- No removal of existing logs (we add, don't subtract, until we have a baseline).

## Risk

- Log volume increase: ~20–30 extra lines per day generated, ~50KB extra metadata per trip. Both acceptable; metadata already holds quality traces.
- `StageLogger.flush()` is a `UPDATE trips SET metadata` — one extra round-trip per day. Wrapped in try/catch (already is) so it can't break generation.
