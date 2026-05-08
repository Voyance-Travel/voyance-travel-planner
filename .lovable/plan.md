## Root cause

Three independent leak paths let `(INTEREST_SLOT)` reach the user, despite the regex updates from the last fix:

1. **UI render bypass.** Activity card titles render through `sanitizeActivityName` / `sanitizeActivityText` in `src/utils/activityNameSanitizer.ts` — **not** through `sanitizeText` (where I added the bare-ALLCAPS-with-underscore stripper last round). `activityNameSanitizer.ts` has no prompt-artifact stripping at all (grep confirms: only `Fulfills the … slot.` and a generic `USER_PREF_NOTE_RE`). So whatever survives to the DB renders raw.

2. **DB per-day trigger only DROPS, never STRIPS.** `itinerary_days_scrub_activities_trg` calls `scrub_itinerary_activities(jsonb)`, which uses the old narrow regex `\(\s*([A-Z][A-Z0-9 _-]{1,30}\s+)?(slot|placeholder)\s*\)`. `(INTEREST_SLOT)` and `(FLEX_WINDOW)` don't match (no trailing word "slot"/"placeholder", no required whitespace before SLOT — it's an underscore). So the row passes through with the dirty title intact. And even if it matched, this trigger drops the whole row instead of cleaning the title — wrong behavior for a forced interest activity we want to keep.

3. **Trip-level scrubber covers `trips.itinerary_data` but not `itinerary_days.activities` writes.** `_scrub_itinerary_prompt_artifacts` (updated last round, regex now correct) only runs on `trips`. The per-day row write path has no equivalent text-strip — only the row-drop trigger above.

Net: a forced "INTEREST SLOT" activity (from `personalization-enforcer.ts:797`) gets written into `itinerary_days.activities` with the model paraphrasing the label as `(INTEREST_SLOT)` in the title, survives both DB triggers, and renders through `sanitizeActivityName` untouched.

## Fix scope (3 surgical changes — same regex everywhere)

Reuse the already-deployed pattern:
```
\(\s*(?:(?:[A-Z][A-Z0-9 _-]{1,30}\s+)?(?:slot|placeholder)|[A-Z][A-Z0-9]*_[A-Z0-9_]+)\s*\)
```

### 1. UI safety net — `src/utils/activityNameSanitizer.ts`
Add a top-of-pipeline strip in `sanitizeActivityName` (and `sanitizeActivityText` if it exists alongside) that removes prompt-artifact tokens from the input before any other processing. Two regexes — non-global for `.test()`, `/g` for `.replace()` — per the Stateful Regex Strip Bug memory. This fixes every already-saved trip on next render with zero data writes.

### 2. New DB function `_strip_prompt_artifacts_in_activities(jsonb) → jsonb`
Pure text-strip (mirror of `_scrub_itinerary_prompt_artifacts` but operating on a `jsonb` array of activities, not a full itinerary). Removes the artifact substring from each activity's `title`, `name`, `description`. Never drops rows.

Wire it into the existing `itinerary_days_scrub_activities` trigger BEFORE the row-drop call, so the strip runs first and the drop only fires on truly broken rows:
```
NEW.activities := public._strip_prompt_artifacts_in_activities(NEW.activities);
NEW.activities := public.scrub_itinerary_activities(NEW.activities);
```

### 3. One-shot backfill (same migration)
UPDATE `itinerary_days.activities` AND `trips.itinerary_data` for rows updated in the last 14 days where the new regex hits. Run `_strip_prompt_artifacts_in_activities` / `_scrub_itinerary_prompt_artifacts` over them. Last round's backfill ran the old regex against `_scrub_itinerary_prompt_artifacts` after the regex update, so this re-run is just a safety pass that will also catch any trips written between now and the previous backfill.

## Tests

Add to `src/utils/__tests__/activityNameSanitizer.test.ts` (create if missing):
- `sanitizeActivityName("Anniversary Wellness Ritual (INTEREST_SLOT)")` → `"Anniversary Wellness Ritual"`.
- `sanitizeActivityName("Open Afternoon - Wander Castello (FLEX_WINDOW)")` → `"Open Afternoon - Wander Castello"`.
- `sanitizeActivityName("Dinner (AESTHETIC slot)")` → `"Dinner"`.
- `sanitizeActivityName("Visit MoMA (NYC)")` → unchanged.

DB-side: in the migration, run a SELECT round-trip to assert `_strip_prompt_artifacts_in_activities` removes `(INTEREST_SLOT)` from a synthetic row but leaves `(NYC)` alone.

## What this does NOT change

- No prompt edits — the generator can keep emitting forced-interest descriptions; we just refuse to let the literal token survive to the user.
- No locking, no cost logic, no cross-city sweep, no row-drop semantics for legitimately broken rows (still dropped by `scrub_itinerary_activities`).

## Files

- Edit `src/utils/activityNameSanitizer.ts`
- New `src/utils/__tests__/activityNameSanitizer.artifacts.test.ts` (or extend existing `activityNameSanitizer.test.ts`)
- New migration:
  - `CREATE OR REPLACE FUNCTION public._strip_prompt_artifacts_in_activities(jsonb)`
  - `CREATE OR REPLACE FUNCTION public.itinerary_days_scrub_activities()` — call strip before drop
  - 14-day backfill UPDATE on `itinerary_days` and `trips`

## Memory update after fix

Append to `mem://technical/itinerary/stateful-regex-strip-bug`:
- Card title render goes through `sanitizeActivityName`, NOT `sanitizeText`. Prompt-artifact strip MUST live in BOTH.
- DB trigger on `itinerary_days` must STRIP titles before it considers DROPPING rows — forced-interest activities are otherwise lost or rendered with the raw `(INTEREST_SLOT)` / `(FLEX_WINDOW)` token.
- Layer count is now SIX, all using the same regex: browser contract, edge contract, edge title-strip, `sanitizeText`, `sanitizeActivityName`, DB trigger.
