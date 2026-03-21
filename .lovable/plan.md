

## Fix: TransitBadge Mode Buttons Don't Apply Changes

### Root cause

In `handleTransportModeChange` (EditorialItinerary.tsx, line 2356), the **success path** (line 2403-2427) tries to match the optimize API's returned activity IDs with the original activity IDs:

```typescript
const optAct = optimizedDay.activities?.find((oa: any) => oa.id === act.id);
if (optAct?.transportation && act.id === activityId) {
  // update transportation
}
return act; // ← unchanged if no match
```

When the optimize API returns activities with **different IDs** (common with AI-generated responses) or returns no `transportation` field for the matching activity, the condition fails silently. The activity is returned unchanged, and the user sees no effect despite the toast saying "Updated to Walk."

The **fallback paths** (no data at line 2430, error at line 2467) both work correctly because they update by matching `act.id === activityId` directly without relying on the API's activity IDs.

The between-activity TransitModePicker works because it calls `onEdit(dayIndex, activityIndex, updatedActivity)` directly with a pre-built activity object, bypassing the optimize API entirely.

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx` (lines ~2403-2427)**

In the success path, if the optimize API returns data but no matching activity transport is found, fall through to the same local update logic used in the fallback paths. Also add `e.stopPropagation()` to TransitBadge mode buttons to prevent any parent click interference.

**File: `src/components/itinerary/TransitBadge.tsx` (line ~181)**

Add `e.stopPropagation()` to mode button clicks as defensive measure.

### Specific changes

**EditorialItinerary.tsx — success path (~line 2403-2427):**

After the `setDays` call in the success path, check if any activity was actually updated. If the optimize API returned data but didn't match, apply the local fallback:

```typescript
if (data?.days?.[0]) {
  const optimizedDay = data.days[0];
  let wasUpdated = false;
  
  setDays(prev => prev.map((d, idx) => {
    if (idx !== dayIndex) return d;
    return {
      ...d,
      activities: d.activities.map(act => {
        const optAct = optimizedDay.activities?.find((oa: any) => oa.id === act.id);
        if (optAct?.transportation && act.id === activityId) {
          wasUpdated = true;
          // existing update logic...
        }
        // NEW: If this is the target activity and optimize didn't match, apply local fallback
        if (!wasUpdated && act.id === activityId && act.transportation) {
          wasUpdated = true;
          const mLabels = { walking: 'Walk', walk: 'Walk', metro: 'Metro', ... };
          const destMatch = (act.title || '').match(/^.+?\sto\s(.+)$/i);
          const newTitle = destMatch ? `${mLabels[newMode.toLowerCase()] || newMode} to ${destMatch[1]}` : act.title;
          return {
            ...act,
            title: newTitle,
            location: act.location ? { ...act.location, name: newTitle } : act.location,
            transportation: { ...act.transportation, method: newMode },
          };
        }
        return act;
      }),
    };
  }));
}
```

**TransitBadge.tsx — line ~181:**

Add `e.stopPropagation()` to prevent any parent element from intercepting the click:

```typescript
<button
  key={mode.value}
  onClick={(e) => { e.stopPropagation(); handleModeSelect(mode.value); }}
  disabled={isActive}
  ...
```

### Scope
Two files: `EditorialItinerary.tsx` (~15 lines changed in success path) and `TransitBadge.tsx` (1 line changed for stopPropagation).

