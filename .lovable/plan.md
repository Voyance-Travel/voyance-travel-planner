

## Fix: Travel Date Edits Not Reflecting Without Page Refresh

### Root Cause

When dates are edited via `TripDateEditor`, `TripDetail.tsx` correctly updates local `trip` state and writes to the database. The new `editorDays` (with updated dates) flow down to `EditorialItinerary` as the `initialDays` prop.

However, `EditorialItinerary` maintains its own internal `days` state (line 1295) and only re-syncs from `initialDays` when a content fingerprint changes (line 1840-1854). **The fingerprint only checks `dayNumber` and `activity.id` — it does not include `date`**. So when dates shift (same activities, same day numbers, only dates change), the fingerprint is identical and the internal state keeps the old dates.

Additionally, the React Query cache for `['trip', tripId]` is never invalidated after a date change, so any component reading from the cache also sees stale data.

### Fix

Two changes, both in existing files:

| # | File | Change |
|---|------|--------|
| 1 | `EditorialItinerary.tsx` (line ~1841) | Add `d: d.date` to the fingerprint object so date changes trigger a re-sync of internal days state |
| 2 | `TripDetail.tsx` (line ~1858) | After successful DB save in `handleDateChange`, call `queryClient.invalidateQueries({ queryKey: ['trip', tripId] })` and `queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] })` so all consumers see fresh data |

### Fingerprint Change (EditorialItinerary.tsx)

```typescript
// BEFORE (line 1841):
return JSON.stringify(initialDays.map(d => ({
  n: d.dayNumber,
  a: d.activities.map(a => a.id),
})));

// AFTER:
return JSON.stringify(initialDays.map(d => ({
  n: d.dayNumber,
  d: d.date,          // ← include date so shifts/extends trigger sync
  a: d.activities.map(a => a.id),
})));
```

### Cache Invalidation (TripDetail.tsx)

After the successful DB write (around line 1858), add:
```typescript
queryClient.invalidateQueries({ queryKey: ['trip', tripId] });
queryClient.invalidateQueries({ queryKey: ['trips-lightweight'] });
```

This ensures the dashboard and any other views also reflect the updated dates immediately.

