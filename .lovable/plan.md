

## Fix: Disable Cost Auto-Estimation in Manual (Build It Myself) Mode

### Problem
In "Build It Myself" mode, the `getActivityCost` function sees activities with `cost.amount === 0` and titles matching "never free" keywords (e.g., "Train to Zaanse Schans" matches `train to`). It then runs the estimation engine, producing ~€32/pp — contradicting the user's own description ("€6 return train, free entry").

Manual mode is for users who want full control. Auto-estimating costs overrides their intent.

### Root Cause
`getActivityCost()` (line 1025 of `EditorialItinerary.tsx`) has no awareness of whether the trip is in manual mode. It applies the same "never free" estimation logic to all activities regardless of origin.

The `costSource: 'imported'` guard (line 1059) only works for activities added via the Import modal. Activities added via other manual-mode paths (inline add, paste, AI-assisted add) don't have `costSource` set, so they fall through to estimation.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

**Change 1:** Pass `isManualMode` into `getActivityCost` (it's already available in the component scope where the function is called).

**Change 2:** In `getActivityCost`, when `isManualMode === true` and `costAmount === 0`, return `{ amount: 0, isEstimated: false }` immediately — skip the "never free" estimation entirely. Manual mode trusts the user's data as-is.

This is a ~5-line change: add the parameter, add one early-return condition before the `shouldNeverBeFree` check at line 1063.

### Scope
1 file, ~5 lines changed. No backend changes.

