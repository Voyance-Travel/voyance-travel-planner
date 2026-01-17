# Hotel Room Options - Backend Data Gap

## 🚨 Current Issue

**User Feedback:** "We do not even see the option to select the room type. and what the price is per night or the details about the room are we getting what we need from the backend"

**Problem:** The backend currently returns **ONE room type** per hotel, but users need to **compare and select** between multiple room options (Standard, Deluxe, Suite, etc.)

---

## 📊 What We're Getting from Backend

### Current `PlannerHotelOption` Structure:

```typescript
{
  id: string;
  name: string;
  brand?: string;
  location: { address, city, country, lat, lng, distanceFromCenter };
  rating: { overall, count };
  stars: number;
  amenities: string[];  // Hotel-wide amenities
  images: string[];

  // ❌ PROBLEM: Only ONE room type
  roomType: string;  // e.g., "Standard Room"

  // ❌ PROBLEM: Only ONE price
  priceTotal: number;     // Total for stay
  pricePerNight: number;  // Per night
  currency: string;

  optionId: string;
  reasonCodes: string[];
  recommended: boolean;
}
```

**What's missing:**

- ❌ No `roomOptions` array
- ❌ No multiple room types to choose from
- ❌ No room-specific amenities (only hotel-wide)
- ❌ No bed configuration options
- ❌ No room size information
- ❌ No occupancy limits per room type

---

## ✅ What We Need from Backend

### Proposed `PlannerHotelOption` with Room Options:

```typescript
{
  id: string;
  name: string;
  brand?: string;
  location: { address, city, country, lat, lng, distanceFromCenter };
  rating: { overall, count };
  stars: number;
  amenities: string[];  // Hotel-wide amenities
  images: string[];

  // ✅ NEW: Multiple room options
  roomOptions: [
    {
      id: string;                    // Room option ID
      type: string;                  // "Standard Room", "Deluxe Room", "Suite"
      bedType: string;               // "1 King Bed", "2 Queen Beds", "1 King + Sofa Bed"
      size: string;                  // "300 sq ft" or "28 sqm"
      maxOccupancy: number;          // 2, 3, 4, etc.
      priceTotal: number;            // Total for entire stay
      pricePerNight: number;         // Per night
      currency: string;              // "USD", "EUR", etc.
      amenities: string[];           // Room-specific: ["WiFi", "Mini Bar", "City View", "Bathtub"]
      available: boolean;            // Is this room type available?
      images?: string[];             // Room-specific photos (optional)
    },
    // ... more room types
  ];

  optionId: string;
  reasonCodes: string[];
  recommended: boolean;
}
```

---

## 🎯 Example Backend Response Needed

```json
{
  "id": "hotel-123",
  "name": "The Ritz-Carlton",
  "stars": 5,
  "location": {
    "city": "Paris",
    "country": "France",
    "address": "15 Place Vendôme",
    "distanceFromCenter": 0.5
  },
  "rating": {
    "overall": 4.8,
    "count": 847
  },
  "amenities": ["Free WiFi", "Fitness Center", "Restaurant", "Spa", "Concierge", "Valet Parking"],
  "images": [
    "https://example.com/hotel/exterior.jpg",
    "https://example.com/hotel/lobby.jpg",
    "https://example.com/hotel/pool.jpg"
  ],

  "roomOptions": [
    {
      "id": "room-standard-123",
      "type": "Standard Room",
      "bedType": "1 King or 2 Queen Beds",
      "size": "300 sq ft",
      "maxOccupancy": 2,
      "priceTotal": 1200,
      "pricePerNight": 400,
      "currency": "USD",
      "amenities": ["WiFi", "Flat-screen TV", "Air Conditioning", "Mini Bar", "Coffee Maker"],
      "available": true
    },
    {
      "id": "room-deluxe-124",
      "type": "Deluxe Room",
      "bedType": "1 King Bed",
      "size": "400 sq ft",
      "maxOccupancy": 2,
      "priceTotal": 1560,
      "pricePerNight": 520,
      "currency": "USD",
      "amenities": [
        "WiFi",
        "Flat-screen TV",
        "Air Conditioning",
        "Mini Bar",
        "Coffee Maker",
        "City View",
        "Bathtub"
      ],
      "available": true
    },
    {
      "id": "room-suite-125",
      "type": "Executive Suite",
      "bedType": "1 King Bed + Sofa Bed",
      "size": "600 sq ft",
      "maxOccupancy": 4,
      "priceTotal": 2160,
      "pricePerNight": 720,
      "currency": "USD",
      "amenities": [
        "WiFi",
        "Flat-screen TV",
        "Air Conditioning",
        "Mini Bar",
        "Coffee Maker",
        "City View",
        "Bathtub",
        "Living Area",
        "Kitchenette"
      ],
      "available": true
    }
  ],

  "optionId": "hotel-option-abc123",
  "recommended": true
}
```

---

## 🔧 Frontend Workaround (Temporary)

Until the backend provides `roomOptions`, the frontend is **generating placeholder room types** based on the single hotel price:

```typescript
const getAvailableRooms = () => {
  return (
    hotel?.roomOptions || [
      {
        id: '1',
        type: 'Standard Room',
        bedType: '1 King or 2 Queen Beds',
        size: '300 sq ft',
        maxOccupancy: 2,
        price: hotel.priceTotal, // Base price
        amenities: ['WiFi', 'TV', 'Air Conditioning', 'Mini Bar'],
      },
      {
        id: '2',
        type: 'Deluxe Room',
        bedType: '1 King Bed',
        size: '400 sq ft',
        maxOccupancy: 2,
        price: hotel.priceTotal * 1.3, // +30% markup (placeholder)
        amenities: ['WiFi', 'TV', 'AC', 'Mini Bar', 'City View', 'Bathtub'],
      },
      {
        id: '3',
        type: 'Suite',
        bedType: '1 King Bed + Sofa Bed',
        size: '600 sq ft',
        maxOccupancy: 4,
        price: hotel.priceTotal * 1.8, // +80% markup (placeholder)
        amenities: [
          'WiFi',
          'TV',
          'AC',
          'Mini Bar',
          'City View',
          'Bathtub',
          'Living Area',
          'Kitchenette',
        ],
      },
    ]
  );
};
```

**⚠️ This is NOT real data** - just placeholder pricing based on percentage increases.

---

## 📋 Backend Action Items

### Priority 1: Return Multiple Room Options

- [ ] Update `PlannerHotelSearchResponse` to include `roomOptions` array
- [ ] Query hotel providers (Amadeus/etc.) for all available room types
- [ ] Include real pricing for each room type
- [ ] Include bed configuration for each room type

### Priority 2: Room-Specific Data

- [ ] Room sizes in sq ft or sqm
- [ ] Max occupancy per room type
- [ ] Room-specific amenities (not just hotel-wide)
- [ ] Room availability status

### Priority 3: Enhanced Details

- [ ] Room-specific images (optional)
- [ ] Bed type options (King, Queen, Twin, etc.)
- [ ] View type (City View, Ocean View, Garden View)
- [ ] Special features (Balcony, Bathtub, Kitchenette)

---

## 🎯 API Endpoint Update Needed

**Current:**

```
GET /api/v1/planner/hotels/search
```

**Returns:**

```json
{
  "results": [
    {
      "id": "hotel-123",
      "roomType": "Standard Room", // ❌ Only ONE room
      "priceTotal": 1200,
      "pricePerNight": 400
    }
  ]
}
```

**Needed:**

```
GET /api/v1/planner/hotels/search?includeRoomOptions=true
```

**Should Return:**

```json
{
  "results": [
    {
      "id": "hotel-123",
      "roomOptions": [
        // ✅ Multiple rooms
        {
          "type": "Standard Room",
          "priceTotal": 1200,
          "pricePerNight": 400,
          "bedType": "1 King or 2 Queen",
          "maxOccupancy": 2,
          "amenities": ["WiFi", "TV"]
        },
        {
          "type": "Deluxe Room",
          "priceTotal": 1560,
          "pricePerNight": 520,
          "bedType": "1 King",
          "maxOccupancy": 2,
          "amenities": ["WiFi", "TV", "City View"]
        }
      ]
    }
  ]
}
```

---

## 🔍 How to Test

### Backend:

1. Query Amadeus Hotel API for a specific hotel
2. Check if multiple room types are returned
3. Extract pricing, bed type, occupancy for each room
4. Return as `roomOptions` array

### Frontend:

1. If `hotel.roomOptions` exists → Use real data
2. If not → Show placeholder data with warning
3. User can select room type
4. Price updates automatically when room is selected

---

## 📊 Impact

**Without Multiple Room Options:**

- ❌ Users can't compare room types
- ❌ Pricing feels arbitrary
- ❌ Can't see bed configuration options
- ❌ Can't choose based on occupancy needs

**With Multiple Room Options:**

- ✅ Users compare Standard vs Deluxe vs Suite
- ✅ Real pricing from hotel providers
- ✅ Choose room based on travelers (2 vs 4 people)
- ✅ See exact bed types and sizes
- ✅ Professional booking experience

---

## 🏁 Current Status

**Frontend:** Ready to consume `roomOptions` array ✅
**Backend:** Not yet providing multiple room options ❌
**Workaround:** Placeholder data with price multipliers (temporary) ⚠️

**Next Step:** Backend team to update hotel search API to return `roomOptions` array with real data from hotel providers.
