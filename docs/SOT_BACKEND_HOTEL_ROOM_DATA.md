# Backend Hotel Room Data Requirements

## 🎯 What Frontend Needs from Backend

**Goal**: Backend must return **multiple room options per hotel** (like flight cabin tiers) so users can select a specific room type during hotel selection.

---

## 📊 Current vs Required Data Structure

### ❌ **What Backend Currently Sends** (ONE room only):

```json
{
  "success": true,
  "tripId": "abc123",
  "searchId": "search-xyz",
  "results": [
    {
      "id": "hotel-123",
      "name": "The Ritz-Carlton Paris",
      "brand": "Ritz-Carlton",
      "location": {
        "address": "15 Place Vendôme",
        "city": "Paris",
        "country": "France",
        "lat": 48.8682,
        "lng": 2.3292,
        "distanceFromCenter": 0.5
      },
      "rating": {
        "overall": 4.8,
        "count": 847
      },
      "stars": 5,
      "amenities": ["WiFi", "Spa", "Restaurant", "Gym", "Pool"],
      "images": ["https://example.com/hotel/exterior.jpg", "https://example.com/hotel/lobby.jpg"],

      // ❌ PROBLEM: Only ONE room type
      "roomType": "Standard Room",
      "priceTotal": 1200,
      "pricePerNight": 400,
      "currency": "USD",

      "cancellation": {
        "free": true,
        "until": "2025-10-18T00:00:00Z"
      },
      "optionId": "hotel-option-abc123",
      "reasonCodes": ["LUXURY", "CENTRAL_LOCATION"],
      "recommended": true
    }
  ]
}
```

---

### ✅ **What Backend MUST Send** (Multiple rooms):

```json
{
  "success": true,
  "tripId": "abc123",
  "searchId": "search-xyz",
  "results": [
    {
      "id": "hotel-123",
      "name": "The Ritz-Carlton Paris",
      "brand": "Ritz-Carlton",
      "location": {
        "address": "15 Place Vendôme",
        "city": "Paris",
        "country": "France",
        "lat": 48.8682,
        "lng": 2.3292,
        "distanceFromCenter": 0.5
      },
      "rating": {
        "overall": 4.8,
        "count": 847
      },
      "stars": 5,
      "amenities": ["WiFi", "Spa", "Restaurant", "Gym", "Pool"], // Hotel-wide amenities
      "images": ["https://example.com/hotel/exterior.jpg", "https://example.com/hotel/lobby.jpg"],

      // ✅ NEW: Array of room options (like flight cabin tiers)
      "roomOptions": [
        {
          "id": "room-std-1",
          "type": "Standard Room",
          "bedType": "1 King Bed or 2 Queen Beds",
          "size": "300 sq ft",
          "maxOccupancy": 2,
          "priceTotal": 1200,
          "pricePerNight": 400,
          "currency": "USD",
          "amenities": ["WiFi", "Flat-screen TV", "Air Conditioning", "Mini Bar", "Coffee Maker"],
          "available": true,
          "soldOut": false
        },
        {
          "id": "room-dlx-2",
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
          "available": true,
          "soldOut": false
        },
        {
          "id": "room-suite-3",
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
          "available": true,
          "soldOut": false
        }
      ],

      // Legacy fields (for backward compatibility - can keep)
      "roomType": "Standard Room", // Lowest tier for fallback
      "priceTotal": 1200, // Lowest price for fallback
      "pricePerNight": 400, // Lowest price for fallback
      "currency": "USD",

      "cancellation": {
        "free": true,
        "until": "2025-10-18T00:00:00Z"
      },
      "optionId": "hotel-option-abc123",
      "reasonCodes": ["LUXURY", "CENTRAL_LOCATION"],
      "recommended": true
    }
  ]
}
```

---

## 📋 **Field-by-Field Requirements**

### **Hotel-Level Fields** (Existing - Keep These):

| Field          | Type     | Required    | Description                          |
| -------------- | -------- | ----------- | ------------------------------------ |
| `id`           | string   | ✅ Yes      | Unique hotel identifier              |
| `name`         | string   | ✅ Yes      | Hotel name                           |
| `brand`        | string   | ⚪ Optional | Hotel brand/chain                    |
| `location`     | object   | ✅ Yes      | See Location Object below            |
| `rating`       | object   | ✅ Yes      | Guest ratings (overall, count)       |
| `stars`        | number   | ✅ Yes      | Hotel star rating (1-5)              |
| `amenities`    | string[] | ✅ Yes      | Hotel-wide amenities                 |
| `images`       | string[] | ✅ Yes      | Hotel photos (exterior, lobby, etc.) |
| `cancellation` | object   | ✅ Yes      | Cancellation policy                  |
| `optionId`     | string   | ✅ Yes      | For price lock API                   |
| `reasonCodes`  | string[] | ⚪ Optional | Why recommended                      |
| `recommended`  | boolean  | ⚪ Optional | AI recommendation flag               |

### **NEW: `roomOptions[]` Array** (Priority 1 - MUST HAVE):

Each hotel must return **2-5 room options**. Each room object:

| Field           | Type     | Required    | Description             | Example                                                 |
| --------------- | -------- | ----------- | ----------------------- | ------------------------------------------------------- |
| `id`            | string   | ✅ Yes      | Unique room option ID   | `"room-std-1"`                                          |
| `type`          | string   | ✅ Yes      | Room category           | `"Standard Room"`, `"Deluxe Room"`, `"Suite"`           |
| `bedType`       | string   | ✅ Yes      | Bed configuration       | `"1 King Bed"`, `"2 Queen Beds"`, `"1 King + Sofa Bed"` |
| `size`          | string   | ✅ Yes      | Room size               | `"300 sq ft"`, `"28 sqm"`                               |
| `maxOccupancy`  | number   | ✅ Yes      | Maximum guests          | `2`, `3`, `4`                                           |
| `priceTotal`    | number   | ✅ Yes      | Total price for stay    | `1200`                                                  |
| `pricePerNight` | number   | ✅ Yes      | Price per night         | `400`                                                   |
| `currency`      | string   | ✅ Yes      | Currency code           | `"USD"`, `"EUR"`                                        |
| `amenities`     | string[] | ✅ Yes      | Room-specific amenities | `["WiFi", "TV", "Mini Bar", "City View"]`               |
| `available`     | boolean  | ✅ Yes      | Is room available?      | `true` / `false`                                        |
| `soldOut`       | boolean  | ⚪ Optional | Is room sold out?       | `true` / `false`                                        |
| `images`        | string[] | ⚪ Optional | Room-specific photos    | Array of image URLs                                     |

---

## 🔄 **How Frontend Uses This Data**

### **Hotel Selection Step:**

1. **Display Hotel Card**:

   - Show hotel name, stars, location, images (hotel-level data)

2. **Show Room Options** (NEW):

   ```
   ┌─────────────────────────────────────────┐
   │ The Ritz-Carlton Paris ★★★★★           │
   │ 15 Place Vendôme, Paris                 │
   │                                         │
   │ SELECT ROOM TYPE:                       │
   │                                         │
   │ [Standard Room]         $1,200          │
   │  1 King/2 Queen • 2 guests • 300 ft    │
   │                          $400/night     │
   │                                         │
   │ [Deluxe Room] ✓        $1,560          │
   │  1 King Bed • 2 guests • 400 ft        │
   │                          $520/night     │
   │                                         │
   │ [Suite]                 $2,160          │
   │  1 King+Sofa • 4 guests • 600 ft       │
   │                          $720/night     │
   └─────────────────────────────────────────┘
   ```

3. **User Clicks Room**:

   - Frontend sends to price lock: `hotel.optionId` + `roomOption.id` (if needed)
   - Stores `hotel.selectedRoom` = clicked room object

4. **Review Page**:
   - Displays: "Selected Room: Deluxe Room • 1 King Bed • Sleeps 2 • $520/night"

---

## 🏗️ **Backend Implementation Guide**

### **Where to Get Room Data:**

#### **From Amadeus Hotel API:**

When calling `POST /v3/shopping/hotel-offers`, you receive:

```json
{
  "data": [
    {
      "id": "hotel-123",
      "hotel": { ... },
      "offers": [  // ← Multiple room offers!
        {
          "id": "offer-1",
          "room": {
            "type": "Standard Room",
            "typeEstimated": {
              "category": "STANDARD_ROOM",
              "beds": 2,
              "bedType": "QUEEN"
            },
            "description": {
              "text": "Standard room with queen beds"
            }
          },
          "price": {
            "total": "1200.00",
            "currency": "USD"
          }
        },
        {
          "id": "offer-2",
          "room": {
            "type": "Deluxe Room",
            // ... different room type
          },
          "price": {
            "total": "1560.00",
            "currency": "USD"
          }
        }
      ]
    }
  ]
}
```

**Map `offers[]` to `roomOptions[]`:**

- Each Amadeus `offer` = one `roomOption`
- Extract bed type from `room.typeEstimated.beds` + `room.typeEstimated.bedType`
- Calculate room size (if available in description)
- Set `maxOccupancy` from `guests.adults`

### **Endpoint to Update:**

**`POST /api/v1/planner/hotels/search`**

Response should include `roomOptions[]` array for each hotel.

---

## 🚨 **What Happens If Backend Doesn't Send `roomOptions`?**

**Frontend Fallback** (Temporary):

- Frontend generates 3 placeholder room tiers:
  - **Standard**: base price × 1.0
  - **Deluxe**: base price × 1.3
  - **Suite**: base price × 1.8

**Problems with Fallback**:

- ❌ Fake pricing (not from hotel provider)
- ❌ Fake room types (may not exist)
- ❌ Can't select actual room user wants
- ❌ Price lock might fail if backend doesn't recognize room

**Solution**: Backend MUST provide real `roomOptions` from Amadeus/hotel provider.

---

## 📝 **Backend Checklist**

### **Priority 1: MUST DO NOW**

- [ ] Update hotel search to return `roomOptions[]` array
- [ ] Each hotel returns 2-5 actual room types from Amadeus
- [ ] Include `bedType`, `maxOccupancy`, `size` for each room
- [ ] Include `priceTotal` and `pricePerNight` per room
- [ ] Include room-specific amenities
- [ ] Set `available: true/false` based on Amadeus availability

### **Priority 2: NICE TO HAVE**

- [ ] Room-specific images (if Amadeus provides)
- [ ] More detailed room descriptions
- [ ] View type (City View, Ocean View, etc.)
- [ ] Floor level preference

### **Priority 3: FUTURE ENHANCEMENTS**

- [ ] Bed type selection within room (King vs 2 Queens)
- [ ] Accessible room options
- [ ] Connecting rooms flag
- [ ] Pet-friendly room flag

---

## 🧪 **Test Scenario**

**Request:**

```
POST /api/v1/planner/hotels/search
{
  "tripId": "abc123",
  "cityCode": "PAR",
  "dates": {
    "in": "2025-10-21",
    "out": "2025-10-24"
  },
  "rooms": 1,
  "guests": 2,
  "budgetTier": "splurge"
}
```

**Expected Response:**

```json
{
  "success": true,
  "results": [
    {
      "id": "hotel-1",
      "name": "The Ritz-Carlton Paris",
      "roomOptions": [
        {
          "id": "room-std",
          "type": "Standard Room",
          "bedType": "1 King or 2 Queen Beds",
          "size": "300 sq ft",
          "maxOccupancy": 2,
          "priceTotal": 1200,
          "pricePerNight": 400,
          "currency": "USD",
          "amenities": ["WiFi", "TV", "Mini Bar"],
          "available": true
        },
        {
          "id": "room-dlx",
          "type": "Deluxe Room",
          "bedType": "1 King Bed",
          "size": "400 sq ft",
          "maxOccupancy": 2,
          "priceTotal": 1560,
          "pricePerNight": 520,
          "currency": "USD",
          "amenities": ["WiFi", "TV", "Mini Bar", "City View"],
          "available": true
        }
      ]
    }
  ]
}
```

---

## 🎯 **Summary**

**What Backend MUST Send:**

1. ✅ `roomOptions[]` array with 2-5 room types per hotel
2. ✅ Each room has: `type`, `bedType`, `size`, `maxOccupancy`, `priceTotal`, `pricePerNight`, `amenities`, `available`
3. ✅ Real data from Amadeus Hotel API `offers[]`

**Why It Matters:**

- Users can select **specific room type** (like selecting flight cabin)
- Price lock uses **correct room price**
- No fake/placeholder data
- Matches flight selection UX

**Frontend Will:**

- Display all room options in hotel card
- Let user select room type
- Pass selected room to price lock
- Show selection on review page

---

## 📞 **Questions for Backend Team?**

1. Can Amadeus Hotel API provide multiple room types per hotel?
2. Do we have access to bed configuration data?
3. Can we get room size information?
4. Are room-specific amenities available?
5. What's the timeline to implement `roomOptions[]`?
