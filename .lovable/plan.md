## Root cause

The "floating dining card on every departure day" is the **`preserveAsManualPick` exemption colliding with the meal-persist invariant** in `action-save-itinerary.ts`.

Trace:

1. **STEP 2.6 — meal-persist invariant** (`action-save-itinerary.ts` lines ~743–810) iterates every day, including the last one. If `detectMealSlots` doesn't see a meal that `deriveMealPolicy` requires, it pushes a sentinel card:
   - `title: "Lunch — find a local spot in <city>"` / `"Dinner — …"`
   - Hard-coded times: breakfast 08:30–09:30, lunch **12:30–13:30**, dinner **19:30–21:00**
   - `metadata.preserveAsManualPick: true`, `needsVenuePick: true`
2. **STEP 2.65 — §15z save-time net** runs right after on the last day. Its `isExempt(a)` check returns `true` for `metadata.preserveAsManualPick`, so the just-injected sentinel is **never evaluated against the transfer cutoff**.
3. With a typical departure (e.g. 21:00 flight → transfer at ~18:00, or 14:00 flight → transfer at ~11:00), the sentinel's hard-coded slot lands **after** the transfer, producing the visible "dining card after the airport transfer" pattern. The UI renders it without a time chip because `needsVenuePick` / `preserveAsManualPick` cards are styled as unverified placeholders.

This explains the 12/12 reproduction: any departure day where the model didn't emit a real lunch/dinner before the transfer trips this — and on a departure day there usually isn't one, by design.

## Fix (two layers, repair-day owns the contract; save mirrors)

### 1. `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — §15z

In `enforceDepartureDayLogistics`, narrow the `isExempt` rule **on departure days**:

- `userAdded` / `userEdited` / `isManual` / `extracted` / `pinned` and explicit lock signals stay fully exempt (user intent is sacred).
- `metadata.preserveAsManualPick` (system-injected sentinel) is **no longer exempt** when:
  - the row has no placeable start time (`pickStart(a) < 0`), **or**
  - the row's start sits at/after `cutoffMin` (transfer start, or noon when no flight).
  
  In those cases the sentinel is dropped with a new repair action `final_enforce_dropped_manual_pick_post_transfer` and sentinel log `[DEPARTURE_MANUAL_PICK_PRUNED]`.

A preserveAsManualPick sentinel that *does* fit cleanly before the cutoff (e.g. breakfast at 08:30 with a 14:00 flight) is still kept — that's correct behavior.

### 2. `supabase/functions/generate-itinerary/action-save-itinerary.ts` — STEP 2.6 (don't inject the impossible meal in the first place)

When the day is the last day and we have `savedDepartureTime24`:

- Compute `transferCutoffMin = depMin − buffer` (`180` for flight, `120` for train; mirror existing constants used in §15z).
- Filter `stillMissing` so we only inject a sentinel when `SLOT_TIMES[meal].start` is **≥ 60 min** before `transferCutoffMin`. Otherwise log `[MEAL_PERSIST_SKIP_DEPARTURE] day=N meal=lunch slot=12:30 cutoff=11:00` and skip.

This keeps the invariant honest (no silent meal deletion on normal days) while preventing the pathological "inject lunch at 12:30 even though we're already at the airport at 11:00" case.

### 3. Tests

- `supabase/functions/generate-itinerary/__tests__/departure-day-manual-pick-prune.test.ts` (new):
  - Departure 21:00 flight + injected dinner sentinel at 19:30 with `preserveAsManualPick:true` → §15z drops it.
  - Departure 14:00 flight + injected lunch sentinel at 12:30 with `preserveAsManualPick:true` → §15z drops it.
  - Departure 22:00 flight + injected breakfast sentinel at 08:30 with `preserveAsManualPick:true` → kept.
  - User-added (`userAdded:true`) untimed dining on departure day → still kept (sacred).
- `supabase/functions/generate-itinerary/__tests__/save-itinerary-departure-day.test.ts` (extend):
  - 14:00 flight + missing lunch → STEP 2.6 logs `MEAL_PERSIST_SKIP_DEPARTURE` and does not inject.

### 4. Memory

Update `mem://constraints/itinerary/departure-day-save-time-enforcement` to record the new rule:

> System-injected `preserveAsManualPick` meal sentinels are NOT exempt from §15z on departure days when they fall at/after transfer cutoff or are untimed. User-added rows remain fully exempt. STEP 2.6 also pre-filters `stillMissing` against `transferCutoffMin − 60` to avoid injecting impossible meals.

## Out of scope

- No prompt changes — this is purely a save-time / repair contract fix.
- UI rendering of `preserveAsManualPick` cards is unchanged; the cards just won't be persisted on departure days when impossible.
- Non-departure days continue to use the meal-persist invariant exactly as today.
