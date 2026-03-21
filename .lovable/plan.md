

## Fix: Rewrite dedup only removes first hotel duplicate

### Root cause (line 268-279)

```typescript
const dupeIdx = newActivities.findIndex(a => isAccommodationActivity(a) && a.id !== originalHotel.id);
if (dupeIdx !== -1) {
  newActivities = newActivities.filter((_, i) => i !== dupeIdx); // removes ONE
  if (!newActivities.some(a => a.id === originalHotel.id)) {
    newActivities.push(originalHotel); // adds original back
  }
}
```

`findIndex` returns the **first** match only. If the AI generates 2 hotel activities (which happens when it copies the original + adds a new "Hotel Check-in & Refresh"), only one gets removed. Then `originalHotel` is pushed back because its ID isn't in the AI set → result: 2 hotel entries.

### Fix

**File: `src/services/itineraryActionExecutor.ts` (lines 265-280)**

Replace `findIndex`-based single removal with `filter`-based removal of **all** AI-generated accommodation, then ensure the single original hotel is present:

```typescript
const originalHotel = day.activities.find(a => isAccommodationActivity(a));
if (originalHotel) {
  // Remove ALL AI-generated accommodation entries
  newActivities = newActivities.filter((a: Activity) => !isAccommodationActivity(a));
  // Re-insert the single original hotel
  newActivities.push(originalHotel);
  newActivities.sort((a: Activity, b: Activity) =>
    (a.startTime || a.time || '').localeCompare(b.startTime || b.time || '')
  );
}
```

This guarantees exactly one hotel entry regardless of how many the AI generates.

### Scope
Single file, ~10 lines changed. Same pattern should be verified in `EditorialItinerary.tsx`'s regenerate handler (the earlier fix) to ensure it also uses `filter` not `findIndex`.

