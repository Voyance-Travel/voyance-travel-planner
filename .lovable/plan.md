

## Fix: Trip regenerates on page refresh after successful generation

### Problem summary

Two issues reported:
1. **City name "Girls' trip focused on partying"** — already fixed in previous commit (preferring `details.cities[0].name` over raw `details.destination`)
2. **Itinerary regenerates on refresh** — after generation completes, user refreshes, sees itinerary briefly, then it starts regenerating again

### Root cause of regeneration

The `isServerGenerating` flag at line 186 drives the entire generation UI:

```text
isServerGenerating = 
  trip.itinerary_status === 'generating' ||   ← LIKELY TRUE ON REFRESH
  ...
```

When generation completes via the edge function, it sets `itinerary_status: 'ready'` and `itinerary_data` in DB (line 11116-11118). But the **client-side** `handleGenerationComplete` callback (line 1393) ALSO does a force-save of `itinerary_status: 'ready'`. If either the edge function's final update or the client's force-save encounters a race condition (e.g., both writing at nearly the same time), the status may remain `'generating'` in DB.

On refresh:
1. Trip loads from DB with `itinerary_status = 'generating'` (stale)
2. `isServerGenerating` becomes `true`
3. The `generationPoller` starts polling at 3-second intervals
4. The **stuck-heal** effect (line 714) sees status='generating' with stale heartbeat (>3 min) and **re-invokes** `generate-itinerary` — causing the regeneration the user observed

Additionally, even for non-journey trips (no `journey_id`), there's a path where `isServerGenerating = true` causes the generation animation to show, and the poller's `onFailed`/`onStalled` handlers can trigger resume logic.

### Fix

**`src/pages/TripDetail.tsx`** — 3 changes:

1. **Auto-correct stale 'generating' status on load** (~line 960, after fetching trip + itinerary_days): If trip has `itinerary_status = 'generating'` BUT `itinerary_data` contains days AND all expected days are present, auto-correct the DB status to `'ready'` and update local state. This handles the case where generation succeeded but status wasn't properly finalized.

2. **Guard `isServerGenerating` against completed trips** (line 186): Add an extra condition — if `trip.itinerary_data` has days and status is `'generating'`, check `generation_completed_days >= generation_total_days` in metadata. If true, don't treat as generating.

3. **Stuck-heal: also check for itinerary_data before re-triggering** (line 730-736): Currently the stuck-heal only checks `itinerary_days` count. Also check if `trip.itinerary_data` already has days — if so, fix the status instead of re-generating.

