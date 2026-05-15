
# Fix: Reload Loses Dining / Replaces Itinerary With Lower-Quality Save

## Root cause (confirmed)

Two bugs compound on reload:

1. **Premature freeze.** `generation-core.ts` Stage 6 stamps `metadata.itinerary_frozen_at` and flips `itinerary_status='ready'` *before* Phase 4 writes `activity_costs` and before downstream dining-enrichment / description-fill / hotel-return passes finish persisting. Once frozen, `safeUpdateItineraryData` silently no-ops self-heal writes (per the Frozen-After-Ready rule), so any later enrichment that *would* have repaired the on-disk JSON is dropped.

2. **Optimistic "Saved" UX.** The header strip + indicator flip to a saved/ready state as soon as `itinerary_status='ready'`, even while the day-chain is still emitting later days or the per-day persist is mid-flight. A hard refresh in that window pulls a partial `itinerary_data` from DB and renders it — exactly the "skeleton without dinners" the user reported.

The health engine and "Reconciling…" badge are already telling us this; we just don't gate the user from leaving on it.

## Fix (3 changes, all server- and frontend-presentation-only)

### 1. Move `itinerary_frozen_at` to *after* full enrichment

In `generation-core.ts` Stage 6:
- Persist days + status `ready` **without** the freeze stamp.
- Run Phase 4 (`writeActivityCostsFromItinerary`), the dining-description net (`fillMissingDescriptions` / `ensureDayDiningDescriptions`), and the bookend verification pass.
- **Then** issue a second small `trips.update({ metadata: { itinerary_frozen_at: now } })` only if all post-passes succeeded and `meaningfulCount` matches expectations.

In `action-generate-trip.ts` (per-day chain):
- Stamp freeze only on the final-leg completion handler, after the same enrichment net runs — never on intermediate day saves.

This keeps the Frozen-After-Ready guarantee intact for *real* completions and stops it from locking partial states.

### 2. Add a `fully_persisted` boolean the UI can trust

- Add `metadata.fully_persisted = true` alongside `itinerary_frozen_at` in the post-enrichment update.
- `useGenerationPoller` + `TripDetail` consider the trip "saved" only when `itinerary_status ∈ {ready, generated} && metadata.fully_persisted === true && metadata.itinerary_frozen_at` is set.
- `SaveStatusIndicator` / header strip: while `ready` but not `fully_persisted`, render the existing `Reconciling…` chip instead of "Saved".

### 3. Block destructive reload during the gap

In `TripDetail.tsx`:
- When generation is in-flight OR `itinerary_status='ready'` but `!fully_persisted`, install a `beforeunload` handler that returns a confirmation string ("Your itinerary is still saving. Refreshing now may lose dining and enriched content.").
- Remove the handler as soon as `fully_persisted` flips true (and on unmount).
- This is the short-term safety net; once #1 + #2 ship cleanly, the window where the prompt fires shrinks to seconds.

## Out of scope / explicitly NOT changing

- No changes to the auto-resume allow-list, persist-regression guard, or DB-Is-Source-of-Truth contract — those are working as designed and are what *partially* protect users today.
- No changes to dining/description generation logic itself; only *when* we declare success.
- No new tables, no schema changes.

## Files touched

- `supabase/functions/generate-itinerary/generation-core.ts` (Stage 6 split: ready-without-freeze → enrichment → freeze + `fully_persisted`)
- `supabase/functions/generate-itinerary/action-generate-trip.ts` (final-leg freeze only)
- `src/hooks/useGenerationPoller.ts` (poll until `fully_persisted`)
- `src/pages/TripDetail.tsx` (`beforeunload` guard; surface `fully_persisted` to children)
- `src/components/trip/EditorialItinerary.tsx` (header chip: Reconciling vs Saved)
- New unit test asserting Stage 6 does not stamp `itinerary_frozen_at` before enrichment passes complete.

## Memory updates

- Update `mem://constraints/itinerary/frozen-after-ready` to add: "freeze stamp MUST follow Phase 4 + dining-description + bookend passes; pair with `fully_persisted=true`."
- New `mem://constraints/itinerary/saved-badge-honesty` documenting the UI contract and the `beforeunload` guard.
