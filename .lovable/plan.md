

## Fix: "Unlock Remaining Days" Breaks Itinerary and Shows Generation Screen

### Root Cause Analysis

After extensive code tracing, there are **two cascading bugs** in the unlock flow (`useUnlockTrip.ts`) that corrupt the trip state for new users:

**Bug 1: `onUnlockComplete` overwrites `itinerary_data` with a minimal object, losing critical fields**

The unlock hook builds `itineraryToSave` as:
```js
{ days: cleanedDays, generatedAt, destination, isPreview: false }
```
This gets passed to `onUnlockComplete`, which sets it directly into `trip.itinerary_data` (TripDetail.tsx line 2870). The original `itinerary_data` had fields like `summary`, `highlights`, `status`, `currency`, etc. — all lost. This stripped-down object then causes downstream parsers and self-heal logic to misbehave.

**Bug 2: Failed day enrichments + shrink guard = silent save failure + stale state**

If any `generate-day` call fails during unlock, `null` is pushed to `enrichedDays` and then filtered out. This means `cleanedDays` has fewer days than the canonical count. The `save-itinerary` shrink guard silently blocks the write (returns `{ success: true, shrinkBlocked: true }`), but the hook treats it as success. `onComplete` fires with the incomplete data, and `itinerary_status` on the server stays unchanged — but the local state now has fewer days.

**Bug 3 (triggering the generation screen): Self-heal auto-resume fires**

After the unlock completes and `onUnlockComplete` sets the stripped `itinerary_data`, TripDetail's self-heal logic (line 1187-1198) may detect `actualDays < expectedTotal` (e.g., if enrichment failed for some days). It then calls `handleResumeGeneration()`, which sets `itinerary_status: 'generating'` on the server and reloads the trip — switching the UI to the generation screen.

### Fix (3 changes in 2 files)

**1. `useUnlockTrip.ts` — Preserve existing `itinerary_data` fields when saving**

Instead of building a minimal `itineraryToSave`, merge the enriched days into the existing `itinerary_data` structure:

```typescript
// Line ~245: Replace minimal object with merged one
const itineraryToSave = {
  ...existingItineraryData, // Preserve summary, highlights, currency, etc.
  days: cleanedDays,
  generatedAt: new Date().toISOString(),
  isPreview: false,
};
```

This requires storing the fetched `itinerary_data` (not just `days`) at line 157.

**2. `useUnlockTrip.ts` — Check for shrink-blocked saves and handle gracefully**

After the `save-itinerary` call, check the response for `shrinkBlocked`:

```typescript
const { data: saveResult, error: saveError } = await supabase.functions.invoke(...);
if (saveResult?.shrinkBlocked) {
  console.warn('[UnlockTrip] Shrink guard blocked save — re-fetching trip');
  // Re-fetch trip from server to get the actual current state
  // Don't call onComplete with stale data
}
```

**3. `TripDetail.tsx` — `onUnlockComplete` should also set `itinerary_status: 'ready'`**

Prevent the self-heal from detecting a false-positive incomplete state:

```typescript
onUnlockComplete={(enrichedItinerary) => {
  refreshEntitlements();
  setTrip(prev => prev ? {
    ...prev,
    itinerary_data: enrichedItinerary as any,
    itinerary_status: 'ready', // Prevent self-heal from triggering generation
  } : prev);
}}
```

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/hooks/useUnlockTrip.ts` | Preserve existing `itinerary_data` fields when building save payload; handle shrink-blocked saves |
| 2 | `src/pages/TripDetail.tsx` | Set `itinerary_status: 'ready'` in `onUnlockComplete` callback |

