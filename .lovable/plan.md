## Issue 1 Fix Plan — Day 1 ignores the flight arrival the user already entered

### Root causes confirmed in the code
1. **Silent parse skip** in `flight-hotel-context.ts:236` — if `outboundArrival` is an ISO datetime, it falls through to `new Date(...).toTimeString()` (TZ-dependent). If parsing returns `null`, `arrivalTime24` becomes `undefined`.
2. **Silently skipped prompt block** in `compile-prompt.ts:1284-1306` — the entire ARRIVAL TIMING block renders empty when `arrivalTime24` is undefined. The LLM gets no Day 1 constraint, defaults to 12:00, and a post-hoc `FlightSyncWarning` flags the mismatch the system itself created.
3. **Wrong leg picked** for multi-leg trips — `flight-hotel-context.ts:210-213` reads only `flightRaw.departure.arrival.time` and never consults `legs[].isDestinationArrival`. The shared `getDestinationArrivalLeg` normalizer in `src/utils/normalizeFlightSelection.ts` already does this correctly — the edge function isn't using it.
4. **Post-hoc band-aids** (`enforceArrivalTiming`, `Repair injected arrival flight + airport transfer`, `FlightSyncWarning` toast) try to mop up after generation instead of preventing the mistake.

### What to change

1. **`supabase/functions/_shared/flight-leg-pick.ts`** (new shared helper, edge-fn safe port of `getDestinationArrivalLeg` + `getDestinationDepartureLeg`). Accepts either legacy `{departure, return}` or `{legs[]}` shape, prefers `isDestinationArrival` flag, falls back to the heuristic the frontend already uses. Single source of truth for both surfaces.

2. **`supabase/functions/generate-itinerary/flight-hotel-context.ts`**
   - Replace lines 207-220 with one call to the new helper for the outbound leg and one for the return leg.
   - Harden `normalizeTo24h` (lines 93-97): explicitly handle ISO 8601 (`YYYY-MM-DDTHH:MM…`) by extracting the `HH:MM` portion via regex BEFORE falling back to `Date.toTimeString` (which is TZ-dependent inside Deno).
   - **Fail loud**: when `outboundArrival` is present but `arrivalTime24` ends up undefined, emit `[FLIGHT_INGEST_PARSE_FAIL] raw="<value>" shape="<legacy|legs>"` and stamp `flightContext.parseFailed = true` so the next step can pick a safe default instead of skipping.

3. **`supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts`** — after building `flightContext` and only when `isFirstDay`, assert that either `arrivalTime24` is set OR `flight_selection` is absent. If `flight_selection` exists but `arrivalTime24` is missing (parse failure), inject a **soft fallback** rule: `Day 1 first non-transport activity at or after 15:00 (flight arrival time was provided but could not be parsed: "<raw>" — be conservative)`. This guarantees Day 1 never starts at 12:00 when a flight was entered.

4. **`supabase/functions/generate-itinerary/pipeline/compile-prompt.ts:1284-1306`** — change the guard so the ARRIVAL block always renders on Day 1 when `flight_selection` is present, even if `arrivalTime24` is undefined (using the soft-fallback wording from step 3). Today an undefined value silently produces an empty block — that is the exact silent failure mode.

5. **Auto-fix instead of warn (FlightSyncWarning)** — in the post-gen meal-policy reconciliation path that today produces the "sync flight data" toast: when the mismatch is detected on a trip where `flight_selection` was already present at generation time (check `trips.flight_selection IS NOT NULL AND created_at < itinerary_data.generated_at`), fire `regenerate-day` for Day 1 (and last day if departure mismatched) automatically with the now-correct meal policy. Keep the warning visible only in the legitimate case: `flight_selection` was added AFTER generation. This removes the "sync button is a band-aid" UX entirely for the common path.

6. **Trace recorder hook** in `compile-day-facts.ts` (uses the recorder added in the earlier turn): record `flight_ingest` stage with `{ raw_flight_selection_shape, raw_arrival_string, parsed_arrivalTime24, earliestFirstActivity, constraint_block_will_render, leg_pick_source, parse_failed }`. So the next time a user reports "Day 1 wrong", we open `trace_events` and see in 5 seconds which gate dropped the data.

### Files touched
- `supabase/functions/_shared/flight-leg-pick.ts` (new, ~60 lines)
- `supabase/functions/generate-itinerary/flight-hotel-context.ts` (replace parser block, harden `normalizeTo24h`)
- `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts` (assert + soft fallback + trace stage)
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` (always-render Day 1 block)
- The post-gen warning module that emits `FlightSyncWarning` (promote to auto-regen for the legitimate-data case)

### Acceptance criteria
- New trip, manual arrival `14:00`: trace shows `parsed_arrivalTime24="14:00"`, `constraint_block_will_render=true`, Day 1 first activity ≥ 16:00, **no sync toast**.
- Same with ISO arrival `2026-06-04T14:00:00`: same trace, same Day 1 behavior.
- Multi-leg trip with `isDestinationArrival` on leg 2: leg 2's arrival is used; trace shows `leg_pick_source="isDestinationArrival_flag"`.
- Corrupt arrival string (parse fails): trace shows `parse_failed=true`, prompt block still renders with soft 15:00 floor, no Day 1 at 12:00.
- Pre-existing trip where flight was added AFTER generation: the toast still appears (legitimate signal — user did add data later).

### Out of scope
- Issue 2 (525-min airport transfer on departure day) — separate plan.
- Changing the persisted shape of `trips.flight_selection`.
- Multi-city leg-handoff logic beyond first-leg arrival.

No DB migration. All changes are edge-function + one tiny shared helper.