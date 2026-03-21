

## Fix: Inline Transport Mode Buttons Only Work Once

### Root cause

In `handleTransportModeChange` (EditorialItinerary.tsx, line 2413), the success path takes the optimize API's `transportation` object **wholesale**:

```typescript
const updatedAct = { ...act, transportation: optAct.transportation };
```

This replaces the entire transportation object with whatever the API returned — including `method`. If the optimize API returns `method: 'metro'` (because it considers metro optimal for that route), the user's click on "Walk" is silently overridden. The title gets updated correctly to "Walk to X" (line 2417), but the `transportation.method` stays as the API's choice.

On the **next** click, TransitBadge reads `transportation.method` → still 'metro' → the metro button appears active → the user clicks something else → the API returns metro again → stuck forever.

The title update masks the bug: the label says "Walk to X" but the underlying method is still 'metro', so TransitBadge highlights metro.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx` (~line 2413)**

Force the user's chosen mode onto the API response instead of trusting the API's method:

```typescript
// Before (broken):
const updatedAct = { ...act, transportation: optAct.transportation };

// After (fixed):
const updatedAct = { ...act, transportation: { ...optAct.transportation, method: newMode } };
```

One line change. The API's route details (duration, cost, instructions) are still used, but the method is always what the user clicked.

### Scope
Single line change in `EditorialItinerary.tsx`.

