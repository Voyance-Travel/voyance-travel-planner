# Skip-List Self-Contradiction Fix (Issue 2A)

## Root cause

The "skip list" is computed in two independent places, **neither of which the generator sees**:

1. `src/utils/itineraryValidator.ts` — hardcoded `SKIP_LIST_KEYWORDS` (paris/tokyo/rome/london/barcelona). Used only at *read time* to render the "Voyance Intelligence: 3 activities match our skip list" badge.
2. `supabase/functions/generate-skip-list/index.ts` — AI-generated alternatives, cached client-side per destination. Powers the "Why we skipped" panel.

The backend generator (`compile-prompt.ts`, `prompt-library.ts`, `validate-day.ts`, `repair-day.ts`) consumes `avoidList` (DNA + archetype `never`), but **never the destination skip list**. So the LLM happily emits Robot Restaurant in Tokyo because it has no idea that's a Voyance "skip" — and validate/repair never drops it because the keyword set lives only in the FE.

## Fix

Make the destination skip list a first-class input to generation. Single canonical source, used by both FE badge and BE generator/repair.

### 1. Canonical skip-list module (BE)

New `supabase/functions/_shared/destination-skip-list.ts`:
- Export `SKIP_LIST_KEYWORDS` (hardcoded seeds for paris/tokyo/rome/london/barcelona — moved verbatim from `src/utils/itineraryValidator.ts`).
- `getDestinationSkipList(destination)`:
  1. Look up hardcoded seeds (city-prefix match, same matcher as today).
  2. Read cached AI-generated entries from `destination_insights_cache` (key `skip_list:<destLower>`) if present.
  3. Merge + dedupe by lowercased keyword. Return `{ keyword, reason?, alternative? }[]`.
- `matchesDestinationSkipList(title, description, list)` — same substring matcher the FE uses (≥3 chars).

Cache write happens when `generate-skip-list` returns (small change there): after building `localAlternatives`, upsert into `destination_insights_cache` so BE can hydrate without re-calling the LLM.

### 2. Wire into the prompt

`prompt-library.ts` (the personalization block, near the existing `FOOD AVOID`):
- New section `🚫 DESTINATION SKIP LIST — DO NOT PLACE THESE` listing the merged keywords + the local alternative for each (so the model has a substitute to reach for).
- Hard rule: "Activities matching any item above are FORBIDDEN. If you'd normally suggest one, use the listed alternative instead."

`compile-prompt.ts` plumbs `destinationSkipList` from `ctx` into the prompt builder. `profile-loader.ts` / `generation-types.ts` add `destinationSkipList: SkipListEntry[]` to the context and populate it via `getDestinationSkipList(ctx.destination)`.

### 3. Validation gate — hard drop, not just warn

`pipeline/validate-day.ts`:
- New `SKIP_LIST_VIOLATION` issue code, severity `critical` (so `applyValidationGate` drops instead of warning).
- Runs `matchesDestinationSkipList` on title + description against the destination list. Matches → drop the card with `repair.action='dropped_skip_list_violation'`, telemetry `[SKIP_LIST_DROP]`.

`repair-day.ts` step 10b (existing scrub block): also run the matcher as a safety net post-LLM, mirror the drop. Dropped slots are picked up by the existing `refillDroppedSlots` pipeline already wired into `action-generate-trip-day.ts` — refill prompt receives the same skip list so replacements are valid.

`_shared/refill-slots-llm.ts`: thread `destinationSkipList` through; reject any candidate that matches.

### 4. FE convergence

`src/utils/itineraryValidator.ts`:
- Keep the hardcoded `SKIP_LIST_KEYWORDS` map in place (FE still needs an offline matcher for the "Heads up" badge on legacy trips).
- Extend `matchesSkipList` to also accept an injected list (passed in from `useSkipList`) so freshly generated trips use the same merged set the BE used. The badge then shows zero matches on new trips (since BE already dropped them), and the panel becomes diagnostic-only for legacy data.

### 5. Telemetry + tests

- Sentinels: `[SKIP_LIST_PROMPT] destination=… keywords=N`, `[SKIP_LIST_DROP] day=N title="…" matched="…"`, `[SKIP_LIST_REFILL] day=N replaced_with="…"`.
- Stamp `metadata.quality.skip_list = { prompt_count, dropped_count, refilled_count }`.
- New tests:
  - `_shared/__tests__/destination-skip-list.test.ts` — matcher, merge, cache hydration.
  - `pipeline/__tests__/validate-day-skip-list.test.ts` — Robot Restaurant in Tokyo → critical → drop.
  - `__tests__/refill-skip-list-respects.test.ts` — refill never returns a blacklisted candidate.

### 6. One-shot legacy cleanup

Optional follow-up (not in this PR): a `heal-skip-list-violations` edge fn that scans existing `trips.itinerary_data` and drops any persisted skip-list matches, then re-persists via `safeUpdateItineraryData('self-heal-skip-list')`. Out of scope unless requested.

## Files touched

**New**
- `supabase/functions/_shared/destination-skip-list.ts`
- `supabase/functions/_shared/__tests__/destination-skip-list.test.ts`
- `supabase/functions/generate-itinerary/pipeline/__tests__/validate-day-skip-list.test.ts`
- `supabase/functions/generate-itinerary/__tests__/refill-skip-list-respects.test.ts`

**Edited**
- `supabase/functions/generate-itinerary/profile-loader.ts` (load skip list into ctx)
- `supabase/functions/generate-itinerary/generation-types.ts` (type + ctx field)
- `supabase/functions/generate-itinerary/compile-prompt.ts` (thread into prompt builder)
- `supabase/functions/generate-itinerary/prompt-library.ts` (skip-list section + hard rule)
- `supabase/functions/generate-itinerary/pipeline/validate-day.ts` (`SKIP_LIST_VIOLATION` critical drop)
- `supabase/functions/generate-itinerary/repair-day.ts` (step 10b safety net)
- `supabase/functions/_shared/refill-slots-llm.ts` (reject matches in refill)
- `supabase/functions/generate-skip-list/index.ts` (cache to `destination_insights_cache`)
- `src/utils/itineraryValidator.ts` (accept injected list)
- `src/components/itinerary/EditorialItinerary.tsx` (pass `useSkipList` result into validator)

## What this closes

- Robot Restaurant on Day 2 + Day 3 in Tokyo (and same-class regressions: Seine cruise in Paris, Piazza Navona in Rome, Hard Rock in London, Las Ramblas dining in Barcelona).
- Self-contradiction between the "Voyance Intelligence: skip these" panel and the generated itinerary — the same list now drives both.
- Future destinations get coverage automatically via the AI-generated cache; today only the 5 seeded cities are hard-enforced.
