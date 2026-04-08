
Diagnosis

- This is another runtime crash, not a primary CORS configuration issue.
- The latest edge logs point to: `ReferenceError: _departureTransportType is not defined` in `action-generate-day.ts`.
- In the current source, `_departureTransportType` is declared inside the temporary universal-quality-pass block, then referenced later by the meal guard and terminal cleanup, so it is out of scope.
- `action-generate-trip-day.ts` has the same latent scoping bug: `arrTime24`, `depTime24`, and `departureTransportType` are declared inside the validate/repair block but reused later by the universal quality pass and terminal cleanup.
- That runtime failure is what the browser is surfacing as repeated 500s plus a misleading CORS error.

Implementation plan

1. Fix `action-generate-day.ts`
   - Hoist departure transport detection into a shared variable that lives for the full handler once `flightContext` is available.
   - Reuse that same variable in:
     - universal quality pass
     - meal guard departure-buffer logic
     - terminal cleanup
   - Keep the existing train-vs-flight detection logic unchanged to minimize behavior changes.

2. Fix `action-generate-trip-day.ts`
   - Hoist `arrTime24`, `depTime24`, and `departureTransportType` so they are defined outside the current validate/repair block and remain available to all later post-processing steps.
   - Reuse them in:
     - validate/repair input
     - universal quality pass
     - final per-day terminal cleanup loop

3. Do not start with CORS/header changes
   - The edge function already has CORS handling in `index.ts` and shared response helpers.
   - The priority is removing the scope error that is causing the 500.

Files to update

- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`

Verification

- Re-run the same Day 1 regeneration flow.
- Confirm the request returns 200 instead of 500.
- Confirm retries stop after the first successful response.
- Confirm edge logs no longer show `_departureTransportType is not defined`.
- If a CORS message still appears after this runtime fix, inspect actual response headers separately.
