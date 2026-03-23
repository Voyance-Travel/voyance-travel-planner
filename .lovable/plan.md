

## Fix: Hotel Nights Off-By-One in Flights & Hotels Tab

### Problem
Mar 24 → Mar 27 = 3 hotel nights, but the Flights & Hotels tab shows "4 nights" and charges $3,920 (4 × $980) instead of $2,940 (3 × $980). The Budget tab correctly shows $2,940.

### Root Cause
Two places in `EditorialItinerary.tsx` use `days.length` as a fallback for hotel nights. `days.length` counts **calendar days** (Mar 24, 25, 26, 27 = 4), not **hotel nights** (3). Hotel nights = calendar days − 1.

**Line 3017** (hotel cost calculation):
```typescript
return (hotelSelection?.pricePerNight || 0) * (hotelSelection?.nights || days.length);
```

**Line 6424** (display label):
```typescript
`${hotelSelection.nights || days.length} nights`
```

Both should use `days.length - 1` (or better, compute nights from dates).

### Fix — 1 file

**`src/components/itinerary/EditorialItinerary.tsx`**

1. **Line 3017** — Change fallback from `days.length` to `Math.max(1, days.length - 1)`:
```typescript
return (hotelSelection?.pricePerNight || 0) * (hotelSelection?.nights || Math.max(1, days.length - 1));
```

2. **Line 6424** — Same fix for display label:
```typescript
`${hotelSelection.nights || Math.max(1, days.length - 1)} nights`
```

This also affects `ItineraryEditor.tsx` **line 675** which has the same pattern:
```typescript
{hotelSelection.nights || days.length} nights
```
→ Change to `hotelSelection.nights || Math.max(1, days.length - 1)`.

### Files
- `src/components/itinerary/EditorialItinerary.tsx` — fix cost calc and display label
- `src/components/itinerary/ItineraryEditor.tsx` — fix display label

