

## Plan: Modernize Mobile Trip Detail UI — Remaining Changes

### What's Already Done (from previous rounds)
- Change 1 (Slim hero): `h-40` mobile, compact status line ✅
- Change 2 (MobileTripOverview): Collapsible with localStorage ✅
- Change 3 (Simplified tabs): 3 visible + "⋯" overflow on mobile ✅
- Change 5 (Intelligence Summary collapse): Auto-collapse on return visits ✅
- Change 8 (Flight grid overlap): Fixed with `grid-cols-1 sm:grid-cols-2` ✅
- Change 9 (Date display overlap): Separate mobile/desktop rendering ✅

### What Remains

#### 1. Fix Generation Progress UI in TripDetail.tsx (lines 1427-1531)
The `ItineraryGenerator` generation bugs were fixed, but `TripDetail.tsx` has its own **separate** inline generation progress view (used when returning to a trip mid-generation) that still has the same bugs:

- **Line 1457:** "Building in the cloud" → "Building in the background"
- **Line 1436:** Off-by-one: `completedDays + 1` shows "Day 6 of 5" when done. Add guard: if `completedDays >= totalDays`, show "Finalizing your itinerary..." instead
- **Lines 1476-1491:** Completed day cards only show title/theme. Add activity preview: show first 3 activities with times from `generatedDaysList[].activities`

#### 2. Streamline Utility Bar on Mobile (Change 4)
File: `src/components/itinerary/ItineraryUtilityBar.tsx`

- On mobile, show only **Share** and **Export PDF** as visible buttons
- Move **Save** (already auto-saving) and **Regenerate** into a "⋯" overflow `DropdownMenu`
- Keep desktop layout unchanged

#### 3. Lighten Day Headers on Mobile (Change 6)
File: `src/components/itinerary/EditorialItinerary.tsx` (day header rendering)

- On mobile, move Lock/Regenerate/Routes icons into a "⋯" overflow menu on the day header
- Keep only the collapse chevron as a direct button
- Reduce the large day number styling to a compact "DAY 4" prefix on mobile

#### 4. Breathing Room Polish (Change 7)
File: `src/components/itinerary/EditorialItinerary.tsx`

- Increase gap between activity cards from `space-y-3` → `space-y-4` on mobile
- Reduce card-within-card shadows (Voyance Insight inside activity cards)

#### 5. "Join Own Trip" Notification (Change 10)
This requires a backend check. In the edge function or database trigger that creates "member joined" notifications, add a guard: skip notification when `joining_user_id === trip.owner_id`.

### Files to Modify

| File | Changes |
|------|---------|
| `src/pages/TripDetail.tsx` | Fix generation progress: text, off-by-one, activity preview |
| `src/components/itinerary/ItineraryUtilityBar.tsx` | Mobile: 2 primary buttons + overflow |
| `src/components/itinerary/EditorialItinerary.tsx` | Mobile day header overflow menu, spacing polish |
| Backend notification logic (edge function or trigger) | Guard against self-join notifications |

### Priority
1. Generation progress fixes (visible bugs)
2. Utility bar streamlining (button clutter)
3. Day header overflow (visual density)
4. Spacing polish
5. Self-join notification (low priority)

