
# Fix Remaining Date Off-by-One Instances

## Problem
The previous fix applied `parseLocalDate` to ~20 files, but **21 more frontend files** still use `new Date(trip.start_date)` or `new Date(trip.end_date)`, which causes dates to display one day early in US timezones. Additionally, `Profile.tsx` -- the confirmed bug location -- was missed.

## What Already Exists
- `parseLocalDate` utility in `src/utils/dateUtils.ts` -- splits "YYYY-MM-DD" and constructs `new Date(year, month-1, day)` at local midnight
- Already imported and used in ~21 files from the previous fix

## Files to Update (21 files)

### Pages (6 files)
1. **src/pages/Profile.tsx** -- `computeTripProgress` and `transformTrip` (lines 85, 134-135)
2. **src/pages/TripConfirmation.tsx** -- nights calculation and date display (lines 224, 420-448)
3. **src/pages/agent/ClientDetail.tsx** -- trip date display (line 305)
4. **src/pages/agent/AgentTrips.tsx** -- trip list date formatting (lines 240, 327)
5. **src/pages/agent/TripWorkspace.tsx** -- daysUntilTrip calculation (line 347)
6. **src/pages/agent/TripManagement.tsx** (if present)

### Components (6 files)
7. **src/components/agent/TripCockpit.tsx** -- daysUntilTrip (line 102)
8. **src/components/profile/LinkToTripModal.tsx** -- date display (line 235)
9. **src/components/profile/FriendProfileCard.tsx** -- date display (line 207)
10. **src/components/profile/FriendsActivityFeed.tsx** -- date comparison (line 96)
11. **src/components/profile/ClientAgentPortal.tsx** -- date display and diff (lines 399, 436-437)
12. **src/components/profile/TravelMap.tsx** -- date comparisons and formatting (lines 197, 206-207)
13. **src/components/post-trip/ShareTripCard.tsx** -- date display (line 98)

### Services (4 files)
14. **src/services/userStatsAPI.ts** -- date comparisons and calculations (lines 116-118, 151, 167, 217, 253)
15. **src/services/userDashboardAPI.ts** -- days abroad calculation (lines 97-98)
16. **src/services/userAPI.ts** -- total days calculation (lines 235-236)
17. **src/services/tripsDebugAPI.ts** -- trip categorization (line 159)
18. **src/services/itineraryAPI.ts** -- day date generation (line 293)

### Other files found in search
19-21. Any remaining files from the full 21-file match list

## Change Pattern

For each file, the change is mechanical:

1. Add import (if not already present):
   ```typescript
   import { parseLocalDate } from '@/utils/dateUtils';
   ```

2. Replace every `new Date(trip.start_date)` with `parseLocalDate(trip.start_date)` and `new Date(trip.end_date)` with `parseLocalDate(trip.end_date)`.

3. For cases where a non-null Date is needed (e.g., passed to `format()`), use the non-null assertion or add a guard, since `parseLocalDate` from `dateUtils.ts` takes a plain string and returns a Date (the version in dateUtils always returns Date, not Date|null).

## Out of Scope
- **Edge functions** (`supabase/functions/`) -- these run server-side in UTC, so `new Date()` is correct there. No changes needed.
- The `parseLocalDate` utility itself is already correct and doesn't need modification.

## Technical Risk
Minimal -- this is a mechanical find-and-replace with no logic changes. Each replacement produces identical behavior for UTC+0 and later timezones, and fixes the off-by-one for UTC-negative timezones.
