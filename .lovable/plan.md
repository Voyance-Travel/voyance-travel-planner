

## Fix: Smart Date Defaults for Split-Stay Hotel Entry

### Problem
When adding a second (or third) hotel in a split stay, the check-in/check-out dates default to the full trip range (`startDate` → `endDate`). The user has to manually adjust the dates every time. Instead, the new hotel's check-in should default to the previous hotel's checkout date, and the checkout should default to the trip end date (or the remaining days).

### Fix

**File: `src/pages/Start.tsx`**

Two locations need smart date defaults:

**1. Single-city "Add another hotel" button (line ~1753)**

Currently:
```typescript
setNewHotelDraft({
  name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00',
  checkInDate: startDate, checkOutDate: endDate,
});
```

Change to compute the next available check-in date from the existing hotels:
```typescript
// Get the latest checkout date from existing hotels
const existingHotels = manualHotelList.length > 0
  ? manualHotelList
  : (manualHotel.name ? [manualHotel] : []);
const latestCheckout = existingHotels.reduce((latest, h) => {
  return h.checkOutDate && h.checkOutDate > latest ? h.checkOutDate : latest;
}, startDate);

setNewHotelDraft({
  name: '', address: '', neighborhood: '', checkInTime: '15:00', checkOutTime: '11:00',
  checkInDate: latestCheckout,
  checkOutDate: endDate,
});
```

**2. Multi-city "Add Another" button (line ~1550)**

Same logic but scoped to the city's hotels and date bounds (`dest.arrivalDate` / `dest.departureDate`). When opening the modal for a new hotel in a city that already has hotels, default check-in to the latest checkout of existing hotels in that city.

### Summary

| File | Change |
|---|---|
| `Start.tsx` | Smart-default new hotel check-in to previous hotel's checkout for both single-city and multi-city split stays |

