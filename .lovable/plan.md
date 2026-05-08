## Root cause (single, concrete)

The contract chain (`stripPromptArtifactsInTitles` → `enforceContractOnDays` → `stripPreDawnHotelReturns`) is solid and runs inside `persistTripItinerary`. Every backend write path now uses it. **But one client-side write still bypasses it on every fresh generation:**

`src/services/itineraryAPI.ts` lines **425–437** — after each backend day returns, the client immediately upserts the raw `data.day.activities` into `itinerary_days` (the table the UI uses for live progress rendering during generation). That upsert:

- runs **before** the final `save-itinerary` call
- writes the **raw generator output** (which still contains pre-dawn "Return to Hotel", `(slot)`, `Spa Time — find a venue`, and "Lunch — find a local spot in the destination")
- is what the user sees on Day 2 / mid-generation
- is also what the realtime poller streams into the UI

This is the one remaining "live" path. The save-itinerary final call later cleans `itinerary_data`, but the UI is reading the dirty `itinerary_days` row first → all six bugs reappear "live" then "intermittently disappear" once the final save lands.

The Payments drift is downstream of the same problem: when ghosts/placeholders survive in the rendered day, `usePayableItems` and `useTripFinancialSnapshot` see a different active-activity set than `activity_costs` (which was written from the cleaned data). That is the residual "Totals differ" / sync mismatch users still see.

## Plan

### 1. Run the contract before the per-day `itinerary_days` upsert

In `src/services/itineraryAPI.ts` (the loop around lines 400–450), before upserting `data.day.activities` into `itinerary_days`:

- Import `enforcePersistDayContract` from a small new browser-safe export `src/lib/itinerary/persistDayContract.ts` (a thin re-export of the regex + `enforcePersistDayContract` function from the edge `_shared` module — pure JS, zero Deno deps, can be shared).
- Run it with `{ dayNumber }` against `data.day.activities` and replace the array with the cleaned one.
- Also strip pre-dawn hotel returns using a tiny mirror of `stripPreDawnHotelReturns` (same logic, browser-safe).
- Apply `stripPromptArtifactsInTitles` mirror.

This is the minimum surgical fix: the same three-step contract that already runs in `persistTripItinerary` now runs once on the client right before the only remaining raw write.

### 2. Database-level last-gate trigger on `itinerary_days`

Add a Postgres `BEFORE INSERT OR UPDATE` trigger on `itinerary_days` that walks `NEW.activities` (jsonb) and:

- removes elements whose `title|name|venue_name|description|location.name` matches the placeholder family (`find a (local spot|venue|...)`, `(slot)`, `(AESTHETIC slot)`, `placeholder`, `tbd`, `needsVenuePick`, `Spa Time — find a venue`)
- removes pre-dawn (00:00–04:59) hotel/accommodation/wellness/return-to-hotel rows
- skips rows with `locked = true` / `source IN (user, manual, extracted, pinned)`

This is a belt-and-braces guarantee: even if a future code path forgets to call the JS contract, dirty rows can never reach the database. Mirrors `persist-day-contract.ts` exactly so the test suite covers both.

### 3. Mirror the same trigger on `trips.itinerary_data`

Same scrub on `trips.itinerary_data->'days'[*]->'activities'` for any `UPDATE` of `itinerary_data`. Closes the gap where a future helper might still write `trips.itinerary_data` directly without going through `persistTripItinerary`. Idempotent — re-running on already-clean data is a no-op.

### 4. Make Payments snapshot strictly downstream of the cleaned itinerary

After steps 1–3 land, the live `itinerary_data.days[*].activities` is guaranteed clean, so `usePayableItems` and `useTripFinancialSnapshot` see the same activity set that `activity_costs` was written from. No code change needed in Payments itself — verify by:

- Adding a Vitest case in `src/services/__tests__/canonicalCostRows.test.ts` that feeds days containing a placeholder + a ghost row and asserts the snapshot total equals the bucket sum.

### 5. Tests

- New Deno test in `supabase/functions/_shared/persist-day-contract.test.ts`: feeds a day with `(AESTHETIC slot)` in `description` (not title) and asserts it is dropped — closes the field-coverage hole that allowed the artifact to leak into the rendered description.
- New Vitest in `src/lib/itinerary/__tests__/persistDayContract.test.ts`: verifies the browser mirror behaves identically to the Deno version on the canonical bug fixtures (12:15 AM hotel bleed, "find a local spot", `(slot)`, `Spa Time — find a venue`, wrong-city restaurant).
- New SQL migration test (manual): insert a dirty `itinerary_days` row, assert trigger removes the dirty entries.

### 6. Verification

- Generate a fresh 4-day Venice trip in preview, watch network log for `itinerary_days` upserts — confirm no row contains the placeholder strings.
- Open Payments tab during generation — confirm no "Totals differ" badge.
- Re-run the same trip 5x — confirm `(slot)` artifact does not reappear (the regex was already de-stated; this verifies no other write path leaks).

## Files to touch

- **new**: `src/lib/itinerary/persistDayContract.ts` (browser-safe mirror)
- **new**: `src/lib/itinerary/__tests__/persistDayContract.test.ts`
- **edit**: `src/services/itineraryAPI.ts` (lines ~400–450 — clean before `itinerary_days.upsert`)
- **edit**: `supabase/functions/_shared/persist-day-contract.test.ts` (description-field case)
- **migration**: BEFORE INSERT/UPDATE trigger on `itinerary_days` and `trips` (jsonb scrub function)

No edge function logic changes (the backend contract is correct — we're just preventing the client from writing dirty data into `itinerary_days` before the backend save catches up, plus a DB-level safety net).
