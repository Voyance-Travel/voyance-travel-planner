## What the issue is

The UI error is misleading. The launcher is not timing out because it is slow; Day 1 is crashing in the backend, then the launcher watchdog reports it as a timeout.

Current log root cause:

```text
TypeError: validationResults is not iterable
at repairDay (.../pipeline/repair-day.ts)
at handleGenerateTripDayV2 (.../v2/generate-trip-day-v2.ts)
```

## Why this keeps happening

The project recently switched itinerary generation to the new `v2` chain. That wrapper is calling older pipeline helpers (`repairDay`, validation, enrichment, etc.) but did not pass the full input contract those helpers require.

The previous fix handled one missing v2 field: `lockedActivities`.

The next crash is the same class of bug: `repairDay` requires `validationResults: ValidationResult[]`, but `v2/generate-trip-day-v2.ts` calls `repairDay()` before running `validateDay()` and passes no `validationResults`. So `repairDay` later does:

```ts
for (const vr of validationResults)
```

…but `validationResults` is `undefined`, causing the fatal crash.

## What we broke

Not the frontend. Not the trip itself. The breakage is in the backend v2 generation orchestration contract:

```text
v2 wrapper → old repair helper
          → missing required fields
          → runtime TypeError
          → Day 1 returns 500
          → launcher retries 3x
          → watchdog surfaces “launcher timed out”
```

## Fix plan

1. **Move validation before repair in v2**
   - In `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts`, run `validateDay()` on `ai.day` before `repairDay()`.
   - Pass the resulting `validationResults` into `repairDay()`.
   - Keep the existing post-repair validation gate, but rename/reuse it as the second validation pass after repair.

2. **Pass the full v1-compatible repair context from v2**
   - Add the missing repair inputs already available from `facts`/`dayFacts`, including:
     - `isFirstDay`, `isLastDay`
     - `arrivalTime24`, `returnDepartureTime24`
     - `hotelName`, `hotelAddress`, `hasHotel`, `hotelCoordinates`
     - `lockedActivities: dayFacts.lockedActivities ?? []`
     - `restaurantPool: []`, `usedRestaurants: []`
     - `budgetTier`, destination context, transition flags where available

3. **Add a defensive default in `repairDay`**
   - Change the destructure so `validationResults` defaults to `[]`.
   - This prevents future v2/v1 contract drift from turning into a fatal TypeError.
   - This is a safety net, not the primary fix; v2 should still pass real validation results.

4. **Verify with logs and a direct function test**
   - Redeploy only `generate-itinerary`.
   - Trigger the generation path and confirm the old fatal log is gone:
     - no `validationResults is not iterable`
     - no `V2_FATAL` from `repair_day`
     - no `LAUNCHER_TIMEOUT`
   - If another required-field mismatch appears, fix that single mismatch in the same v2 wrapper contract rather than patching blindly.

## Files to change

- `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts`
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts`

## Expected outcome

Day 1 should stop crashing after the AI call, so the launcher should actually start generation instead of retrying until the watchdog emits the timeout message.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>