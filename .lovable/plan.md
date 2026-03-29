

# Fix Meal Time Ordering

## Problem
The meal time validator in `sanitization.ts` handles breakfast-after-2PM and lunch-after-5PM, but **misses dinner-before-11AM**. The user's bug ("Romantic Dinner" at 7:00 PM, "Lunch" at 7:10 PM) also reveals that the meal guard in `enforceRequiredMealsFinalGuard` assigns correct default times (lunch at 12:30, dinner at 19:00), but the AI-generated activities can have wrong times that aren't corrected.

## Changes

### 1. `sanitization.ts` — Add dinner-before-11AM correction (line ~186)

After the breakfast check, add:
```typescript
} else if ((titleLower.includes('dinner') || categoryLower === 'dinner') && hour < 11) {
  act.startTime = '19:00';
  act.endTime = '20:15';
}
```

This completes the three-way meal time validation: breakfast ≥14→08:00, lunch ≥17→12:30, dinner <11→19:00.

### 2. `action-generate-trip-day.ts` — Already correct

The `enforceRequiredMealsFinalGuard` call (line 832) already uses `fallbackTimes` with correct meal-type times (breakfast 08:30, lunch 12:30, dinner 19:00) and sorts by startTime afterward. No changes needed here.

## Files to modify
- `supabase/functions/generate-itinerary/sanitization.ts` — add dinner time correction

One small, targeted edit.

