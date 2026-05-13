## Log report

I checked the live backend logs and current saved trip data for the recent Mexico City generation (`07fc6366-8265-403a-9aa5-a9850d00a414`).

### What is confirmed fixed in code

The three prior timing patches are present in `supabase/functions/_shared/timing-cascade.ts`:

- P0a clamp instead of delete: present.
  - `Drop activities pushed past` = 0
  - `Clamp activities pushed past` = 1
  - `dropped_past_midnight` = 1, only the type remains
  - `act.startTime = newStart` = 1
- P0b cumulative shift cap: present.
  - `MAX_CUMULATIVE_SHIFT` = 4
  - `cumulativeShiftById` = 3
  - `cumulative shift cap` = 1
  - old `minutesToTime(s + delta)` = 0
  - new `minutesToTime(s + applyDelta)` = 1
- P0c floating-meal real-content guard: present.
  - `FLOATING_MEAL_PROMOTE` = 1
  - `Content preservation is non-negotiable` = 1
  - `FLOATING_MEAL_DROP` = 1

### What the logs show about descriptions

The backend description filler did run and reported success:

- `[DESC_FILL] day=1 flagged=1 filled=1 skipped=0`
- `[DESC_FILL_POST_GUARD] day=1 ... flagged=1 filled=1 skipped=0`
- `[DESC_FILL] day=3 flagged=1 filled=1 skipped=0`
- `[DESC_FILL_POST_GUARD] day=3 ... flagged=1 filled=1 skipped=0`

The current saved database data also has restaurant descriptions:

- `trips.itinerary_data`: 9 dining cards, 0 blank dining descriptions.
- `itinerary_days`: Day 1 / Day 2 / Day 3 each has 3 dining cards, 0 blank dining descriptions.
- A recent-database scan found no recently updated trip with blank persisted dining descriptions.

So the backend is currently saving descriptions, but the user can still see “no descriptions” because the UI hides restaurant blurbs in one branch.

### Root cause found for visible “no restaurant descriptions”

In `src/components/itinerary/EditorialItinerary.tsx`, restaurant cards that have a venue go through a “venue branch.” In that branch, description rendering is gated by `!compact`.

`compactCards` is enabled for manual mode or `smart_finish` trips:

```tsx
compactCards={isManualMode || creationSource === 'smart_finish'}
```

That means restaurant descriptions can exist in the saved JSON, but still not appear on the card in compact/smart-finish/manual layouts. This matches the user symptom: “restaurants still have no descriptions,” even though the persisted data has descriptions.

### What the logs show about refresh/day mutation

There were three blocked mutation attempts shortly after generation:

- `00:46:27` attempted save: old `22 meaningful / 20 paid`, attempted `13 meaningful / 7 paid` — blocked.
- `00:46:48` same downgrade attempt — blocked.
- `00:46:58` same downgrade attempt — blocked.

This means a save path is still attempting to overwrite a healthy itinerary with a smaller/mutated one. The regression guard protected the database, but the attempted downgraded payload can still affect local UI state before resync.

Also, `metadata.persist_validation` is stale and wrong:

- It claims missing Day 1/2/3 meals.
- Current saved itinerary has breakfast/lunch/dinner cards on those days.
- The stale validation was checked at `00:46:57`, but the trip was later updated to `ready` at `00:47:48`.

So generation reached ready, but the validation metadata was not refreshed/cleared against the final persisted itinerary. That can make the app look broken after refresh even when the current saved itinerary is healthier.

### Additional issue found

One saved dining card has an `endTime` but no `startTime`:

- Day 1: `Lunch at El Turix`, `endTime=13:30`, `startTime` blank.

The current floating meal assigner skips cards that have `endTime`, even if they have no `startTime` and no duration. That leaves a partially timed meal and can contribute to ordering/validation weirdness.

## Fix plan

### 1. Make restaurant descriptions visible in compact cards

Update `EditorialItinerary.tsx` so dining/restaurant cards render their resolved description even when `compact=true`, specifically in the venue branch that currently uses `!compact`.

Implementation intent:

```tsx
const shouldShowDescription = !compact || isDiningLikeActivity(activity);
```

Then render the existing `resolveActivityDisplayDescription(...)` result for dining cards in compact mode.

This is the direct fix for “restaurants still have no descriptions” when the data is present but hidden.

### 2. Stop stale validation metadata from surviving final generation

Update the final generation persist path so when a trip transitions to `ready`, it either:

- runs `validateItineraryForPersist` against the final `partialItinerary.days`, after meal fills/bookends/persist-net cleanup, and stamps fresh `metadata.persist_validation`, or
- clears stale non-ok `persist_validation` if the final itinerary is ready and valid.

The goal: a ready trip cannot carry old “missing meals” errors from a rejected/intermediate save.

### 3. Ensure regression-blocked saves force a canonical resync

Update the client save wrapper and any direct self-heal save calls so a `regressionBlocked` response immediately re-reads canonical DB itinerary data and does not leave the attempted downgraded payload in local state.

Scope:

- `src/services/safeUpdateItineraryData.ts`
- direct `save-itinerary` invokes in `TripDetail.tsx` self-heal/version-restore/placeholder paths

This keeps the UI from showing the attempted 13-activity mutated plan when the database preserved the healthier 22-activity plan.

### 4. Add source labels to mutation attempts

Pass a `saveReason` for user/editor saves too, not only `skipLedgerCheck` saves, so future rejected attempts show the real caller instead of generic `save-itinerary` / `unspecified`.

This makes the next incident traceable in one log query.

### 5. Fix endTime-only dining cards

Update `assignFloatingMealTimes` so a meal with no `startTime`, no duration, but an `endTime` is not skipped. For dining cards, compute a sensible `startTime` from the meal slot or from `endTime - default meal duration`.

This prevents cards like `Lunch at El Turix` from persisting with a blank start time.

### 6. Add focused regression tests

Add/extend tests for:

- compact restaurant cards still render descriptions,
- ready generation does not retain stale missing-meal validation metadata,
- regression-blocked saves trigger canonical resync behavior,
- endTime-only dining cards get a start time instead of floating/partially timed persistence.

## Expected outcome

- Restaurants with descriptions in saved data will show descriptions in the UI.
- Refresh/self-heal paths should stop visibly mutating healthy days.
- Stale validation warnings should no longer contradict the actual saved itinerary.
- Future logs will identify which save path attempted any downgrade.