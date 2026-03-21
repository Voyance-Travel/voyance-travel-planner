

## Fix: Rewrite Day creates duplicate hotel entries and inflates costs

### Problem
When the AI rewrites a day, hotel/accommodation activities (category: `accommodation`, `hotel`, or keywords like "check-in", "hotel") are treated as "protected" by `isProtectedActivity()`. Their IDs are sent to the backend via `keepActivities`. However, the AI also generates a new hotel check-in activity because the accommodation context is in the prompt. The backend's semantic dedup uses a 50% keyword match which often fails because the titles differ (e.g., "Four Seasons Otemachi" vs "Hotel Check-in & Refresh"). Result: two hotel entries, both at $1,204, inflating the trip total by ~$9,759.

### Root cause
In `src/services/itineraryActionExecutor.ts` line 232-234, `isProtectedActivity` includes `accommodation` in `PROTECTED_CATEGORIES`. This means hotel STAY activities get sent as locked, but the AI doesn't know to skip generating a hotel entry — it just avoids the locked time slot and places a new hotel activity at a different time.

### Fix

**File: `src/services/itineraryActionExecutor.ts` (lines ~230-255)**

Two changes:

1. **Exclude accommodation/hotel from `keepActivities`** — Hotel entries should NOT be sent as locked activities to the regeneration backend. They're not user-curated activities; they're logistics that should be handled by the schema compiler. Add a filter:

```typescript
const keepActivities = preserve_locked
  ? day.activities
      .filter(a => (a.isLocked || isProtectedActivity(a)) && !isAccommodationActivity(a))
      .map(a => a.id).filter(Boolean)
  : [];
```

2. **Post-rewrite dedup** — After receiving `newActivities` from the backend, deduplicate accommodation entries. If the original day had a hotel STAY and the AI generated another one, keep only the original:

```typescript
// Deduplicate hotel/accommodation entries: keep original, remove AI-generated duplicates
const originalHotel = day.activities.find(a => isAccommodationActivity(a));
if (originalHotel) {
  const dupeIdx = newActivities.findIndex(a =>
    isAccommodationActivity(a) && a.id !== originalHotel.id
  );
  if (dupeIdx !== -1) {
    newActivities.splice(dupeIdx, 1);
    // Re-insert original if not already present
    if (!newActivities.some(a => a.id === originalHotel.id)) {
      newActivities.push(originalHotel);
      newActivities.sort((a, b) => /* time sort */);
    }
  }
}
```

3. **Add helper function** `isAccommodationActivity`:
```typescript
function isAccommodationActivity(activity: Activity): boolean {
  const cat = norm(activity.category);
  const title = norm(activityTitle(activity));
  return cat === 'accommodation' || cat === 'hotel' || cat === 'stay'
    || title.includes('hotel check') || title.includes('check-in')
    || title.includes('check into');
}
```

### Scope
Single file: `src/services/itineraryActionExecutor.ts`. No backend changes needed — the issue is entirely in how the client pre-filters and post-processes the rewrite result.

