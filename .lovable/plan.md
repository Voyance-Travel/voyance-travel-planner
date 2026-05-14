Root cause found: the card is not primarily created by the renderer. It is created late in generation by the final meal guard, then a later validation gate turns it into the exact floating shape.

Concrete failure chain:

1. On departure days without usable return flight time, meal policy becomes `midday_departure` and requires lunch.
2. `enforceRequiredMealsFinalGuard` injects a real lunch card, usually with `startTime: "12:30"` and `endTime: "13:30"`.
3. That lunch is after checkout.
4. `validateDay.checkDepartureChronology` flags it as critical `LOGISTICS_SEQUENCE` with `field: "startTime"`.
5. `applyValidationGate` has no explicit handler for `LOGISTICS_SEQUENCE`, so its default critical handler blanks the field instead of dropping the activity:
   - before: `Lunch: Sobanomi Yoshimura`, `startTime: "12:30"`
   - after: `Lunch: Sobanomi Yoshimura`, `startTime: ""`, `endTime: "13:30"`
6. The chain-generation path persists directly through `persistTripItinerary`; it does not go through `action-save-itinerary` Step 2.65, so the later departure-day cleanup never runs.
7. `action-sync-tables` mirrors the bad JSON into `itinerary_activities`, preserving `start_time = ''`.

I confirmed this in live data. Example: trip `e9ce51de-0815-41d8-a81b-e95bf241041c` has departure-day lunch `Lunch: Sobanomi Yoshimura` with blank `startTime`, after checkout. Its metadata shows it was injected by `generate-trip-day:final-per-day`, then final validation forced persist.

Plan to truly fix it:

1. Fix the validator/gate behavior
   - Add an explicit `LOGISTICS_SEQUENCE` critical handler in `validation-gate.ts`.
   - For post-checkout non-logistics activities, drop the activity instead of blanking `startTime`.
   - This prevents the gate from manufacturing floating cards.

2. Add a last-mile departure net to the chain-generation persist path
   - Run `enforceDepartureDayLogistics` after all late mutators in `action-generate-trip-day.ts`, immediately before final `persistTripItinerary` and table sync.
   - This covers anything injected after repair-day: meal guard, gap fill, final validation gate, cross-day dedup, or any future late pass.

3. Harden table sync
   - In `action-sync-tables.ts`, before writing normalized rows, prune departure-day untimed/post-checkout non-logistics cards using the same departure-day rule.
   - Also replace old rows for a day before inserting synced activities, so stale floating rows cannot survive from a previous bad sync.

4. Add regression tests for the real bug shape
   - Test: final meal guard injects lunch after checkout; final validation gate must not blank `startTime` and persist it.
   - Test: direct table sync never writes untimed dining on the last day.
   - Test: chain finalization emits no departure-day dining cards with empty `startTime/start_time/time`.

5. Backfill existing affected trips
   - One-time cleanup: remove non-locked departure-day dining/leisure cards with no start time from both `trips.itinerary_data` and `itinerary_activities`.
   - Validate with the query I used: zero last-day dining cards where `startTime/start_time/time` are empty.

This is the root fix: stop blanking the time field, and add the final departure net at the actual direct persist path that currently bypasses the save-time cleanup.