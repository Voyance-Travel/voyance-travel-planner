

## Fix: Hotel Not Showing Accurately in Budget for Multi-City Trips

### Problem
Hotels show correctly in the Hotel tab (reads from `trip_cities.hotel_selection`) but the Budget tab shows $0 for hotel. Confirmed in DB: zero hotel rows exist in `activity_costs` for any multi-city trip, despite hotels being saved in `trip_cities`.

### Root Cause — Two bugs working together

**Bug 1: EditorialItinerary auto-sync deletes hotel costs on every load**

Line 1464 in `EditorialItinerary.tsx` runs on initial load:
```
if (hotelSelection) {
  syncHotelToLedger(tripId, hotelSelection as any)
}
```

For multi-city trips, `hotelSelection` comes from `trip.hotel_selection` which is **null** (hotels live on `trip_cities`, not on the trips table). So `syncHotelToLedger(tripId, null)` is called, which **removes** the hotel row from `activity_costs`. This undoes any hotel cost that was synced when the user saved the hotel in the planner.

**Bug 2: `trip_cities.hotel_cost_cents` is always 0 or per-night-only**

When saving a hotel in `PlannerHotelEnhanced.tsx` (line 537):
```
hotel_cost_cents: Math.round(pricePerNight * 100)
```
This stores the **per-night** rate, not the total stay cost. The city budget breakdown reads this field directly and shows wrong numbers.

### Fix — 3 files

**1. `src/components/itinerary/EditorialItinerary.tsx` (~line 1458)**

In the auto-sync block, before calling `syncHotelToLedger`, check `allHotels` (the per-city hotel array). For multi-city trips, sync each city hotel individually instead of relying on `hotelSelection`:

```
// If multi-city with allHotels, sync each city hotel
if (allHotels && allHotels.length > 0) {
  for (const cityHotel of allHotels) {
    if (cityHotel.hotel?.pricePerNight && cityHotel.checkInDate && cityHotel.checkOutDate) {
      const nights = Math.max(1, Math.ceil(...));
      syncHotelToLedger(tripId, {
        name: cityHotel.hotel.name,
        pricePerNight: cityHotel.hotel.pricePerNight,
        totalPrice: cityHotel.hotel.pricePerNight * nights,
        checkIn: cityHotel.checkInDate,
        checkOut: cityHotel.checkOutDate,
      });
    }
  }
} else if (hotelSelection) {
  // Single-city path (existing logic)
  syncHotelToLedger(tripId, hotelSelection as any);
}
```

Key: when `allHotels` exists, **do not call syncHotelToLedger with null** — that's what deletes the row.

**2. `src/services/budgetLedgerSync.ts` — Support summing multiple city hotels**

Currently `syncHotelToLedger` expects one hotel and stores one row. For multi-city trips with multiple hotels, the upsert needs to sum all hotel costs into the single `activity_costs` hotel row (day_number=0). Add a new export:

```typescript
export async function syncMultiCityHotelsToLedger(
  tripId: string,
  hotels: { name: string; totalPrice: number }[]
) {
  const totalUsd = hotels.reduce((sum, h) => sum + (h.totalPrice || 0), 0);
  const names = hotels.map(h => h.name).filter(Boolean).join(', ');
  if (totalUsd <= 0) {
    await removeLogisticsCost(tripId, 'hotel');
    return;
  }
  await upsertLogisticsCost(tripId, 'hotel', totalUsd, `Hotels: ${names}`);
}
```

**3. `src/pages/planner/PlannerHotelEnhanced.tsx` (~line 537)**

Fix `hotel_cost_cents` to store the total stay cost, not per-night:

```typescript
// Before:
hotel_cost_cents: Math.round(pricePerNight * 100),

// After:
hotel_cost_cents: Math.round(pricePerNight * nights * 100),
```

### Why hotel shows correctly elsewhere
The Hotel tab, itinerary cards, and Arrival Game Plan all read from `trip_cities.hotel_selection` directly (which has the hotel data). Only the Budget tab relies on `activity_costs` (which has zero hotel rows for multi-city trips due to Bug 1).

### Files
- `src/components/itinerary/EditorialItinerary.tsx` — fix auto-sync to handle multi-city hotels
- `src/services/budgetLedgerSync.ts` — add multi-city hotel sync function
- `src/pages/planner/PlannerHotelEnhanced.tsx` — fix hotel_cost_cents to store total, not per-night

