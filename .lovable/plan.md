

## Fix: PaymentsTab Showing Generic "Activity" Instead of Real Names

### Problem
The Payments tab displays items as "Activity" with "Day 4" underneath, instead of real names like "Breakfast at Four Seasons" or "Wagyu Dinner at Yakiniku Black Hole".

### Root Cause
Two independent issues:

1. **`usePayableItems.ts` reads `activity.title` and `activity.name`** (line 217), but the itinerary data from the database may store the activity name under a different field (e.g., just `name` without `title`). When both are undefined, it falls back to `'Activity'`.

2. **`EditorialItinerary.tsx` initial load bypasses the title sanitizer.** The sanitizer (line 1365) only runs via the `setDays` wrapper, but `useState<EditorialDay[]>(initialDays)` at line 1352 sets `rawDays` directly — so activities loaded from DB on first render keep their raw shape (potentially missing `title`).

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

Apply the same sanitization to `initialDays` before passing to `useState`:

```typescript
// Line 1352 — sanitize initialDays inline:
const [rawDays, setRawDays] = useState<EditorialDay[]>(() =>
  initialDays.map(day => ({
    ...day,
    activities: (day.activities || [])
      .filter(a => a != null)
      .map(a => {
        const raw = a as any;
        const safeTitle = a.title || raw.name || raw.venue || 'Untitled Activity';
        return { ...a, title: safeTitle };
      }),
  }))
);
```

**File: `src/hooks/usePayableItems.ts`**

Strengthen the name resolution at line 217 to check more fields from the raw activity object:

```typescript
name: activity.title || activity.name || (activity as any).venue || 'Activity',
```

### Result
- Activities in the Payments tab will show their real names ("Breakfast at Four Seasons", "Nezu Museum", etc.) instead of generic "Activity".
- The fix works both for fresh loads and for activities injected during generation.

### Files Changed
| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Sanitize `initialDays` in `useState` initializer |
| `src/hooks/usePayableItems.ts` | Add `venue` fallback to name resolution |

