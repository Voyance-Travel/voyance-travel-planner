

## Fix: Strip Internal System Language from Meal-Guard Tips

### Problem

When the meal-guard injects a missing breakfast or dinner, the `tips` field says:

> "Recommended by our venue database — confirm hours before visiting."

This is internal system language that should never be user-facing.

### Fix

**File: `supabase/functions/generate-itinerary/day-validation.ts` (lines 985-987)**

Replace the two tip strings with natural, user-friendly alternatives:

```typescript
tips: venue
  ? `A local favorite — we recommend confirming hours before visiting.`
  : `Ask a local or check recent reviews to find a great spot nearby.`,
```

Single line change, no logic changes needed.

