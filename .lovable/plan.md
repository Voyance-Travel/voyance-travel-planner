# Bangkok-trip generation-collapse fix

All four reported symptoms cascade from one upstream bug: `trips.itinerary_data.days` was shrunk to 1 day even though `itinerary_days` + `itinerary_activities` tables hold all 4 days. Everything downstream (header count, hotel-nights label, departure-day classifier, return-flight injection) reads from JSON, so a single corrupt write poisons the entire trip render.

## Root cause

DB state for trip `53636a0c-…`:

```text
itinerary_data.days        = 1   ← what the UI reads
itinerary_days table       = 4
itinerary_activities       = 9 / 11 / 11 / 3 across days 1–4
metadata.failed_day_numbers= [3, 4]   ← stale, tables show those days have data
metadata.itinerary_frozen_at = null   ← not frozen
```

Edge logs from the session:
```
[save-itinerary] 🛡️ SHRINK BLOCKED: incoming=1, canonical=4 (json=1, table=4).
```
The shrink-block guard caught the latest 1-day write, but an **earlier** 1-day write had already landed in JSON. The guard compares `incoming` to `max(json, table)` — once JSON itself is 1, any subsequent 1-day write looks "equal" and isn't blocked, only saved by the table count tiebreak.

The 1-day JSON then makes the bookend validator treat Day 1 as both arrival (`dayMode: midday_arrival`) **and** the last day, stamping `isDepartureDay: true` and injecting the return-flight transfer there. Hotel-nights count is derived from `days.length`, so it reads "1 nights".

## Plan

### 1. Block JSON day-count regression at the persist boundary (primary fix)

In `safeUpdateItineraryData` / `persistTripItinerary` (the no-regression guard cited in Core memory), add a **strict day-count floor**:

- Compute `priorMaxDays = max(prior_json.days.length, count(itinerary_days table))`.
- If `incoming.days.length < priorMaxDays` AND caller did not pass `allowRegression:true` → block the write, stamp `metadata.rejected_attempts` with `reason: 'day_count_shrink'`, return success-without-write (mirrors existing shrink-block).
- Lower the "tiebreak" wording so JSON-only equality cannot mask a regression when the table is larger.

Sentinel: `[PERSIST_DAY_COUNT_SHRINK_BLOCKED] incoming=N prior=M`.

### 2. Strengthen the page-load self-heal so an already-corrupt trip recovers

`TripDetail.tsx` already has the `dayCountDrift` rebuild path (line ~1606). It exists but didn't recover this trip — needs three small hardenings:

- **Always allow rebuild when `tableDays > jsonDays` even if `jsonDays === 0` is false but JSON is "thin"** (1 day vs 4). Today the guard is correct; verify the rebuild candidate isn't being disqualified by the chronology / regression gates because the candidate's day count is *higher* than current. Pass `allowRegression: true` only on `self-heal-recovery-rebuild-sparse-json`, never on normal saves.
- After successful rebuild, recompute `metadata.failed_day_numbers` against table activity counts (any day with ≥3 rows → drop from failed list). Stamp `[FAILED_DAYS_RECONCILED]`.
- Fire one heal pass on mount even when `fully_persisted` is still `false` (currently we skip while polling), as long as `tableDays > jsonDays`.

### 3. Bookend / departure-day classifier guard

In `_shared/bookend-validator` and `enforceDepartureDayLogistics`, refuse to stamp `isDepartureDay: true` on a day whose `dayNumber=1` when:

- `metadata.generation_total_days > 1` OR
- `itinerary_days` table count > 1 OR
- there exists a later day in `itinerary_data.days`.

This is a belt-and-braces guard so even if JSON ever collapses again, Day 1 never gets the return-flight injection.

Sentinel: `[BOOKEND_DEPARTURE_GUARD] dayNumber=1 totalDays>1 → skipped`.

### 4. Hotel-nights label uses canonical dates, not JSON days

In the Flight/Hotel summary component (the one rendering "1 nights"), derive nights from `trip.end_date − trip.start_date` (or hotel check-out − check-in when split-stay), never from `itinerary_data.days.length`. JSON day count is a render artifact; hotel nights is a contract.

### 5. Re-trigger missing days for this trip (one-shot, opt-in)

Add a small dev-only utility route (or RPC) the user can hit once: `heal-trip-from-tables` — rebuilds `itinerary_data.days` from `itinerary_days` + `itinerary_activities` for a given `tripId`, resets `failed_day_numbers`, re-runs the read-time bookend, and persists with `saveReason: 'one-shot-rebuild-from-tables'`. Surface in the trip header as an admin button gated on `meta.day_count_drift_detected`.

No DB migration needed; we already have all the data in the tables.

### 6. Files touched (preview)

- `supabase/functions/_shared/persist-itinerary.ts` (day-count floor)
- `src/lib/itinerary/safeUpdateItineraryData.ts` (regression option plumbing)
- `src/pages/TripDetail.tsx` (rebuild trigger + failed-days reconcile)
- `supabase/functions/_shared/bookend-validator.ts` and `pipeline/repair-day.ts §15z` (Day-1-can't-be-departure guard)
- Flight/Hotel summary component (`AddBookingInline.tsx` or sibling) — nights from dates
- New `supabase/functions/heal-trip-from-tables/index.ts` (one-shot RPC)
- Tests: `persist-day-count-shrink.test.ts`, `bookend-day1-departure-guard.test.ts`, `TripDetail.dayCountDrift.test.tsx`

## Acceptance

- Refreshing trip `53636a0c-…` rebuilds JSON to 4 days, drops Day-1 return flight, renders "3 nights" in the hotel summary, and clears `failed_day_numbers` to `[]`.
- New trips: any save attempt with fewer JSON days than `max(prior_json, table)` is silently rejected with a structured log; tests cover the regression.
- A 4-day trip whose JSON briefly shrinks to 1 always recovers on next page load.

## Out of scope

- Untagged flight-direction labels — already fixed in the prior Paris ticket via `autoTagLegs`. Will verify it's wired into the Flights tab for this trip; if missing, fold into this PR with a one-line wiring change, otherwise no action.
- Original "why did the chain emit a 1-day JSON write" forensics — the day-count floor (step 1) makes the source irrelevant; investigating which caller did it would delay the fix and isn't needed to stop the bleed.
