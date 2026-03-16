

# Make Refresh Day Actionable — Auto-Fix Guidance for Every Issue

## The Problem

The refresh tool correctly identifies scheduling conflicts (operating hours, overlaps, buffer gaps) but leaves users stranded on the "what now?" step. Closed venues get a vague "consider swapping" suggestion with no way to act on it. Operating hours warnings show the right times but the "Apply" button only works for some issues. A first-time Tokyo traveler sees red warnings and has to figure out the fix themselves.

## What's Already Working

The backend (`refresh-day/index.ts`) already generates `proposedChanges` with `patch` objects for:
- **Too-early starts** → time shift to opening time ✅
- **Overlaps** → shift the next activity forward ✅
- **Insufficient buffers** → add buffer time ✅

What's **missing patches**:
- **Closed venues** → no patch, just text "Consider swapping" — no way to act
- **Too-late endings** → no patch, just text "Adjust to finish by X" — no concrete change
- The DiffView shows these as issues but without an actionable proposed change

## The Fix — 3 Changes

### 1. Backend: Add patches for all issue types
**File: `supabase/functions/refresh-day/index.ts`**

- **Closed venues**: Add a proposed change with `type: 'replacement'` and a `patch: { needsSwap: true }` flag. This tells the UI to offer a "Find Alternative" action instead of a time shift.
- **Too-late endings**: Calculate an earlier start time that allows the activity to finish by closing time, and emit a `time_shift` patch (same as the too-early case but in reverse).

### 2. Frontend DiffView: Show "Find Alternative" for replacement-type changes
**File: `src/components/itinerary/RefreshDayDiffView.tsx`**

- For changes with `type: 'replacement'`, show a "Find Alternative" button instead of the time diff display
- Add an `onFindAlternative` prop that receives the activity ID/title, which the parent wires to open the swap drawer
- Add a reassuring summary line at the top when all issues have fixes: "All issues can be resolved — review the changes below"

### 3. Parent wiring: Connect "Find Alternative" to the swap drawer
**File: `src/components/itinerary/EditorialItinerary.tsx`**

- Pass `onFindAlternative` to `RefreshDayDiffView` that sets `swapDrawerActivity` and opens the alternatives drawer
- Find the matching activity from the current day's activities by ID to populate the drawer correctly

## Files Changed
- **`supabase/functions/refresh-day/index.ts`** — Add replacement patch for closed venues, time-shift patch for too-late endings
- **`src/components/itinerary/RefreshDayDiffView.tsx`** — Handle `replacement` type with "Find Alternative" button, add `onFindAlternative` prop
- **`src/components/itinerary/EditorialItinerary.tsx`** — Wire `onFindAlternative` to open the existing swap drawer

