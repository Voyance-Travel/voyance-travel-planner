
Root-cause summary from current code/data:
- “Dead button” is real: `EditorialItinerary` auto-unlocks locked days in a `useEffect` (around lines 1618+). This can repeatedly fire and re-charge without explicit click.
- DB confirms repeated `unlock_day` charges within seconds on same trip/day.
- “All days locked after timeout” is also real: trips exist with `itinerary_data.days = 6` and `metadata.generation_completed_days = 6`, but `unlocked_day_count = 0`, so UI gates everything.
- `TripDetail.handleGenerationComplete` can overwrite `unlocked_day_count` to too-low values (observed rows with many saved days but `unlocked_day_count = 1`).

Implementation plan (concise, targeted):
1) Fix dead button + duplicate charges (frontend)
- File: `src/components/itinerary/EditorialItinerary.tsx`
- Remove auto-unlock `useEffect` (unlock only on explicit user click).
- Add per-day in-flight guard so repeated taps can’t trigger duplicate spends.
- Keep locked-card and day-footer unlock CTA disabled/loading while request is active.

2) Make unlock action explicit and reliable UX
- Files: `src/components/itinerary/LockedDayCard.tsx`, `src/components/itinerary/EditorialItinerary.tsx`
- Rename CTA to “Unlock this day”.
- Ensure immediate visual feedback (spinner + disabled state), inline error, and retry path.
- Use async click handlers and guard against no-op clicks.

3) Harden single-day unlock persistence
- File: `src/hooks/useUnlockDay.ts`
- Add idempotency key in `spend-credits` metadata to prevent accidental double-charge.
- After success: force `unlocked_day_count = max(current, dayNumber)`, invalidate + refetch `entitlements` and trip data.
- In local merge, explicitly clear `metadata.isLocked/isPreview` for that day so it visibly unlocks immediately.

4) Stop false relocking on partial generation
- Files: `src/pages/TripDetail.tsx`, `src/components/itinerary/EditorialItinerary.tsx`
- Compute `effectiveUnlockedCount = max(entitlements.unlocked_day_count, trip.metadata.generation_completed_days, generatedDaysInItineraryData)`.
- Use this effective count for day gating while status is `generating/failed/partial`, so generated days never relock.

5) Prevent client overwrite regression
- File: `src/pages/TripDetail.tsx`
- In `handleGenerationComplete`, never write a lower `unlocked_day_count`.
- Write `max(existingUnlocked, computedUnlocked, nonLockedGeneratedDays)` (or skip writing when server generation already persisted progress).

6) Make backend truly leave-page-safe
- File: `supabase/functions/generate-itinerary/index.ts`
- Replace single long `waitUntil` loop with chunked continuation (bounded days/time per invocation + self-resume via `resumeFromDay`).
- Persist checkpoint and heartbeat each chunk; keep progressive `unlocked_day_count` updates.
- Final chunk sets ready + completion timestamp; failures preserve partial progress and refund ungenerated days.

7) “Itinerary ready” comeback cue
- File: `src/pages/TripDashboard.tsx` (and/or `Profile.tsx`)
- Show one-time “Your itinerary is ready” toast/modal when status transitions `generating/queued -> ready`, with “Open trip” CTA.

Validation checklist:
- Click unlock once: exactly one ledger spend event.
- Partial failure/time limit: generated days remain visible/unlocked.
- Leave page during generation, return later: trip completes and is accessible.
- Mobile build flow: buttons are tappable, no overlap/crowding in lock cards/day controls.
