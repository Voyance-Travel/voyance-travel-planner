

## Fix: Auto-Route Optimizer Illogically Reorders Dining/Evening Activities

### Problem
The auto-route optimizer reorders activities by geographic proximity, then reassigns the original time slots to the new positions. This causes a canal boat tour (originally 6 PM) to be swapped into a 10:45 PM slot after dinner, because the optimizer treats both as "flexible" activities.

### Root Cause
`FIXED_CATEGORIES` in `auto-route-optimizer.ts` does not include `dining`. Meal and dining activities are treated as freely reorderable, but meals have natural time windows that shouldn't be disrupted by geographic optimization.

### Fix

**File: `supabase/functions/generate-itinerary/auto-route-optimizer.ts`**

**Change 1: Add `dining` to `FIXED_CATEGORIES` (line 37)**

Add dining-related categories so meals stay in their assigned time slots:
```typescript
'dining',
'food',
'restaurant',
```

**Change 2: Add meal-related title patterns to `FIXED_TITLE_PATTERNS` (line 49)**

Catch activities with meal keywords in their titles:
```typescript
/dinner\b/i,
/lunch\b/i,
/breakfast\b/i,
/brunch\b/i,
/supper\b/i,
```

This ensures that:
- Activities categorized as dining stay at their assigned times
- Activities with meal words in titles (e.g., "Dinner at De Kas") stay put
- Non-meal activities like "Canal Boat Tour" (category: `activity`/`sightseeing`) remain flexible for geographic optimization — but won't get swapped into a dining slot since the dining activity anchoring that slot is now fixed

### Scope
1 file, ~8 lines added. No client-side or database changes.

