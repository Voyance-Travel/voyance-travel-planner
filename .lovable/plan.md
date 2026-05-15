## Goal
Prevent hard refresh from silently overwriting the user's itinerary with different LLM output by adding a snapshot-and-restore guardian that detects destructive changes and restores the previous version.

## Changes

### 1. Create `src/hooks/useItineraryPreservation.ts`
New hook with two effects:
- **Snapshot effect**: On every render where a healthy itinerary exists, save a JSON snapshot to `sessionStorage` keyed by trip ID. Snapshot includes full itinerary, day count, dining count, and total cost. Ignores empty/loading states.
- **Restore effect**: On mount and trip changes, compare current state against the last snapshot (if within 5-minute TTL). If days dropped by >1 or dining count fell by ≥50%, trigger a toast warning and write the snapshot back to `trips.itinerary_data` via direct Supabase update.

### 2. Wire into `src/pages/TripDetail.tsx`
- Add import: `import { useItineraryPreservation } from '@/hooks/useItineraryPreservation';`
- Add one call inside component body, near existing hooks: `useItineraryPreservation(tripId, trip);`

No other changes to `TripDetail.tsx`. `handleResumeGeneration`, `fetchTripData`, and all existing logic remain untouched — the guardian wraps them transparently.

## Acceptance Criteria
1. `src/hooks/useItineraryPreservation.ts` exists and contains the string "Destructive change detected".
2. `src/pages/TripDetail.tsx` contains exactly 2 references to `useItineraryPreservation` (one import, one call).
3. On reload of any trip, browser console shows `[ItineraryPreservation]` logs.
4. If a reload causes itinerary destruction (days lost or dining cut in half), a toast appears: "Detected unexpected itinerary change — restored your previous version."

## Out of Scope
- Removing or modifying `handleResumeGeneration` logic — the guard sits above it.
- Any other TripDetail logic changes.
