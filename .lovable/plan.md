

## Plan: Fix Frontend Generation UX — Live Progress + Seamless Return

### Status: ✅ IMPLEMENTED

### Changes Made

#### 1. `useGenerationPoller.ts` — DONE
- Polls both `trips` table AND `itinerary_days` table in parallel each cycle
- Uses `Math.max(metadata count, itinerary_days count)` for accurate `completedDays`
- Exposes `generatedDaysList` (array of `{day_number, title, theme, description}`) for the progress UI
- **Auto-resume on stall**: When stall detected (heartbeat > 3min OR no new day in 5min), automatically invokes `generate-itinerary` to resume. Only attempts once. If auto-resume fails, fires `onStalled` for manual fallback.
- Recognizes both `'ready'` and `'generated'` as completion statuses

#### 2. `TripDetail.tsx` — DONE
- On page load, checks `itinerary_days` count alongside trip status
- `isServerGenerating` now includes the case where `itinerary_days` exist but `itinerary_data` is null
- Stalled UI replaced: shows "Reconnecting..." with auto-resume, manual retry as secondary option
- Progress view shows day-by-day list from `generatedDaysList` with day number badges, titles, themes, and checkmarks
- Time remaining estimate shown inline
- "Feel free to leave" messaging updated

#### 3. `GenerationPhases.tsx` — DONE
- Added `totalDays` prop
- Dynamic time estimates: ≤3 days → "2-4 minutes", 4-7 → "about X minutes", 8+ → "about X minutes. You can leave and come back."

#### 4. `ItineraryGenerator.tsx` — DONE
- Passes `totalDays={totalDaysEstimate}` and `destination` to `GenerationPhases`

#### 5. Edge Function `generate-itinerary/index.ts` — DONE
- Both initial chain and day-to-day chain use 3-attempt retry with exponential backoff (2s, 4s, 6s)
- Handles intermittent 403 errors gracefully

#### 6. `index.css` — DONE
- Added `fadeInUp` keyframe animation for day list items
