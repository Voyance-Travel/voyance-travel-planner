
Diagnosis

- The repeated error `A listener indicated an asynchronous response...` is almost certainly browser-extension/runtime noise, not the root app bug.
- The real failure is this chain:
  1. frontend calls `generate-itinerary`
  2. day generation reaches Day 5
  3. edge function throws `TypeError: (paramMustDoActivities || "").split is not a function`
  4. browser surfaces that failed cross-origin request as a CORS error
- So the CORS message is a symptom of the server crash, not the primary cause.

Confirmed root cause in this codebase

- `mustDoActivities` is inconsistent across flows:
  - `src/pages/Start.tsx` stores it as an array in metadata
  - `src/contexts/TripPlannerContext.tsx` stores it as a string
  - `src/components/itinerary/ItineraryGenerator.tsx` forwards `tripMeta.mustDoActivities` with a string cast, but arrays still pass through at runtime
- The backend still assumes `mustDoActivities` is always a string in multiple places:
  - `supabase/functions/generate-itinerary/action-generate-day.ts` line using `(paramMustDoActivities || '').split(/[,\n]/)`
  - `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` line using `(paramMustDoActivities || '').split(',')`
- `compile-prompt.ts` already has a safe normalization earlier (`requestMustDoText`), but later falls back to the unsafe raw param again.

Implementation plan

1. Standardize `mustDoActivities` handling
- Pick one canonical shape for the generation pipeline.
- Best approach: accept `string | string[] | null` at inputs, then normalize immediately to:
  - `mustDoText: string`
  - `mustDoList: string[]`

2. Harden the backend first
- Add a small shared normalizer inside the generation pipeline or `action-generate-day.ts`.
- Replace every raw `.split(...)` on `paramMustDoActivities` with the normalized value.
- Specifically update:
  - `supabase/functions/generate-itinerary/action-generate-day.ts`
  - `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

3. Normalize frontend payloads too
- In `src/components/itinerary/ItineraryGenerator.tsx`, stop forwarding metadata with a misleading string cast.
- In `src/hooks/useItineraryGeneration.ts`, keep the same shape consistently when invoking the edge function.
- This avoids future regressions even if backend is hardened.

4. Preserve shape through server chaining
- Review `generate-trip -> generate-trip-day -> generate-day` chaining and make sure the normalized value is forwarded consistently instead of depending on mixed metadata shapes.

5. Add targeted diagnostics
- Log the incoming type of `mustDoActivities` at the start of day generation.
- Log whether it arrived as string vs array before prompt compilation.
- Remove these logs after verification.

6. Redeploy and verify
- Redeploy `generate-itinerary`.
- Verify from the published domain that:
  - Day 5 no longer throws 500
  - the browser no longer shows the CORS failure for this request
  - must-do activities still appear in prompt generation

Technical details

- Likely offending paths:
  - `src/pages/Start.tsx` saves arrays
  - `src/components/itinerary/ItineraryGenerator.tsx` forwards metadata without true normalization
  - `supabase/functions/generate-itinerary/action-generate-day.ts` assumes string
  - `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` partially normalizes, then regresses
- No database schema change is needed.
- This is primarily a runtime type-safety bug in the generation pipeline.
