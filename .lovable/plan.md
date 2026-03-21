

## Remove "Cached" Badge from Travel Intel Card

### Change

**File: `src/components/itinerary/TravelIntelCard.tsx`**

Remove lines 303-307 that render the "Cached" badge:
```tsx
{isCached && (
  <Badge variant="outline" className="text-[10px] ml-1 px-1.5 py-0 text-muted-foreground">
    Cached
  </Badge>
)}
```

The `isCached` state variable and `setIsCached(!!data.cached)` call can also be removed as cleanup since nothing else references them. Caching behavior itself is untouched.

### Scope
1 file, ~10 lines removed. No logic changes.

