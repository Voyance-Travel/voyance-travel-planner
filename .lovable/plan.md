# Fix: "Arrival Flight" misscheduled hours after actual landing

## Symptom
Rome trip `d18b2e8a…`, Day 1:
- Saved arrival = **04:30 AM** (`metadata.savedArrivalTime24 = "04:30"`)
- Card on the itinerary: **Arrival Flight 06:40–08:40**, sitting *after* Luggage Drop 06:15–06:35.

Should be a flight that **lands at 04:30** (e.g. 02:30–04:30), followed by transfer/luggage drop ≥ 04:30.

## Root cause
`pipeline/repair-day.ts` §3b creates the arrival-flight card correctly:
```
flightEndMins   = arrivalMins         // 04:30
flightStartMins = arrivalMins − 120   // 02:30
source: 'repair-arrival-flight'
isLocked: false
```
But three downstream passes then move it:

1. **Dawn guard** (§ above 3b) explicitly exempts `cat=flight` on Day 1 — OK.
2. **`normalizePredawnCascade`** (`_shared/predawn-cascade-normalize.ts`, wired at save + parse + lazy heal) detects the leading `[00:00, 05:00)` block and shifts the whole cluster forward — flight card is **not** in its exemption list (only `bookend-source` + departure-logistics are exempt). This is what drags the flight to 06:40.
3. **`enforceTimingAndBuffers`** then re-sorts and adds buffers, producing the post-LuggageDrop ordering.

Net effect: a hard logistical anchor (actual flight landing time) is treated as a "stray pre-dawn LLM emission" and rebased.

## Fix (server-side only, no UI change)

### 1. Make the arrival-flight card a hard anchor
`supabase/functions/generate-itinerary/pipeline/repair-day.ts` §3b — when building `flightCard`:
- `isLocked: true`
- `anchorSource: 'arrival-flight'`
- Keep `source: 'repair-arrival-flight'` (already used by exemption checks elsewhere).
- Same hardening for the paired `Transfer to {hotel}` card: `isLocked: true`, `anchorSource: 'airport-transfer'`, `source: 'repair-airport-transfer'`.

### 2. Exempt arrival flight + airport transfer from `normalizePredawnCascade`
`_shared/predawn-cascade-normalize.ts` and FE mirror `src/lib/itinerary/normalizePredawnCascade.ts`:
- Add to the skip predicate: `source ∈ {'repair-arrival-flight','repair-airport-transfer'}` OR `anchorSource ∈ {'arrival-flight','airport-transfer'}` OR `(category='flight' && dayNumber===1)`.
- Sentinel log: `[PREDAWN_CASCADE_NORMALIZE] skipped arrival_anchor count=N`.

### 3. Exempt arrival flight from `enforceTimingAndBuffers` shift
`_shared/timing-cascade.ts`:
- Treat `anchorSource ∈ {'arrival-flight','airport-transfer'}` the same as `isLocked` for the cascade walk (already exempts locked, but `isLocked` had been false historically — step 1 fixes that; this step is defense-in-depth in case future regen unsets it).

### 4. Guarantee post-arrival ordering
After §3b in `repair-day.ts`, run a small reorder: any non-locked, non-arrival, non-airport-transfer activity whose `startTime < arrivalFlightEndTime + transferMinutes + 15` gets nudged to `arrivalFlightEndTime + transferMinutes + 15`. Closes the "Luggage Drop at 06:15 before the 04:30 landing" wrong-order class.

### 5. Tests
- `repair-day.test.ts`: arrival flight at 04:30 lands at 02:30–04:30, isLocked=true, anchorSource set; downstream `normalizePredawnCascade` leaves it alone; luggage drop pushed to ≥ 05:15.
- `predawn-cascade-normalize.test.ts`: new fixture with `source:'repair-arrival-flight' startTime:02:30` — assert untouched, sentinel logs `skipped arrival_anchor count=1`.

### 6. Backfill for the Rome trip (`d18b2e8a…`)
One-shot migration updating both `itinerary_days.activities` JSON for Day 1 and the mirrored `trips.itinerary_data.days[0]`:
- Rewrite the "Arrival Flight" card to `startTime:'02:30', endTime:'04:30', isLocked:true, anchorSource:'arrival-flight'`.
- Move `Luggage Drop at Hotel de Russie` to `startTime:'05:15', endTime:'05:35'` (or wherever it next fits given the transfer card).
- Re-sort Day 1 activities by `startTime`.
- Stamp `metadata.repairs.arrival_flight_anchored_at`.

## Files to edit
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (steps 1, 4)
- `supabase/functions/_shared/predawn-cascade-normalize.ts` (step 2)
- `src/lib/itinerary/normalizePredawnCascade.ts` (step 2, FE mirror)
- `supabase/functions/_shared/timing-cascade.ts` (step 3)
- `supabase/functions/generate-itinerary/pipeline/repair-day.test.ts` (step 5)
- `supabase/functions/_shared/__tests__/predawn-cascade-normalize.test.ts` (step 5)
- New migration `supabase/migrations/<ts>_anchor_arrival_flight_rome.sql` (step 6)

## Out of scope
- Visual changes to the card.
- Generator-side prompt changes (LLM doesn't author the arrival card; repair-day does).
- Departure flight (separate code path; same hardening could come later but not requested).
