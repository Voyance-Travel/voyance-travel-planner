

## Plan: Fix Frontend Generation UX — Live Progress + Seamless Return

### Problem
The backend works correctly — days are saved individually to `itinerary_days` table and `itinerary_data.days` is progressively populated. But the frontend has three gaps:

1. **`useGenerationPoller` only reads `trips.metadata` for progress** — it gets `completedDays` from `metadata.generation_completed_days`. If that metadata is stale or missing, progress shows 0 even when days exist in `itinerary_days`.
2. **TripDetail doesn't check `itinerary_days` on page load** — if `itinerary_data` is null and `itinerary_status` isn't `'generating'`, it shows the "Generate Itinerary" button even when days exist.
3. **Stall detection shows a manual "Resume" button** instead of auto-resuming.
4. **Time estimate says "Usually takes less than a minute"** — wrong for multi-day trips.

### Changes

#### 1. `useGenerationPoller.ts` — Poll `itinerary_days` as fallback + auto-resume on stall

- Add a secondary query to `itinerary_days` table counting rows and fetching day summaries (day_number, title, theme) during each poll cycle.
- If `metadata.generation_completed_days` is 0 but `itinerary_days` has rows, use the `itinerary_days` count as `completedDays`.
- Expose `generatedDaysList` (array of `{day_number, title, theme}`) from the hook for the progress UI to render.
- **Auto-resume on stall**: When stall is detected (heartbeat > 3min), instead of firing `onStalled`, automatically invoke `generate-itinerary` with `action: 'generate-trip'` and `resumeFromDay: completedDays + 1`. Only attempt once per stall (use existing `stalledFiredRef`). If auto-resume fails, then fire `onStalled` for manual fallback.
- Add `'generated'` as a completion status check alongside `'ready'` (the backend uses `'generated'` not `'ready'`).

#### 2. `TripDetail.tsx` — Auto-detect generation state on page load

In `fetchTripData()` (around line 533), after loading the trip, add a check against `itinerary_days`:

```
const { count: dayCount } = await supabase
  .from('itinerary_days')
  .select('*', { count: 'exact', head: true })
  .eq('trip_id', tripId)
```

Then in the rendering logic (line ~1349-1546), change the condition chain:
- If `itinerary_status === 'generated'` AND `hasItineraryData` → show complete itinerary (existing)
- If `itinerary_status === 'generating'` OR (`dayCount > 0` AND `!hasItineraryData`) → show progress view with poller enabled
- If none of the above → show "Generate Itinerary" button

This ensures returning users NEVER see the generate button when days exist.

Also update `isServerGenerating` (line 147) to include the case where `itinerary_days` exist but `itinerary_status` may have been reset.

#### 3. `TripDetail.tsx` — Replace stalled UI with auto-resume

Remove the "Resume from Day X" button (lines 1354-1381). Replace with a brief "Reconnecting..." indicator since the poller now auto-resumes. Keep the manual resume as a hidden fallback (show after 2 failed auto-resume attempts).

#### 4. `TripDetail.tsx` — Enhance progress view with day list from poller

In the generating progress section (lines 1383-1451), replace the generic spinner + `partialDays` from `itinerary_data` with the new `generatedDaysList` from the poller. Show:
- Day number badge + title + theme for each completed day
- Pulsing "Generating Day X..." for the current day
- Faded placeholders for upcoming days (max 3)
- Progress bar and accurate time estimate

#### 5. `GenerationPhases.tsx` — Add `totalDays` prop for dynamic time estimate

Replace the static "Usually takes less than a minute" (line 288) with:
- `totalDays <= 3` → "Usually takes 2-4 minutes"
- `totalDays <= 7` → "Takes about X minutes"  
- `totalDays > 7` → "Takes about X minutes. You can leave and come back."

Add `totalDays?: number` to the props interface.

#### 6. `ItineraryGenerator.tsx` — Pass `totalDays` to `GenerationPhases`

Where `GenerationPhases` is rendered, pass `totalDays={totalDaysEstimate}`.

#### 7. Edge Function — Add retry logic for self-chain calls

In `generate-itinerary/index.ts`, wrap the fire-and-forget `fetch` for the next day in a 3-attempt retry loop with exponential backoff (2s, 4s, 6s) to handle intermittent 403 errors.

### Files to modify

| File | What |
|------|------|
| `src/hooks/useGenerationPoller.ts` | Poll `itinerary_days`, expose day list, auto-resume on stall, recognize `'generated'` status |
| `src/pages/TripDetail.tsx` | Check `itinerary_days` on load, replace stalled UI, enhance progress view |
| `src/components/planner/shared/GenerationPhases.tsx` | Dynamic time estimates |
| `src/components/itinerary/ItineraryGenerator.tsx` | Pass totalDays to GenerationPhases |
| `supabase/functions/generate-itinerary/index.ts` | Retry logic on self-chain fetch |

