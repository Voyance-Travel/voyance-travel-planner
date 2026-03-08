

## Reorder Tabs: Budget and Payments Side by Side

The current tab order is: **Itinerary → Budget → Details → Payments → Info**

The user wants Budget and Payments next to each other, with Trip Details moved after them.

### Change

**File:** `src/components/itinerary/EditorialItinerary.tsx` (line 3777-3783)

Reorder the tab array from:
```
Itinerary, Budget, Details, Payments, Info
```
to:
```
Itinerary, Budget, Payments, Details, Info
```

This means swapping the `details` and `payments` entries in the array, and removing `mobileOverflow: true` from `payments` so it's always visible (since it's now a primary tab next to Budget). The `details` tab gets `mobileOverflow: true` instead, moving it into the mobile overflow menu.

### Summary

| File | Change |
|------|--------|
| `src/components/itinerary/EditorialItinerary.tsx` | Swap tab order so Payments comes right after Budget, Details moves to overflow on mobile |

