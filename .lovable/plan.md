

## Plan: Fix Generation Frontend — Completion Transition + Polish Bugs

### Analysis of Current State

**Bug 1 (onComplete never called):** Actually already fixed — `onComplete` IS called at line 141 of ItineraryGenerator.tsx inside the `onReady` callback. However, the `onReady` callback can fire multiple times because the poller has no guard. The first call works, but `setServerGenActive(false)` triggers a re-render and the cleanup of the polling interval is async — meaning the next poll tick can fire `onReady` again before the interval is cleared. This causes Bug 3 (repeated toasts) and potentially a race condition where the second call has stale data.

**Bug 2 ("Day 6 of 5"):** The `Math.min(nextDay, total)` guard at line 141 of GenerationPhases.tsx prevents this IF `total` is correct. But `total = totalDays || 0` uses the prop, and the prop `totalDaysEstimate` may not match the backend's `generation_total_days`. Also, GenerationPhases has its own independent polling loop (line 70) that's completely separate from `useGenerationPoller` — two parallel pollers hitting the same tables.

**Bug 3 (repeated toasts):** No `onReadyCalled` guard in `useGenerationPoller`. The `onReady` callback fires on every poll that sees `status === 'ready'`.

**Bug 4 ("Building in the cloud"):** The Cloud icon + text at line 226-229 of GenerationPhases.tsx.

**Bug 5 (no activities during generation):** GenerationPhases only queries `day_number, title, theme` from `itinerary_days` (line 39). Activities are stored in `itinerary_days.activities` JSONB but aren't selected or rendered.

### Changes

#### File 1: `src/hooks/useGenerationPoller.ts`
- Add `onReadyCalledRef = useRef(false)` to guard `onReady` from firing more than once
- Before calling `onReadyRef.current?.()` at lines 131 and 140, check `if (!onReadyCalledRef.current)` and set it to `true`
- Reset the ref in `startPolling` and when `enabled` changes to false

#### File 2: `src/components/planner/shared/GenerationPhases.tsx`
- **Remove the duplicate polling loop entirely** — GenerationPhases should NOT have its own `useEffect` with `setInterval`. The parent (`ItineraryGenerator`) already runs `useGenerationPoller` which provides all the data needed. Pass poller data as props instead.
- Add props: `completedDays`, `generatedDaysList`, `isComplete`, `progress` (from poller state)
- Remove internal `useState` for `days`, `isComplete`, `status` and the polling `useEffect`
- **Fix Bug 2:** Add guard: if `completedDays >= totalDays && totalDays > 0`, show the completion state
- **Fix Bug 4:** Change `Cloud` icon to `Sparkles` and text from "building your itinerary in the background" (remove "cloud")
- **Fix Bug 5:** Add `activities` to the polled data display. Query `activities` JSONB from `itinerary_days`. For each completed day card, show first 3-4 activity names with times in a compact list.

#### File 3: `src/components/itinerary/ItineraryGenerator.tsx`
- Pass poller state to `GenerationPhases` as props instead of letting it poll independently:
  ```
  <GenerationPhases
    tripId={tripId}
    totalDays={totalDaysEstimate}
    destination={destination}
    completedDays={poller.completedDays}
    generatedDaysList={poller.generatedDaysList}
    isComplete={poller.isReady}
    progress={poller.progress}
  />
  ```
- In the `onReady` callback, add a local ref guard as a second layer of protection against double-fires

### Files to Modify

| File | Changes |
|------|---------|
| `src/hooks/useGenerationPoller.ts` | Add `onReadyCalledRef` guard to prevent duplicate onReady calls |
| `src/components/planner/shared/GenerationPhases.tsx` | Remove internal polling; accept data as props; fix off-by-one; show activities; fix "cloud" text |
| `src/components/itinerary/ItineraryGenerator.tsx` | Pass poller data as props to GenerationPhases; add onReady guard ref |

### Risk
- **Low**: Removing duplicate polling is a clean simplification — one source of truth instead of two
- **Low**: Adding guard refs is additive, no behavior change on first fire

