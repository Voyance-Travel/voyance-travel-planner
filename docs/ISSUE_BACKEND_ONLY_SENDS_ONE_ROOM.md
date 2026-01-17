# 🚨 ISSUE: Backend Only Sending 1 Room Option Per Hotel

**Date:** October 21, 2025
**Status:** ❌ Backend Issue - Needs Fix
**Priority:** High

---

## 🔴 **The Problem**

Backend is currently sending the `roomOptions` array, but **only with 1 room option** per hotel.

**What we're seeing:**

```json
{
  "id": "hotel-123",
  "name": "Grand Hotel",
  "roomOptions": [
    {
      "id": "room-1",
      "type": "Deluxe Room", // ← Only ONE room type
      "bedType": "1 King Bed",
      "priceTotal": 4900,
      "pricePerNight": 350
      // ...
    }
    // ❌ No other room types!
  ]
}
```

**What we NEED:**

```json
{
  "id": "hotel-123",
  "name": "Grand Hotel",
  "roomOptions": [
    {
      "id": "room-std",
      "type": "Standard Room",
      "priceTotal": 3500,
      "pricePerNight": 250
      // ...
    },
    {
      "id": "room-dlx",
      "type": "Deluxe Room",
      "priceTotal": 4900,
      "pricePerNight": 350
      // ...
    },
    {
      "id": "room-suite",
      "type": "Suite",
      "priceTotal": 7000,
      "pricePerNight": 500
      // ...
    }
  ]
}
```

---

## 📊 **Current Behavior**

### **User Experience:**

When user goes to hotel selection page:

```
SELECT ROOM TYPE:

[Deluxe Room]          $4,900
 1 King Bed • 2 guests  $350/night

(Only 1 option - no choice!)
```

**Problem:**

- ❌ Users can't compare room types
- ❌ No Standard vs Deluxe vs Suite options
- ❌ Can't see price differences
- ❌ Defeats the purpose of room selection feature

### **Why Frontend Shows Only 1 Room:**

Frontend code (HotelCardWithRooms.tsx):

```typescript
const getRoomOptions = () => {
  // Check if backend provides roomOptions
  if (hotel.roomOptions && hotel.roomOptions.length > 0) {
    return hotel.roomOptions.map(...);  // ← Uses backend data
  }

  // Fallback: Generate 3 room types
  return [Standard, Deluxe, Suite];  // ← This never runs!
}
```

**Because backend IS sending `roomOptions` (with 1 item), our fallback never triggers.**

---

## 🔍 **Root Cause**

Backend is calling Amadeus Hotel API and getting multiple `offers[]`, but only returning the **first offer** as a single room option.

### **What Amadeus Returns:**

```json
{
  "data": [{
    "hotel": { ... },
    "offers": [
      { "id": "offer-1", "room": { "type": "Standard" }, "price": { "total": "3500" } },
      { "id": "offer-2", "room": { "type": "Deluxe" }, "price": { "total": "4900" } },
      { "id": "offer-3", "room": { "type": "Suite" }, "price": { "total": "7000" } }
    ]
  }]
}
```

### **What Backend Currently Does:**

```javascript
// ❌ BAD: Only takes first offer
const roomOption = {
  type: offers[0].room.type,
  price: offers[0].price.total,
  // ...
};

return {
  hotel: { ... },
  roomOptions: [roomOption]  // ← Only 1 room!
};
```

### **What Backend SHOULD Do:**

```javascript
// ✅ GOOD: Map all offers to roomOptions
const roomOptions = offers.map(offer => ({
  id: offer.id,
  type: offer.room.type,
  bedType: extractBedType(offer.room),
  size: extractSize(offer.room),
  maxOccupancy: offer.guests.adults,
  priceTotal: parseFloat(offer.price.total),
  pricePerNight: parseFloat(offer.price.total) / nights,
  currency: offer.price.currency,
  amenities: extractAmenities(offer.room),
  available: true,
  soldOut: false,
}));

return {
  hotel: { ... },
  roomOptions: roomOptions  // ← All room types!
};
```

---

## 🛠️ **Backend Fix Required**

### **File to Update:**

`src/services/hotelService.ts` (or similar)

### **Function to Fix:**

`searchHotels()` or `transformAmadeusResponse()`

### **Changes Needed:**

1. **Map ALL Amadeus offers** (not just the first one):

   ```javascript
   const roomOptions = hotel.offers.map(offer => ({
     id: offer.id,
     type: offer.room.type || 'Standard Room',
     bedType: getBedType(offer.room.typeEstimated),
     size: getSize(offer.room.description),
     maxOccupancy: offer.guests?.adults || 2,
     priceTotal: parseFloat(offer.price.total),
     pricePerNight: parseFloat(offer.price.total) / numberOfNights,
     currency: offer.price.currency,
     amenities: extractAmenities(offer),
     available: true,
   }));
   ```

2. **Extract bed configuration:**

   ```javascript
   function getBedType(typeEstimated) {
     if (!typeEstimated) return '1 King or 2 Queen Beds';

     const beds = typeEstimated.beds || 1;
     const bedType = typeEstimated.bedType || 'QUEEN';

     if (beds === 1) return `1 ${bedType.charAt(0) + bedType.slice(1).toLowerCase()} Bed`;
     return `${beds} ${bedType.charAt(0) + bedType.slice(1).toLowerCase()} Beds`;
   }
   ```

3. **Extract room size:**

   ```javascript
   function getSize(description) {
     // Try to extract sq ft from description
     const sizeMatch = description?.text?.match(/(\d+)\s*sq\s*ft/i);
     if (sizeMatch) return `${sizeMatch[1]} sq ft`;

     // Default sizes based on room type
     const type = description?.text?.toLowerCase() || '';
     if (type.includes('suite')) return '600 sq ft';
     if (type.includes('deluxe')) return '400 sq ft';
     return '300 sq ft';
   }
   ```

4. **Filter out duplicates** (same room type with same price):

   ```javascript
   const uniqueRooms = roomOptions.filter(
     (room, index, self) =>
       index === self.findIndex(r => r.type === room.type && r.priceTotal === room.priceTotal)
   );
   ```

5. **Limit to 2-5 room options** (if too many):
   ```javascript
   const finalRooms = uniqueRooms.slice(0, 5);
   ```

---

## 🧪 **How to Test**

### **Before Fix:**

```bash
curl -X POST https://api.voyance.com/api/v1/hotels/search \
  -H "Content-Type: application/json" \
  -d '{
    "tripId": "test-123",
    "cityCode": "PAR",
    "dates": { "in": "2025-10-21", "out": "2025-10-24" },
    "rooms": 1,
    "guests": 2
  }'
```

**Current Response:**

```json
{
  "results": [
    {
      "name": "Grand Hotel",
      "roomOptions": [{ "type": "Deluxe Room", "priceTotal": 4900 }] // ← Only 1 room
    }
  ]
}
```

### **After Fix:**

**Expected Response:**

```json
{
  "results": [
    {
      "name": "Grand Hotel",
      "roomOptions": [
        { "type": "Standard Room", "priceTotal": 3500 },
        { "type": "Deluxe Room", "priceTotal": 4900 },
        { "type": "Suite", "priceTotal": 7000 }
      ] // ← Multiple rooms!
    }
  ]
}
```

---

## 📝 **Acceptance Criteria**

- [ ] Each hotel returns **2-5 room options** (not just 1)
- [ ] Room options have different types (Standard, Deluxe, Suite, etc.)
- [ ] Room options have different prices
- [ ] Each room has `bedType` (e.g., "1 King Bed", "2 Queen Beds")
- [ ] Each room has `maxOccupancy` (e.g., 2, 3, 4)
- [ ] Each room has `size` (e.g., "300 sq ft")
- [ ] Duplicate rooms (same type + price) are filtered out
- [ ] Room options are sorted by price (low to high)

---

## 🎯 **User Impact**

**Without Fix:**

- ❌ Users see only 1 room type per hotel
- ❌ No ability to compare Standard vs Deluxe vs Suite
- ❌ Can't choose based on price/features
- ❌ Bad UX (defeats purpose of room selection)

**With Fix:**

- ✅ Users see 2-5 room options per hotel
- ✅ Can compare prices and features
- ✅ Can select room type that fits budget
- ✅ Matches flight cabin selection UX

---

## 📞 **Questions for Backend Team**

1. Is Amadeus returning multiple `offers[]` per hotel?
2. Are we currently only using `offers[0]`?
3. Can we map all offers to `roomOptions[]`?
4. Should we filter/dedupe similar room types?
5. What's the ETA for this fix?

---

## 🔗 **Related Documentation**

- `docs/source-of-truth/SOT_BACKEND_HOTEL_ROOM_DATA.md` - Full backend contract
- `src/components/planner/HotelCardWithRooms.tsx` - Frontend room selection UI
- `src/services/plannerHotelAPI.ts` - TypeScript interface

---

**Status:** Waiting for backend fix to return multiple room options per hotel.
