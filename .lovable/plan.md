

## Fix: Disable Drag in Preview Mode

### Problem
`DraggableActivityList` at line 8122 uses `disabled={!isEditable}`, but Preview mode doesn't set `isEditable` to false — it's a separate flag (`isPreview`). So cards remain draggable in Preview mode.

### Change

**File: `src/components/itinerary/EditorialItinerary.tsx`** — Line 8122

Change:
```typescript
disabled={!isEditable}
```
To:
```typescript
disabled={!isEditable || isPreview}
```

`isPreview` is already destructured in the `DayCard` component props (line 7787), so it's in scope. Single-line fix.

