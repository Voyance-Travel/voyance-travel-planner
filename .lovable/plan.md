## Bug

Day 2 lists **Pâtisserie Riviera** as both 8:30 AM breakfast AND 1:57 PM lunch, with two different addresses and a lunch description claiming it's a pasta-with-truffle restaurant. Three problems combined:

1. **No same-day venue-name dedup.** Cross-day dedup exists (ledger-check), but nothing blocks the same venue name from filling two meal slots on the same day.
2. **Nuclear placeholder sweeps don't seed `usedNames` from existing real dining.** `nuclearPlaceholderSweep` and `nuclearDiningStrip` (`fix-placeholders.ts:836,911`) start with an empty `Set`, so a late-pass replacement can pick the same venue the AI already used earlier in the day.
3. **No name/description coherence check** — a "Pâtisserie / Boulangerie / Café" titled venue with a "pasta / pizza / sushi / steak / ramen" description ships unflagged. Either the AI hallucinated, or the fallback DB has two unrelated records sharing a display name; either way validation should catch it.

## Plan

### 1. Same-day duplicate-venue validator + repair (single boundary)

Add `checkSameDayDuplicateVenues(activities)` to `supabase/functions/generate-itinerary/pipeline/validation-gate.ts`:
- Walk dining + restaurant + cafe categories per day.
- Normalize venue name (lowercase, strip "at "/"breakfast at "/"lunch at " prefix, strip diacritics, drop punctuation).
- When the same normalized name appears twice in one day, emit `DUPLICATE_VENUE_SAME_DAY` (severity: critical).
- Repair: keep the **earliest** occurrence, re-resolve the later one via `resolveAnyMealFallback(city, mealType, usedNamesSeededWithDayDining)` + `applyFallbackToActivity`. If the resolver returns the same name again (city pool exhausted), downgrade later slot to `unverifiedMealSentinel` (`needsVenuePick`, $0).
- Wire into the existing `applyValidationGate` flow so it runs at repair-day §10b and at `action-save-itinerary normalizeDays`.

### 2. Seed nuclear sweeps with existing real dining names

In `nuclearPlaceholderSweep` and `nuclearDiningStrip` (`fix-placeholders.ts`):
- Before the loop, walk `activities` once and seed `usedNames` with normalized names of every existing non-placeholder dining/restaurant/cafe row (not just the ones the loop replaces).
- Closes the late-pass recycling path that lets meal #2 land on meal #1's venue.

### 3. Name/description coherence validator

Add `checkVenueDescriptionCoherence(activity)` in the same validation-gate file:
- Title-side regex groups: `pâtisserie|patisserie|boulangerie|bakery|café|cafe|coffee|tea house|crêperie|gelateria|ice cream|juice|smoothie`.
- Description-side mismatch tokens for each group (e.g. for bakery/café: `pasta|pizza|ramen|sushi|steak|burger|tacos|paella|risotto|truffle pasta|prime rib`).
- On mismatch emit `VENUE_DESCRIPTION_MISMATCH` (severity: warning) → blank `description`. The existing `_shared/description-fill.ts` post-pass will refill a coherent blurb (cuisine inferred from title).
- Optional: same check at UI sanitizer (`activityNameSanitizer.ts`) read-time as a last-resort blank for already-persisted trips.

### 4. Memory + tests

- New constraint memory: `mem://constraints/itinerary/same-day-venue-uniqueness` summarizing the three layers, sentinels (`[VALIDATION_GATE] DUPLICATE_VENUE_SAME_DAY`, `[VALIDATION_GATE] VENUE_DESCRIPTION_MISMATCH`, `[NUCLEAR] dedup-seeded-from-existing`).
- Unit tests under `supabase/functions/generate-itinerary/__tests__/`:
  - `duplicate-venue-same-day.test.ts` — two breakfast+lunch rows w/ identical normalized name → second is re-resolved or sentinelized.
  - `venue-description-mismatch.test.ts` — "Pâtisserie X" + "truffle pasta" description → description blanked.
  - `nuclear-sweep-seeds-existing-dining.test.ts` — existing real lunch venue is excluded from the breakfast placeholder fill pool.

## Out of scope

- The actual fallback-DB row(s) named "Pâtisserie Riviera" — if curation finds two distinct records sharing a display name, that's a separate data fix; the validator above handles the symptom regardless.
- Cross-day dedup, ledger-check meal-recurrence rules, cost reconciliation. Untouched.
- No changes to `action-save-itinerary` cost path, snapshot, header strip, or Payments tab.
