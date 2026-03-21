

## Fix: "Venue Name" not updated on Transport Mode Switch

### Problem
When switching a transport segment's mode (e.g., Taxi → Train/Metro), only `act.transportation.method` and `act.transportation.estimatedCost` are updated. The activity's `title` and `location.name` remain unchanged (e.g., still "Taxi to Tokyo Skytree"). When the Edit Activity modal opens, it reads these stale values.

### Root cause
Three transport-mode-update code paths in `EditorialItinerary.tsx` (lines ~2426, ~2460, and ~2410) all update `act.transportation` but never touch `act.title` or `act.location.name`.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx`**

In all three `setDays` blocks that handle transport mode changes, also update the activity title to reflect the new mode. Extract the destination from the existing title (the part after "to ") and rebuild it:

```typescript
// Inside each act mapping for transport mode change:
const destination = (act.title || '').replace(/^.+?\sto\s/i, '');
const newTitle = destination 
  ? `${modeLabels[newMode] || newMode} to ${destination}`
  : act.title;

return {
  ...act,
  title: newTitle,
  location: act.location ? { ...act.location, name: newTitle } : act.location,
  transportation: { ...act.transportation, method: newMode, ... },
};
```

This applies to:
1. Success path from optimize API (~line 2430)
2. Fallback when optimize returns no data (~line 2460)  
3. Error fallback (~line 2464)

### Scope
Single file: `src/components/itinerary/EditorialItinerary.tsx` — update 3 parallel code blocks (each ~2 lines added).

