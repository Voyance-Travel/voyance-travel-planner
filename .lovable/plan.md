## Root cause

The model is leaking another prompt token — `(FLEX_WINDOW)` — into activity titles (Day 1 "Open Afternoon - Wander Castello (FLEX_WINDOW)"). It comes from the spontaneous-planning section of `archetype-constraints.ts` (lines 2271–2275: "Required FLEX WINDOW format"). Same class of bug as `(slot)` and `(AESTHETIC slot)`.

The current artifact strippers don't catch it:

- `PROMPT_ARTIFACT_RE` in `src/lib/itinerary/persistDayContract.ts` and `supabase/functions/_shared/persist-day-contract.ts` only matches `(... slot|placeholder)` — requires the literal trailing word `slot` or `placeholder`.
- `_scrub_itinerary_prompt_artifacts` DB trigger uses the same narrow pattern.
- `src/utils/textSanitizer.ts` line 31 only matches a hard-coded label list (`AESTHETIC|NARRATIVE|MOOD|...`) — `FLEX_WINDOW` isn't in it, and the list never matches tokens with underscores.

`(FLEX_WINDOW)` slips past all four layers and renders straight into the card title.

## Fix scope (4 surgical regex updates — no behavior change)

Add a second alternative that catches **bare ALL-CAPS tokens containing an underscore** (the prompt-template convention) — e.g. `(FLEX_WINDOW)`, `(NARRATIVE_MOOD)`, `(DEEP_CONTEXT)`. The underscore requirement keeps it from matching legit acronyms like `(USA)`, `(UK)`, `(NYC)`.

New combined pattern:
```
\(\s*(?:
  (?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder)   // existing
  |
  [A-Z][A-Z0-9]*_[A-Z0-9_]+                            // NEW: ALLCAPS_WITH_UNDERSCORE
)\s*\)
```

Apply in:

1. `src/lib/itinerary/persistDayContract.ts` — update `PROMPT_ARTIFACT_TEST_RE` and `PROMPT_ARTIFACT_REPLACE_RE` (browser strip + drop pass).
2. `supabase/functions/_shared/persist-day-contract.ts` — update `PROMPT_ARTIFACT_RE` (edge save-itinerary contract).
3. `supabase/functions/_shared/persist-itinerary.ts` — update its mirror artifact strip regex.
4. `src/utils/textSanitizer.ts` — add the bare-ALLCAPS-underscore alternative so already-saved trips render cleanly without re-save.

DB migration:
5. Tighten `_scrub_itinerary_prompt_artifacts` PL/pgSQL function: extend its regex with the same bare-ALLCAPS-underscore alternative, so future inserts/updates strip `(FLEX_WINDOW)` from `title`/`name` and the snapshot at the DB boundary.

One-shot data repair (same migration): UPDATE existing `itinerary_days` and `trips.itinerary_data` rows where `title`/`name` matches the new pattern, scrubbing the token in place. Limited to last 14 days to avoid touching ancient data.

## Tests

Add cases to `src/lib/itinerary/__tests__/persistDayContract.test.ts` and `supabase/functions/_shared/persist-day-contract.test.ts`:
- Title `"Open Afternoon - Wander Castello (FLEX_WINDOW)"` → artifact stripped, activity kept, title becomes `"Open Afternoon - Wander Castello"`.
- Title `"Stroll San Marco (NARRATIVE_MOOD)"` → stripped.
- Title `"Visit MoMA (NYC)"` → **NOT stripped** (no underscore, legit acronym).
- Title `"Photo stop (USA)"` → **NOT stripped**.
- Existing `(slot)` / `(AESTHETIC slot)` cases continue to pass.

Add to `src/utils/__tests__/textSanitizer.artifacts.test.ts`:
- `sanitizeText("Wander Castello (FLEX_WINDOW)")` → `"Wander Castello"`.

## What this does NOT change

- No prompt edits (the generator can keep the FLEX WINDOW guidance — we just refuse to let the literal token survive to the user).
- No business logic, no scoring, no costs, no locking, no cross-city sweep.
- Bare-acronym parens in legit prose still pass through.

## Files

- Edit `src/lib/itinerary/persistDayContract.ts`
- Edit `supabase/functions/_shared/persist-day-contract.ts`
- Edit `supabase/functions/_shared/persist-itinerary.ts`
- Edit `src/utils/textSanitizer.ts`
- Edit `src/lib/itinerary/__tests__/persistDayContract.test.ts`
- Edit `supabase/functions/_shared/persist-day-contract.test.ts`
- Edit `src/utils/__tests__/textSanitizer.artifacts.test.ts`
- New migration: tighten `_scrub_itinerary_prompt_artifacts` + 14-day backfill scrub of `itinerary_days` + `trips.itinerary_data`.

## Memory update after fix

Append to `mem://technical/itinerary/stateful-regex-strip-bug`: prompt-artifact pattern set must cover `(slot)`/`(placeholder)` AND bare ALL-CAPS-with-underscore tokens like `(FLEX_WINDOW)`, `(NARRATIVE_MOOD)`, `(DEEP_CONTEXT)`. Hard-coded label allow-lists are fragile — the underscore convention is the durable signal.
