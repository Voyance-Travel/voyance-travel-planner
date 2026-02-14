

# Fix #7: Replace Punitive Locked-State Language

## Summary

Update user-facing copy in 6 files to shift tone from "you can't have this" to "here's what you'll get." All changes are string-only, no logic modifications.

## Changes

### 1. `src/components/ItineraryView.tsx` (line 152)

**Before:** `"Book to unlock full itinerary"`
**After:** `"Unlock to explore your full itinerary"`

### 2. `src/components/itinerary/UnlockBanner.tsx` (lines 142-145)

**Before:**
```
Preview Mode: Details Locked
Unlock days to see addresses, photos, tips & booking links
```
**After:**
```
Your trip is ready to explore
Unlock days for addresses, photos, insider tips and booking links
```

### 3. `src/components/itinerary/DayLockOverlay.tsx` (line 69)

**Before:** `"Unlock to see all activities, swap options, and route optimization for this day."`
**After:** `"Unlock this day to explore activities, swap options, and optimized routes."`

### 4. `src/components/itinerary/LockedPhotoPlaceholder.tsx` (line 23)

**Before:** `"Premium"`
**After:** `"Unlock to view"`

### 5. `src/components/itinerary/AiFeatureGate.tsx` (line 23)

**Before:** `"{feature} requires credits"`
**After:** `"Unlock {feature} with credits"`

### 6. `src/components/itinerary/LockedDayCard.tsx` (line 98)

**Before:** `"This day hasn't been planned yet."`
**After:** `"Want us to plan this day for you?"`

## What does NOT change
- No logic changes in any file
- No changes to voyanceFlowController.ts
- No changes to credit deduction, entitlements, or edge functions
- No changes to component structure or layout
- UpgradePrompt.tsx left as-is (it handles subscription upsells, not day-unlock gating)

