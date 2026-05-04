## Goal
Make every immediate fact a user gives us — at any entry point — survive as a **single-line, day-scoped, locked row** that is injected into generation and verified before the itinerary is shown. No more giant blobs, no more silent overwrites.

## What already exists (don't rebuild)
- `public.trip_day_intents` table — one row per stated wish, day-scoped, with `priority`, `locked`, `locked_source`, `status`. Unique index dedupes re-saves.
- `_shared/day-intents-store.ts` — `upsertDayIntents`, `fetchActiveDayIntents`, `seedDayIntentsFromMetadata`, `reconcileFulfillment`.
- `_shared/intent-normalizers.ts` — converts each entry-point shape into `DayIntentInput[]`.
- `_shared/parse-fine-tune-intents.ts` — parses "Day 3 dinner at Belcanto", "April 19", "first night", etc.
- `generate-itinerary/day-ledger.ts` — builds + renders the per-day "DAY BRIEF — DO NOT VIOLATE" prompt block (one bullet per intent).
- `generate-itinerary/ledger-check.ts` — post-generation: inserts placeholder for missing `must` intents, drops closure violations, flags vibe clashes.
- `generation-core.ts` already calls `seedDayIntentsFromMetadata` once per generation; `compile-prompt.ts` reads `trip_day_intents` first and only falls back to blob parsing.

## Real gaps to close

### 1. Entry-point coverage (the leak)
`seedDayIntentsFromMetadata` only fires inside `generate-itinerary`. That means an intent only becomes a row **when generation runs**, and only from fields it knows about. We need each entry point to upsert immediately on save, in its own shape:

| Entry point | File | Today | Fix |
|---|---|---|---|
| Just Tell Us / chat-trip-planner | `supabase/functions/chat-trip-planner/index.ts` | Writes `mustDoActivities`, `perDayActivities`, `userConstraints`, `additionalNotes` to `trip.metadata`; intents only materialize at generation time. | After persisting trip metadata, call `intentsFromChatPlannerExtraction(...)` + `upsertDayIntents` so rows exist before the user even taps "generate". |
| Fine-Tune textarea | `src/components/planner/ItineraryContextForm.tsx` (saves to metadata) | Same as above — only seeded at generation. | On save, invoke a tiny edge function (or extend `enrich-manual-trip`) that calls `intentsFromFineTuneNotes` + `upsertDayIntents`. |
| Manual paste / chat paste | `enrich-manual-trip/index.ts` | Already calls `intentsFromUserAnchors` ✅ | No change. |
| Assistant chat | `itinerary-chat/index.ts` (already uses `record_user_intent`) ✅ | No change. |

This guarantees the structured rows exist at every save point, so `compile-prompt` always sees them via the structured path (never the blob fallback).

### 2. Lock semantics for "immediate facts"
Today, anything from chat-planner / fine-tune is stored with `locked: false` and `priority: 'must'`. The Day Brief prints them under "USER REQUIRED — DO NOT DROP", but anchor-guard does not actually pin them, and the AI can still re-time or reword them.

Fix in `intent-normalizers.ts`:
- When the user gives an explicit time + named venue (e.g. "Dinner at Belcanto 7:30 Day 3"), set `locked: true` and `lockedSource: 'just_tell_us:<hash>'`. That promotes the row from "soft must" to a hard anchor that the existing anchor-restore step in `action-save-itinerary.ts` will re-insert verbatim.
- Lines without a venue or time stay `locked: false, priority: 'must'` — covered by the placeholder-restoration path already in `ledger-check.ts`.

### 3. Pre-presentation verification gate
`ledgerCheck` runs in `action-save-itinerary.ts` and produces warnings + auto-restored placeholders, but warnings are only logged. We should:
- Persist `lc.warnings` onto `itinerary.dayLedgers[*].warnings` (already partially done via `(itinerary as any).dayLedgers = ledgers`, just append warnings keyed by day).
- Add a final assertion: for every `trip_day_intents` row with `priority IN ('must','avoid')` and `status='active'` after `reconcileFulfillment`, either (a) it appears in the day, (b) a placeholder was inserted, or (c) it's logged as `missing_user_intent_unresolved` — and the trip cannot be marked "ready" until all three are satisfied. Front-end already reads `dayLedgers`; this just needs one extra log + a `readyForPresentation` boolean on the itinerary JSON.

### 4. Single-line render audit
`renderDayLedgerPrompt` already emits one `  - <time>  <KIND> — <title>    [source: …]` line per intent. Confirmed correct. The blob-style "USER WANTS" paragraphs that used to exist in `compile-prompt.ts` are now gone from the structured path — but the **legacy fallback** still injects free-form `additionalNotes` further down in the user prompt. Once gap #1 is closed, we can remove the legacy paragraph-style injection in `compile-prompt.ts` so the Day Brief is the only voice telling the AI what the user wants.

## Files to touch

```
supabase/functions/chat-trip-planner/index.ts
  - After trip insert/update, import intent-normalizers + day-intents-store
    and upsert intents from extracted fields.

supabase/functions/_shared/intent-normalizers.ts
  - In intentsFromChatPlannerExtraction & intentsFromFineTuneNotes:
    promote rows with (explicit time AND named venue) to locked=true,
    lockedSource='just_tell_us:'+stableHash(title+time+day).

supabase/functions/generate-itinerary/action-save-itinerary.ts
  - Attach lc.warnings into itinerary.dayLedgers[d].warnings.
  - After reconcileFulfillment, set itinerary.readyForPresentation =
    (no must/avoid row left active without a placeholder or match).

supabase/functions/generate-itinerary/pipeline/compile-prompt.ts
  - Stop appending raw additionalNotes paragraph when structured rows exist
    (the Day Brief already covers them — duplication encourages the AI to
    re-interpret and re-time).

src/components/planner/ItineraryContextForm.tsx (+ TripContext.tsx)
  - On save of fine-tune notes, call a thin RPC/edge endpoint that runs
    intentsFromFineTuneNotes + upsertDayIntents so rows exist pre-generation.
```

No DB migrations needed — `trip_day_intents` and all helpers already exist.

## Out of scope
- UI surfacing of unresolved intents (separate ticket — the data will be on `dayLedgers[*].warnings` after this change).
- Reworking `parseFineTuneIntoDailyIntents` heuristics (they're adequate; we're fixing flow, not parsing).
