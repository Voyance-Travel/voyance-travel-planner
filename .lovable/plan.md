

## Minimum Activity Duration Enforcement

### The Problem
Activities get squeezed to absurdly short durations (e.g., 5-minute jazz show) when placed near end-of-day hotel returns.

### The Fix (2 files)

Add a minimum duration enforcement block **before** the timing overlap fixer in both generation files. This way, durations are corrected first, then any new overlaps created by extending durations get resolved by the existing overlap repair.

#### 1. `action-generate-trip-day.ts` — Insert before line 1193 (before "TIMING OVERLAP SAFETY NET")

- Define category-based minimums (`dining: 45`, `explore: 45`, `activity: 60`, `wellness: 60`, `nightlife: 75`)
- Define keyword-based minimums (jazz/concert/show → 90, museum/gallery → 60, dinner → 60, spa/hammam → 75, lunch → 45, breakfast → 30)
- Loop through `dayResult.activities`: compute current duration, determine minimum, extend `endTime` if too short (capped at midnight), or shift `startTime` earlier if extending would pass midnight
- Uses existing `_toMin` / `_toTime` helpers (move their declaration above this block)

#### 2. `action-generate-day.ts` — Insert before line 520 (before "TIME OVERLAP FIXER")

Same logic on `normalizedActivities`, using existing `parseTimeToMinutes` / `minutesToHHMM` helpers.

### Execution Order (both files)
1. Hallucination filter (68A)
2. Filler activity filter (68D)
3. Departure day timing (68B)
4. Wellness limiter (68C)
5. **Minimum duration enforcement (68G)** ← new
6. Timing overlap repair (68E)
7. Duplicate hotel return removal (68F)

### Files Changed
1. `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
2. `supabase/functions/generate-itinerary/action-generate-day.ts`

