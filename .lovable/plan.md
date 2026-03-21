

## Fix: Regenerate Day creates duplicate hotel entries and renames day title

### Problem
The Regenerate Day flow in `EditorialItinerary.tsx` (line 4239-4284) has the same hotel duplication bug that was fixed in `itineraryActionExecutor.ts` — but through a completely separate code path. When clicking the ↻ Regenerate button:

1. Locked activities are preserved via `keepActivities`, but accommodation isn't excluded — so the backend receives the hotel ID as "kept" AND generates a new hotel entry
2. The backend returns a fully new day object (including a new title like "Tokyo Heights & Market Bites"), which replaces the original day wholesale at line 4284
3. No post-merge dedup runs, so duplicate hotels appear (tripling the cost)

### Root cause
Two issues in `handleDayRegenerateInternal` (lines 4230-4292):
- `keepActivities` includes accommodation/hotel activities, causing the same duplication as the Trip Assistant rewrite
- The raw `data.day` from the backend replaces the entire day, including the title, without preserving the original title

### Fix

**File: `src/components/itinerary/EditorialItinerary.tsx` (lines ~4239-4284)**

1. **Filter accommodation from keepActivities** — reuse the same `isAccommodationActivity` pattern from `itineraryActionExecutor.ts`:

```typescript
const keepActivities = (day.activities || [])
  .filter(a => a.isLocked && !isAccommodationLike(a))
  .map(a => a.id)
  .filter(Boolean);
```

Add a local helper:
```typescript
const isAccommodationLike = (a: EditorialActivity) => {
  const cat = (a.category || '').toLowerCase();
  const title = (a.title || '').toLowerCase();
  return cat === 'accommodation' || cat === 'hotel' || cat === 'stay'
    || title.includes('hotel check') || title.includes('check-in at')
    || title.includes('check into');
};
```

2. **Post-regeneration accommodation dedup** — after receiving `data.day`, deduplicate hotel entries (keep original, remove AI duplicate):

```typescript
if (data?.day) {
  const originalHotel = day.activities.find(isAccommodationLike);
  if (originalHotel && data.day.activities) {
    // Remove AI-generated duplicate hotel
    const dupeIdx = data.day.activities.findIndex(a =>
      isAccommodationLike(a) && a.id !== originalHotel.id
    );
    if (dupeIdx !== -1) {
      data.day.activities.splice(dupeIdx, 1);
      if (!data.day.activities.some(a => a.id === originalHotel.id)) {
        data.day.activities.push(originalHotel);
      }
    }
  }
  // Preserve original day title (don't let backend rename it)
  data.day.title = day.title;
  data.day.theme = day.theme;
  ...
}
```

3. **Preserve day title/theme** — the backend shouldn't rename a day the user hasn't asked to rename. Set `data.day.title = day.title` and `data.day.theme = day.theme` before applying.

### Scope
Single file: `src/components/itinerary/EditorialItinerary.tsx`, ~20 lines added around the `handleDayRegenerateInternal` function.

