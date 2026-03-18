

## Fix: Same-Hotel Transit Gaps + Mode Selection Not Persisting

### Problem 1: Bogus transit indicators between same-hotel activities

From the screenshot, all three activities are at the Mandarin Oriental hotel, but the system shows "27 min bus", "14 min metro", and "9 min bus" transit gaps between them. This happens because:

**Root cause**: The `sameLocation` check (line 8901 of EditorialItinerary.tsx) uses an exact string match on `location.name`:
```typescript
sameLocation={!!(activityToRender.location?.name && nextActivity?.location?.name 
  && activityToRender.location.name === nextActivity.location.name)}
```
But the location names differ slightly: "Mandarin Oriental, Marrakech" vs "Mandarin Oriental" vs "Mandarin". The exact match fails, so transit indicators appear.

Additionally, even when `sameLocation` IS true, the indicator is still rendered — it only suppresses the warning styling, not the row itself.

**Fix**:
1. **Fuzzy location matching** in EditorialItinerary.tsx (line 8901): Instead of exact `name === name`, use a helper that normalizes and checks if one name contains the other, or if addresses match. Also compare `location.address` when available.
2. **Hide the indicator entirely** when `sameLocation` is true in TransitGapIndicator.tsx: Add `sameLocation` to the `shouldHide` condition (line 224), so no transit row renders at all for same-venue transitions.

### Problem 2: Mode selection (bus→walk) doesn't visually persist

The user selects "Walk", gets a success toast, but the indicator still shows "Bus". 

**Root cause**: The `onSelectMode` callback updates `transportation` on the **current** activity (`activityIndex`). But the TransitGapIndicator is rendered between activity N and activity N+1, showing transit FROM N TO N+1. The `transportation` prop comes from `activityToRender.transportation` (the current activity). The update does write to the correct activity, and the state change propagates. However, the collapsed row reads `transportation?.method` to derive the label — and the `transportation` object being set uses `method: mode` where `mode` = `'walk'` (lowercase). The `getGapTransportLabel` function checks `m.includes('walk')` which should match.

The likely issue is that the `handleUpdateActivity` call triggers a re-render, but the TransitGapIndicator's **internal state** (`hasFetched`, `options`) is stale — OR — the component unmounts/remounts with stale props due to React key changes. But the most probable cause: the initial `transportation` data from the AI generation overrides the user's selection on the next save/sync cycle. Let me verify by checking if `setDays` triggers a DB persist that re-fetches.

After further inspection, the actual issue: the `onSelectMode` callback sets `transportation` on the activity, but the collapsed indicator ALSO reads from `transportation?.method` — however, looking at line 8897, `transportation={activityToRender.transportation}` is passed. After state update, `activityToRender.transportation.method` should be `'walk'`. The label should update.

The real persistence issue may be that `handleUpdateActivity` fires `setHasChanges(true)` but no immediate DB sync. If the user navigates away or the component re-fetches from DB, the un-synced change is lost. But even in-session the user reports it doesn't update visually — so there may be a key/remount issue.

To be safe, I'll ensure:
1. The `onSelectMode` callback properly propagates
2. Add a `selectedMode` state to TransitGapIndicator that tracks user selections locally for immediate visual feedback

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/EditorialItinerary.tsx` | Replace exact `location.name` match with fuzzy comparison helper that normalizes names and checks address overlap |
| 2 | `src/components/itinerary/TransitGapIndicator.tsx` | (a) Hide entirely when `sameLocation` is true (add to `shouldHide`). (b) Add local `selectedMode` state that updates immediately on mode selection, so the label/icon reflect the user's choice without waiting for parent re-render |

### Fuzzy Location Match Logic

```typescript
function isSameLocation(a: { name?: string; address?: string }, b: { name?: string; address?: string }): boolean {
  if (!a || !b) return false;
  // Exact name match
  if (a.name && b.name && a.name === b.name) return true;
  // Exact address match
  if (a.address && b.address && a.address === b.address) return true;
  // Fuzzy: normalize and check containment (handles "Mandarin" vs "Mandarin Oriental, Marrakech")
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (a.name && b.name) {
    const an = normalize(a.name);
    const bn = normalize(b.name);
    if (an.includes(bn) || bn.includes(an)) return true;
  }
  return false;
}
```

### TransitGapIndicator Hide Logic

```typescript
// Line 224: add sameLocation to shouldHide
const shouldHide = hasTransitBadge || eitherIsTransit || sameLocation;
```

### Mode Persistence Fix

Add local state in TransitGapIndicator to immediately reflect user's selection:
```typescript
const [userSelectedMode, setUserSelectedMode] = useState<string | null>(null);
// In onSelectMode handler, also call setUserSelectedMode(mode)
// Use userSelectedMode to derive label/icon when set
```

