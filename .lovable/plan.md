

## Fix: Hotel Budget Warning When Accommodation Notes Exist

**Problem**: The budget tab shows "Some budgeted categories have no items yet: Hotel" even when accommodation notes have been parsed from the user's pasted trip research. The `hasHotel` prop only checks for formal hotel selections (`hotel_selection` or city-level hotel data), not for accommodation notes or check-in activities in the itinerary.

**Root cause**: Two disconnected data paths — accommodation notes live in `parsedMetadata` / `trip.metadata.accommodationNotes`, but the budget warning only checks `hotelSelection?.pricePerNight || hotelSelection?.name`.

### Fix — Two changes:

#### 1. Expand `hasHotel` detection in EditorialItinerary (line ~5500)
Also consider:
- Whether any itinerary activity has category `'hotel'` or `'accommodation'` or title containing "Check-in" / "Check-out"
- Whether `parsedMetadata?.accommodationNotes` has entries

```typescript
hasHotel={
  !!(hotelSelection?.pricePerNight || hotelSelection?.name) ||
  !!(parsedMetadata?.accommodationNotes?.length) ||
  days.some(d => d.activities.some(a => 
    a.category === 'hotel' || a.category === 'accommodation' ||
    /check.?in/i.test(a.title || a.name || '')
  ))
}
```

#### 2. Same expansion in TripDetail.tsx (lines ~2547 and ~2739)
Add the same accommodation notes and activity-based detection to both places where `hasHotel` is computed, checking `trip.metadata.accommodationNotes` and itinerary activities for hotel-category items.

### Files to change
- `src/components/itinerary/EditorialItinerary.tsx` — expand `hasHotel` prop (~line 5500)
- `src/pages/TripDetail.tsx` — expand `hasHotel` prop (~lines 2547 and 2739)

This is a targeted fix — no schema changes, no new components. The warning will be suppressed whenever the system has any evidence of accommodation planning (formal selection, parsed notes, or check-in activities).

