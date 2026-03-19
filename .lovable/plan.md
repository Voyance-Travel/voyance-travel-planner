

## Fix: Normalize imported times to 24h at storage, harden all time consumers

### Root Cause

`createTripFromParsed.ts` line 66 stores raw AI output (`"11:00 AM"`, `"1:00 PM"`) directly as `startTime` without converting to 24h format. Multiple downstream consumers then use `parseInt(time.split(':')[0])` — which gives wrong results for any 12h string with PM, and provides no validation against AI mis-extractions like "1:00 AM" for "11:00 AM".

### Changes

**1. Create shared `normalizeTimeTo24h` in `src/utils/timeFormat.ts`**

Add a single reusable function that converts any time string (12h or 24h) to `"HH:MM"` 24-hour format. This already exists in scattered inline forms across the codebase — consolidate into one.

**2. Normalize at storage in `src/utils/createTripFromParsed.ts`** (line 66)

Change `startTime: activity.time || undefined` to pass through the new normalizer. This ensures all imported activities are stored in consistent 24h format regardless of what the AI returns.

**3. Normalize at import in `src/components/itinerary/ImportActivitiesModal.tsx`**

The existing `normalizeTime` function already does this correctly, but add the shared utility as a safety net for the final output.

**4. Fix naive `parseInt(split(':')[0])` consumers**

Replace bare `parseInt` time parsing in these files with the proper `parseTimeToMinutes` that handles AM/PM:
- `src/components/itinerary/EditorialItinerary.tsx` (lines 1619, 1624, 1634, 1648, 1724, 1729, 1754, 1767, 9177, 9193)
- `src/utils/intelligenceAnalytics.ts` (line 18)
- `src/components/planner/ItinerarySummaryCard.tsx` (line 68)
- `src/pages/ActiveTrip.tsx` (line 918)

### Scope
- 1 utility addition (`timeFormat.ts`)
- 1 storage fix (`createTripFromParsed.ts`)
- 4 files with naive time parsing hardened

