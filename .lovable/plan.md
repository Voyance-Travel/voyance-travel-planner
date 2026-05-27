# Canonical Preference Spine — root-cause plan

## Diagnosis

This looks like the same class of problem as timing: we have many preference representations, but no single authoritative lifecycle.

Current flow is roughly:

```text
Start Step 3 / chat / context form
  -> trips.metadata blobs
     - mustDoActivities
     - additionalNotes
     - generationRules
     - pacing
     - isFirstTimeVisitor / firstTimePerCity
     - userAnchors
     - perDayActivities
  -> best-effort trip_day_intents seeding
  -> compile-prompt mixes metadata + params + trip_day_intents + legacy fallbacks
  -> Day Brief prompt asks model to honor wishes
  -> repair/save checks restore hard anchors, but soft preferences are mostly warnings/prompt-only
```

The likely root issue is not that one preference field is missing; it is that preferences are split across metadata blobs, `trip_day_intents`, `userAnchors`, generation params, and prompt-only text. Some layers treat “sushi lunch” as a soft wish, some as a must-do, some as trip-wide notes, and some ignore it if a partial structured table already exists.

## Highest-risk breakpoints found

1. **Partial `trip_day_intents` masks metadata fallback**
   - `compile-prompt.ts` uses structured rows when any rows exist, and only falls back to metadata if the structured table is empty.
   - If seeding writes only some preferences, the remaining metadata preferences can disappear from the Day Brief.

2. **Seeding is non-blocking even when preferences exist**
   - `seedDayIntentsFromMetadata` logs and returns `0` on failures.
   - Generation continues, so a trip can build with no durable preference rows even though Step 3 had preferences.

3. **Soft preferences are prompt-only, not enforced**
   - Day Ledger renders `USER WISHES`, but only missing `must` intents get restored/placeholder behavior.
   - A user can say “spa”, “sushi lunch”, “hidden gems”, or “avoid touristy stuff” and we mostly hope the model follows it.

4. **Step 3 fields do not all become canonical intents**
   - `mustDoActivities` and timed `perDayActivities` get most attention.
   - `additionalNotes`, `generationRules`, pacing, first-time/returning visitor, and category interests are scattered into prompt blocks, not normalized into one inspectable contract.

5. **Multiple generation paths pass different preference payloads**
   - Start page trip creation saves rich metadata.
   - ItineraryPreview context form writes a subset.
   - Legacy `generate-day` paths pass `mustDoActivities`, `interestCategories`, `generationRules`, `pacing`, but not consistently all structured data.
   - Server-chain relies on DB metadata and seeding.

6. **Long multi-city split can drop or misassign generic preferences**
   - `splitJourneyIfNeeded` filters `mustDoActivities` by city name or assigns unqualified items to leg 1.
   - Trip-wide preferences may not survive as trip-wide intent rows for later legs.

## Plan

### Step 1 — Add a canonical preference spine module

Create one backend helper, likely `supabase/functions/_shared/preference-spine.ts`, that owns:

- `collectPreferenceSources(trip, params?)`
- `normalizeTripPreferencesToIntents(...)`
- `classifyIntentHardness(...)` — hard lock vs soft wish vs constraint vs avoid
- `assignIntentScope(...)` — day-specific, city-specific, trip-wide, leg-wide
- `summarizePreferenceCoverage(...)`

It should produce one canonical `PreferenceSnapshot`:

```text
PreferenceSnapshot
  sources: metadata | params | trip_day_intents | userAnchors | generationRules
  intents: canonical rows
  constraints: avoid / dietary / mobility / pacing / first-time / budget style
  coverage: expected count, seeded count, prompt count, fulfilled count
  warnings: lost, ambiguous, partial, masked-by-table
```

### Step 2 — Make intent seeding mandatory when preferences exist

Refactor `seedDayIntentsFromMetadata` into two modes:

- **best-effort** for legacy/background repairs
- **generation-critical** for fresh generation

Fresh generation should not continue silently if:

- Step 3 metadata contains preferences, but
- normalized intent count is > 0, and
- persisted `trip_day_intents` count is 0 or materially partial.

Instead, stamp a clear health code and stop before the AI call, rather than generating a generic itinerary.

### Step 3 — Stop partial structured rows from hiding metadata

Change prompt compilation so it does not use this rule:

```text
if trip_day_intents exists, ignore legacy metadata fallback
```

Replace with:

```text
canonical snapshot = merge(structured rows + metadata-derived rows)
dedupe by normalized source/title/day/time
structured rows win on status/fulfillment
metadata-derived rows fill gaps
```

This directly targets the “we fixed it but still lose preferences” pattern.

### Step 4 — Convert Step 3 UI outputs into canonical intents at creation time

Update trip creation paths so Start Step 3, chat planner, and context form all write the same intent contract:

- selected landmarks/custom must-dos → activity/restaurant/spa intents
- `additionalNotes` → parsed actionable intents + trip-wide note constraints
- `generationRules` → constraint/avoid/time-block intents
- pacing → explicit pacing constraint
- first-time/returning visitor → explicit city preference constraint
- per-city first-time settings → city-scoped constraints

Keep metadata for compatibility, but treat `trip_day_intents` + `PreferenceSnapshot` as the source of truth for generation.

### Step 5 — Strengthen Day Brief from “prompt suggestion” to “contract”

Update `day-ledger.ts` so all user preferences have an enforceable status:

- **must**: exact item/time/venue must appear or a visible repair placeholder is inserted
- **should**: at least one semantic match must appear somewhere in the trip unless impossible
- **avoid/constraint**: must be checked after generation, not just written in the prompt

Add a `preference_trace` per day:

```text
metadata.quality.preference_trace.dayN[]
  stage: seed | compile | ai_output | repair | save | fulfillment
  expectedIntents
  promptIntents
  matchedIntents
  missingMust
  missingShould
  violatedAvoid
```

### Step 6 — Add semantic fulfillment checks, not title-only matching

Current fulfillment matching is title-heavy. Add a canonical matcher for:

- cuisine/category wishes: “sushi lunch”, “rooftop drinks”, “spa”
- vibe wishes: “hidden gems”, “not touristy”, “slow pace”
- avoid rules: “no seafood”, “avoid museums”, “don’t repeat tourist staples”
- venue wishes: exact venue/name/address

This prevents soft preferences from being considered untestable.

### Step 7 — Protect preferences through post-generation cleanup

Audit and patch post-generation passes that can erase preference-driven activities:

- repair-day
- universal-quality-pass
- meal guard
- cross-city filters
- ledger-check
- persist contract
- action-save-itinerary final sweeps

Any dropped activity with `isUserRequested`, `anchorSource`, `intentId`, or semantic intent match should emit a trace entry and require a replacement that still satisfies the intent.

### Step 8 — Multi-city preference propagation

Fix long-trip split behavior so trip-wide preferences are copied to every leg as trip-wide rows, while city/day-specific wishes are scoped to the correct leg.

Do not assign generic wishes only to leg 1 unless the user clearly tied them to the first city.

### Step 9 — Add regression tests around real failure shapes

Add tests for:

- Step 3 “sushi lunch + spa + hidden gems” produces scheduled real venues, not generic placeholders.
- `additionalNotes` with “avoid touristy stuff” survives into Day Brief and post-generation validation.
- Partial `trip_day_intents` does not mask `metadata.mustDoActivities` or `additionalNotes`.
- Multi-city split preserves trip-wide preferences across all legs.
- Soft “should” preferences generate a missing-preference health code if no semantic match appears.
- Existing hard-anchor tests continue to pass.

### Step 10 — One-time diagnostic/backfill

Add a read-only audit function/report for existing trips:

```text
trip metadata preferences
vs trip_day_intents rows
vs Day Brief prompt intents
vs final itinerary matches
```

Use it to find trips where preferences exist in metadata but were never seeded, masked, or fulfilled. For safe cases, backfill missing `trip_day_intents` rows from metadata without changing the itinerary.

## Success criteria

- Every Step 3 preference appears in a canonical preference snapshot before generation.
- Generation refuses to proceed silently when preferences cannot be seeded.
- Prompt compilation never loses metadata preferences because a partial structured table exists.
- Soft preferences are checked semantically after generation.
- Preference loss becomes visible in `metadata.quality.preference_trace`, not hidden in logs.
- Multi-city legs preserve trip-wide and city-scoped preferences correctly.