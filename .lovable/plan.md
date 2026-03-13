

## Fix: Disable Drag-and-Drop in Preview Mode

### Problem
In preview mode (`viewMode='preview'`), activity cards are still draggable. The `DraggableActivityList` at line 8126 uses `disabled={!isEditable || isPreview || isModalEditing}`, but `isPreview` here refers to the per-day premium gate (locked/unlocked days), NOT the clean preview mode toggle. The `isCleanPreview` flag (derived from `viewMode === 'preview'`) is passed to `DaySection` but not included in the drag disable condition.

### Fix
**File: `src/components/itinerary/EditorialItinerary.tsx` — line 8126**

Change:
```
disabled={!isEditable || isPreview || isModalEditing}
```
To:
```
disabled={!isEditable || isPreview || isCleanPreview || isModalEditing}
```

This is a one-line fix. The `isCleanPreview` prop is already available in `DaySection` (passed at line 5123, received at line 7832).

