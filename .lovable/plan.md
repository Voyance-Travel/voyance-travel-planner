## RS.M.I4 — Mark `trip_day_intents` fulfilled on manual activity edits

### Problem
Manual edits land in `trips.itinerary_data` (via `safeUpdateItineraryData` → `save-itinerary`), but the parallel `trip_day_intents` table is left with status `active`/`pending`. The next `regenerate-day` re-applies those intents and stomps the user's edit.

### Current edit paths
- `src/services/itineraryAPI.ts` does not have a per-activity `updateActivity` — manual edits flow through `saveItinerary` (whole-itinerary save) and `safeUpdateItineraryData` (every client write).
- `src/services/tripActivitiesAPI.ts::updateActivity` is a separate REST path (edge function `trip-activities`) used by some flows.
- `src/components/itinerary/EditorialItinerary.tsx` is the actual call site for manual edits and calls these helpers directly after editing.

A single per-activity hook does not exist; the cleanest fit is a shared helper called from both save boundaries.

### Plan

1. **New helper** `src/services/tripDayIntents.ts`:
   ```ts
   export async function markIntentsFulfilledByActivities(
     tripId: string,
     dayNumber: number,
     activities: Array<{ id?: string; title?: string; name?: string }>
   ): Promise<number>
   ```
   - Loads `trip_day_intents` for `(trip_id, day_number)` where `status <> 'fulfilled'`.
   - For each intent, fuzzy-match against any activity title via lowercase substring containment in either direction (the snippet's logic).
   - Updates matched intents with `{ status: 'fulfilled', fulfilled_at: now, fulfilled_activity_id: activity.id ?? null }`.
   - Logs `[manual-edit] Marked N intents as fulfilled`. Swallows errors (best-effort).

2. **Wire into `src/services/itineraryAPI.ts::saveItinerary`** (whole-itinerary save path):
   - After the successful `save-itinerary` invoke, walk `mergedItinerary.days` and call the helper per day with that day's activities. This is the "after the activity update succeeds" hook the spec asks for, applied to the actual save boundary that exists in this file.

3. **Wire into `src/services/tripActivitiesAPI.ts::updateActivity`** (per-activity REST path):
   - After the PATCH succeeds and the response carries the updated activity + day context, call the helper with that single activity. If `dayNumber` isn't in the response, skip silently (no regression).

4. **Verification** (per spec):
   - `grep -c "trip_day_intents.*update.*fulfilled\|fulfilled_at: new Date" src/services/itineraryAPI.ts` ≥ 1 — satisfied by the helper call site (we'll inline a comment referencing the table to keep the grep honest, or we'll do the update inline in `saveItinerary` rather than through the helper). **Decision: keep the update inline in `saveItinerary`** (matching the user's snippet verbatim against `tripId`/`dayNumber`/`activity`) and have `tripActivitiesAPI.ts` call the shared helper. That guarantees the grep passes without contortions.

### Files touched
- New: `src/services/tripDayIntents.ts` (helper)
- Edit: `src/services/itineraryAPI.ts` (inline fulfillment loop inside `saveItinerary`, after successful invoke)
- Edit: `src/services/tripActivitiesAPI.ts` (call helper after `updateActivity` succeeds)

### Out of scope
- No DB migration: `fulfilled_at` and `status` columns already exist.
- No changes to regeneration logic — fulfilled intents are already filtered upstream.
- No changes to locked/extracted/manual locking semantics.
