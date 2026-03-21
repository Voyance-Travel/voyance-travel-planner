

## Fix: Regenerate Day still duplicates hotels via `onRegenerateDay` callback path

### Root cause

The dedup and title-preservation fixes (lines 4313-4325) only run in the `else` branch — when `onRegenerateDay` is **not** provided. But when it **is** provided (line 4242-4248), the returned day is applied wholesale with zero dedup, zero title preservation. The same gap exists in `ItineraryEditor.tsx` (lines 351-357 and 382-383).

### Fix

**File 1: `src/components/itinerary/EditorialItinerary.tsx` (lines 4242-4248)**

Apply the same dedup + title preservation to the `onRegenerateDay` path:

```typescript
if (onRegenerateDay) {
  const newDay = await onRegenerateDay(day.dayNumber);
  if (newDay) {
    // Deduplicate accommodation
    const originalHotel = (day.activities || []).find(isAccommodationLike);
    if (originalHotel && newDay.activities) {
      newDay.activities = newDay.activities.filter(a => !isAccommodationLike(a));
      newDay.activities.push(originalHotel);
      newDay.activities.sort((a, b) => 
        (a.startTime || a.time || '').localeCompare(b.startTime || b.time || '')
      );
    }
    // Preserve original title/theme
    newDay.title = day.title;
    newDay.theme = day.theme;
    setDays(prev => prev.map((d, idx) => idx === dayIndex ? newDay : d));
    ...
  }
}
```

Move `isAccommodationLike` helper above both branches so it's accessible to both.

**File 2: `src/components/itinerary/ItineraryEditor.tsx` (lines 351-357 and 382-383)**

Apply the same dedup pattern to both the `onRegenerateDay` path and the direct `data.day` path, plus preserve title/theme.

### Scope
Two files, ~30 lines total. Applies the existing fix pattern to the two code paths that were missed.

