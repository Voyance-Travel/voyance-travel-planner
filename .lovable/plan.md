

# Fix: Allow transport mode switching on manually added activities

## Problem
When a user adds an activity manually, the new activity has no `transportation` data. The `TransitBadge` component (which has the mode-switching UI) only renders when `activity.transportation` exists. The `TransitGapIndicator` shows between all activities but is read-only — it fetches and displays transport options but has no "select/apply" action to write the chosen mode back to the activity.

Result: AI-generated activities have `transportation` populated and show the switchable `TransitBadge`, but manually added activities only get the non-interactive `TransitGapIndicator`.

## Fix

### 1. Add an "apply" callback to `TransitGapIndicator`
**File:** `src/components/itinerary/TransitGapIndicator.tsx`

- Add a new prop: `onSelectMode?: (mode: string, duration: string, cost: { amount: number; currency: string } | null) => void`
- When expanded and showing options, add a "Use this" button on each transport option row
- Clicking it calls `onSelectMode` with the option's data

### 2. Wire the callback in `EditorialItinerary.tsx` to update `activity.transportation`
**File:** `src/components/itinerary/EditorialItinerary.tsx`

- Where `TransitGapIndicator` is rendered (around line 8625), pass an `onSelectMode` handler
- The handler updates the current activity's `transportation` field in `days` state with the selected mode, duration, and cost
- Once `transportation` is set, the `TransitBadge` will render on subsequent renders, and its existing mode-switch functionality takes over

### 3. Ensure `TransitBadge` also renders for activities that gain transportation after add
No code change needed — it already checks `activity.transportation` dynamically. Once step 2 populates it, the badge appears.

## Files Changed

| File | Change |
|------|--------|
| `src/components/itinerary/TransitGapIndicator.tsx` | Add `onSelectMode` prop, render "Use this" button on each option |
| `src/components/itinerary/EditorialItinerary.tsx` | Pass `onSelectMode` handler that writes transportation data to the activity |

