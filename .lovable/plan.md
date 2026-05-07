## Root cause

The persist-day contract (`supabase/functions/_shared/persist-day-contract.ts`) was wired into **only one** write path: `action-save-itinerary.ts` (line 757). But the itinerary JSON (`itinerary_data`) is written directly to `trips` from at least 8 other places that bypass it:

- `action-generate-trip-day.ts` lines 2671, 2817 (per-day completion writes — this is the path live trip generation actually takes)
- `action-generate-trip.ts` line 696
- `generation-core.ts` lines 2655, 3061
- `action-toggle-lock.ts` lines 78, 127, 177
- `action-repair-costs.ts` line 600

That's why the same four bugs keep firing on fresh generations: the contract catches them in tests + on the `save-itinerary` action, but the actual generator writes the dirty rows straight to the DB through `action-generate-trip-day`.

A second issue: prompt-artifact rows like `Dinner (AESTHETIC slot)` are currently **dropped entirely** by the contract. They should have the token **stripped** (the row is a real dinner; only the prompt scaffolding leaked into the title), then re-evaluated for placeholder status.

## Plan

### 1. Single shared `persistTripItinerary` helper

Create `supabase/functions/_shared/persist-itinerary.ts` exporting one function:

```ts
persistTripItinerary(supabase, tripId, itinerary, extraUpdate?, ctx?)
```

Internally:
- Calls `enforceContractOnDays(itinerary.days, { destination })`
- Calls `normalizeDurationsInDays`
- Calls a new `stripPromptArtifactsInTitles` (regex-strip `(slot)` / `(AESTHETIC slot)` / `(<LABEL> slot)` from titles before contract runs, so legitimate activities aren't dropped)
- Writes `{ itinerary_data: itinerary, ...extraUpdate }` to `trips`

### 2. Replace every direct `itinerary_data:` write with the helper

Touch points (search-replace):
- `action-generate-trip-day.ts` (2 sites)
- `action-generate-trip.ts` (1 site that writes `itinerary_data`)
- `generation-core.ts` (2 sites)
- `action-toggle-lock.ts` (3 sites — pass `{ skipContract: true }` since lock toggles must not drop user rows; still run duration normalize)
- `action-repair-costs.ts` (1 site)
- `action-save-itinerary.ts` (replace the inline contract block with the helper for consistency)

### 3. Fix prompt-artifact handling in the contract

In `persist-day-contract.ts`:
- Move `(slot)` / `(AESTHETIC slot)` handling out of the drop list. The helper strips the token from the title first; only **bare** titles like `(slot)` (nothing left after strip) get dropped.
- Keep `placeholder-name` and `ghost-row` drop semantics unchanged.

### 4. Tighten ghost-row rule for the live "12:15 AM" leak

Current rule drops 00:00–04:59 hotel/wellness/logistics. The live ghost is a hotel "Return to Hotel" leaking at `00:15`. Verify `HOTEL_RETURN_RE` matches the actual title format being persisted (read 1–2 live samples from `trips.itinerary_data` via `read_query`), and broaden if needed (e.g. `back at the hotel`, `hotel check-in / settle in`).

### 5. Wrong-city restaurants — extend cross-city sweep destination source

Cross-city sweep currently uses `currentTrip.destination`. Multi-city trips have a per-day `cityName` / `dayDestination`. Update `enforceContractOnDays` to prefer `day.cityName ?? day.dayDestination ?? ctx.destination` so a Florence day in a Venice trip filters foreign venues by Florence, not Venice.

### 6. Payments "Totals differ"

Already structurally fixed in `PaymentsTab.tsx` (drift badge gone, dev-only assert at line 439). If the user is still seeing a stale "Totals differ" string, it's the legacy fingerprint state cached in `trip_payments` rows. Add a one-shot client-side clear: on PaymentsTab mount, if `localStorage` has any `payments_drift_*` keys, remove them. No backend change.

### 7. Tests

Extend `persist-day-contract.test.ts`:
- `Dinner (AESTHETIC slot)` → kept, title becomes `Dinner`
- `(slot)` alone → dropped as prompt-artifact
- Multi-city day with `cityName: 'Florence'` and a Venice venue → dropped as cross-city, even when trip destination is Venice

Add a new `persist-itinerary.test.ts` smoke test that confirms the helper runs contract + duration normalize + strip in order.

## Files

**New:** `supabase/functions/_shared/persist-itinerary.ts`, `supabase/functions/_shared/persist-itinerary.test.ts`

**Edited:** `supabase/functions/_shared/persist-day-contract.ts`, `supabase/functions/_shared/persist-day-contract.test.ts`, `supabase/functions/generate-itinerary/action-generate-trip-day.ts`, `supabase/functions/generate-itinerary/action-generate-trip.ts`, `supabase/functions/generate-itinerary/generation-core.ts`, `supabase/functions/generate-itinerary/action-toggle-lock.ts`, `supabase/functions/generate-itinerary/action-repair-costs.ts`, `supabase/functions/generate-itinerary/action-save-itinerary.ts`, `src/components/itinerary/PaymentsTab.tsx` (one-shot localStorage clear)

## Why this fixes the pattern, not just the symptoms

Every prior fix added another sweeper. This collapses 9 write paths into 1 and makes the contract the **only** way an itinerary reaches `trips.itinerary_data`. Future regressions become impossible without deleting the helper — which is grep-visible in code review.

## Out of scope

- Removing the legacy client sweepers (`hideGhostActivities`, `nuclearWellnessSweep`, `sanitizeActivityName` hotel short-circuit). Keep through one soak window, then delete in a follow-up once contract-violation logs go quiet.
