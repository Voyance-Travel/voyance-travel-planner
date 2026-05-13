## P3 — Day 1 "missing breakfast" false positive on no-flight arrival days

### Problem

For Casablanca trip `fce9c4ba…` (no `flight_selection`), the health panel flags **Day 1 missing breakfast** even though the day's actual experience starts at the 11:05 luggage drop / 12:45 mosque tour. Confirmed via DB inspection:

- `flight_selection IS NULL`
- Day 1 first activities (in order): `Travel to … 10:20 (transport)`, `Luggage Drop 11:05 (accommodation)`, `Hassan II Mosque 12:45 (sightseeing)`, `Lunch at Rick's Café 14:46 (dining)`
- Persisted `metadata.quality.meal_policy_at_generation = { dayMode: 'morning_arrival', arrivalTime24: '09:00', requiredMeals: ['breakfast','lunch','dinner'] }`
- `metadata.quality.meal_audit.injected = ['breakfast']` — save-time guard already attempted (and failed) a breakfast injection on every save based on the same stale policy

### Root causes (3 bugs compounding)

1. **Phantom `arrivalTime24='09:00'` when `flight_selection` is null.** `deriveMealPolicy` is called with a default arrival clock derived from `trip.start_date` (or similar) instead of `undefined`. 09:00 is < 09:30 → required meals = `['breakfast','lunch','dinner']`. Brunch band is never reached because the schedule is never consulted.
2. **`quality.dayMode` is never written to top-level.** All 4 writers stamp `quality.meal_policy_at_generation.dayMode`, none stamp `quality.dayMode`. The panel's first read (`day?.metadata?.quality?.dayMode`) is therefore always empty for fresh trips, forcing it through the fragile `inferDayModeFallback` path.
3. **`firstNonBookendStart` skip-set is incomplete.** It skips `'transit'/'transfer'/'logistics'` but NOT `'transport'/'travel'/'airport_transfer'`, and has no title regex. A synthetic "Travel to Hotel 08:00" card silently becomes the inferred "arrival", regressing brunch-band days back into `morning_arrival_early` with full meals.

### Fix

All four layers, smallest-blast-radius first.

**1. Shared helper `inferArrivalMinsFromSchedule(activities)` (new)**

`src/lib/itinerary/inferArrivalFromSchedule.ts` + a mirror under `_shared/`. Returns the start time of the first activity whose category is NOT in `{check-in, check-out, hotel, accommodation, transit, transportation, transfer, transport, travel, logistics, commute, bookend, hotel_return, airport_transfer}` AND whose title does NOT match `^\s*(?:travel|transfer|drive|taxi|metro|train|bus|tram|ride|airport pickup|pickup|arrival|return) (?:to|from)\b`. Returns `null` when none found.

**2. Panel — `src/lib/itinerary/inferDayMode.ts`**

- Replace the inline `firstNonBookendStart` with `inferArrivalMinsFromSchedule`.
- After the existing fallback chain, also consult `day?.metadata?.quality?.meal_policy_at_generation` for `dayMode` so the panel mirrors what the backend cached (already done inside the panel, but as a tertiary read between `quality.dayMode` and `inferDayModeFallback`).

**3. Panel — `src/components/trip/TripHealthPanel.tsx` (lines 121–147)**

Insert the cached-policy read between `quality.requiredMeals` and the dayMode mapping:

```ts
const cachedPolicyMode: string =
  day?.metadata?.quality?.dayMode
  || day?.metadata?.quality?.meal_policy_at_generation?.dayMode
  || '';
```

Use `cachedPolicyMode` in place of `dayMode` for all the existing `if (cachedPolicyMode === …)` branches.

**4. Backend — promote `quality.dayMode` to top-level on every write**

In all 4 sites that currently write `meal_policy_at_generation.dayMode`, ALSO set `metadata.quality.dayMode = policy.dayMode`:

- `supabase/functions/generate-itinerary/action-generate-day.ts` (~line 336)
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (~lines 1965, 2535)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (~line 442)

This eliminates the dependence on the panel-side inference fallback for fresh trips.

**5. Backend — kill the phantom `arrivalTime24` default**

Audit the 4 write paths: when `flight_selection` is absent (or `savedArrivalTime24` is unresolved), pass `arrivalTime24: undefined` to `deriveMealPolicy` instead of a synthesized clock from `trip.start_date`. This makes `deriveMealPolicy` fall through to its no-clock branch (line 86) which currently returns full meals — for those trips, layer **6** kicks in.

**6. Brunch-band inference from schedule when no flight clock**

In `deriveMealPolicy` callers (backend) and `inferDayModeFallback` (panel), when `arrivalTime24` is missing, derive a synthetic arrivalMin from `inferArrivalMinsFromSchedule(day.activities)`. Then the standard band rules apply: ≥ 9:30 → no breakfast required. Closes the Casablanca case (first real activity = 11:05 → brunch band → `['lunch','dinner']`).

**7. One-shot backfill migration**

Reset `metadata.quality.meal_policy_at_generation.requiredMeals` and stamp top-level `metadata.quality.dayMode` for already-persisted trips on Day 1 / last day where `flight_selection IS NULL` and `arrivalTime24` was synthesized. Re-derive from the activity schedule using the new helper. Logs `[BACKFILL_DAYMODE]` per affected trip.

**8. Memory + tests**

- `mem://constraints/itinerary/dayMode-quality-top-level` — invariant: every persist MUST stamp `metadata.quality.dayMode` (not only the nested cache).
- `mem://constraints/itinerary/no-phantom-arrival-clock` — when `flight_selection` is null, never synthesize `arrivalTime24` from `trip.start_date`.
- Tests:
  - `inferArrivalFromSchedule.test.ts` — transport-card precedence regression; "Travel to Hotel 08:00" must not become arrival when next card is 11:30.
  - Extend `TripHealthPanel.cascadePreview.test.ts` with a no-flight Day 1 fixture matching the Casablanca activity ordering; assert no `missing-meals-1` issue.

### Files touched

- `src/lib/itinerary/inferArrivalFromSchedule.ts` (new)
- `src/lib/itinerary/inferDayMode.ts`
- `src/components/trip/TripHealthPanel.tsx`
- `supabase/functions/_shared/infer-arrival-from-schedule.ts` (new)
- `supabase/functions/generate-itinerary/action-generate-day.ts`
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
- `supabase/functions/generate-itinerary/meal-policy.ts` (no-flight fallback)
- `supabase/migrations/<ts>_backfill_daymode_top_level.sql` (one-shot)
- 2 new memory entries + index update
- 2 test files (1 new, 1 extended)

### Out of scope

- Any change to dinner/lunch detection rules
- Any change to the brunch-band thresholds (09:30 / 12:00) — already correct in Core memory
- Any UI/visual change to the health panel
