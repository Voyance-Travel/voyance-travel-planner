

## Fix: Disable Drag While Edit Modals Are Open

**File:** `src/components/itinerary/EditorialItinerary.tsx`

**Line 8122** — Change:
```typescript
disabled={!isEditable || isPreview}
```
To:
```typescript
disabled={!isEditable || isPreview || !!editActivityModal || !!timeEditModal}
```

Both `editActivityModal` (line 1429) and `timeEditModal` (line 1430) are state variables in the same component scope. Single line change.

