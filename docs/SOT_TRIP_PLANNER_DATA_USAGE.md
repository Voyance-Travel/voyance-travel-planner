# Trip Planner Data Usage - Source of Truth

**Last Updated**: October 21, 2025
**Components**: Flight Selection + Hotel Selection
**Status**: ✅ ACTIVE - PRODUCTION

> **Purpose**: Complete mapping of all data fields used in trip planner UI, what they display, where they're shown, and what the backend must provide.

---

## 📋 Table of Contents

- [Hotel Data Usage](#-hotel-data-usage)
- [Flight Data Usage](#-flight-data-usage)
- [Backend Requirements](#-backend-requirements)
- [Data Flow Architecture](#-data-flow-architecture)
- [Missing/Future Data Fields](#-missingfuture-data-fields)

---

## 🏨 Hotel Data Usage

### Data Structure

**Type**: `PlannerHotelOption`
**Location**: `src/services/plannerHotelAPI.ts:27-60`
**Backend Endpoint**: `POST /api/v1/hotels/search`

### Complete Field Mapping

| Field                         | Type    | Required    | Used In UI         | Display Location               | Purpose                           | Priority |
| ----------------------------- | ------- | ----------- | ------------------ | ------------------------------ | --------------------------------- | -------- |
| `id`                          | string  | ✅ Yes      | Internal           | Key prop                       | Unique identifier                 | Critical |
| `name`                        | string  | ✅ Yes      | ✅ **YES**         | Hero image overlay, h3 heading | Hotel name display                | Critical |
| `brand`                       | string  | ⚠️ Optional | ✅ **YES**         | Above hotel name               | Brand prestige (Marriott, Hilton) | High     |
| `location.address`            | string  | ✅ Yes      | ❌ No              | -                              | Too verbose, using city instead   | Low      |
| `location.city`               | string  | ✅ Yes      | ✅ **YES**         | Hero image overlay             | "Paris, France" format            | Critical |
| `location.country`            | string  | ✅ Yes      | ✅ **YES**         | Hero image overlay             | "Paris, France" format            | Critical |
| `location.lat`                | number  | ✅ Yes      | ❌ No              | -                              | Future: Map integration           | Future   |
| `location.lng`                | number  | ✅ Yes      | ❌ No              | -                              | Future: Map integration           | Future   |
| `location.distanceFromCenter` | number  | ✅ Yes      | ✅ **YES**         | Hero image badge               | "1.2km to center"                 | Medium   |
| `rating.overall`              | number  | ✅ Yes      | ✅ **YES**         | Hero image badge               | Guest rating (4.5/5.0)            | Critical |
| `rating.count`                | number  | ✅ Yes      | ✅ **YES**         | Hero image                     | "(1,243 reviews)"                 | High     |
| `stars`                       | number  | ✅ Yes      | ✅ **YES**         | Hero image                     | Star rating (1-5 gold stars)      | Critical |
| `amenities[]`                 | array   | ✅ Yes      | ✅ **YES**         | Details section grid           | WiFi, Pool, Gym icons + text      | Critical |
| `images[]`                    | array   | ✅ Yes      | ✅ **YES**         | Hero image carousel            | 5 photos, navigation arrows       | Critical |
| `price.perNight`              | number  | ✅ Yes      | ✅ **YES**         | Price badge                    | "$185/night"                      | Critical |
| `price.total`                 | number  | ✅ Yes      | ✅ **YES**         | Price badge                    | "$1,295" total price              | Critical |
| `price.currency`              | string  | ✅ Yes      | ❌ No              | -                              | Assumed USD, could display        | Low      |
| `price.includes[]`            | array   | ⚠️ Optional | ✅ **YES** ⭐ NEW! | Hero image pills               | "Breakfast", "WiFi", "Parking"    | High     |
| `roomType`                    | string  | ✅ Yes      | ✅ **YES**         | Details section                | "Deluxe King Room"                | High     |
| `cancellation.free`           | boolean | ✅ Yes      | ✅ **YES**         | Details section badge          | Green checkmark badge             | High     |
| `cancellation.until`          | string  | ⚠️ Optional | ✅ **YES** ⭐ NEW! | Below cancellation badge       | "Until Nov 15"                    | Medium   |
| `optionId`                    | string  | ✅ Yes      | ✅ **YES**         | Internal                       | For price lock API call           | Critical |
| `reasonCodes[]`               | array   | ⚠️ Optional | ✅ **YES**         | Top badges + bottom section    | "Great Location", "Best Value"    | High     |
| `recommended`                 | boolean | ⚠️ Optional | ✅ **YES**         | Top badge                      | "Recommended" teal badge          | Medium   |

**Utilization Rate**: **21/24 fields = 87.5%** ✅

---

### UI Component Breakdown

#### 1. Hero Image Section (h-80, overlay)

**What's Displayed**:

```typescript
// TOP BADGES (absolute top-4 left-4)
- [Recommended] badge (if recommended === true)
- [Price Lock Timer] badge (if priceLock exists)
- [Reason Code 1] badge (reasonCodes[0])
- [Reason Code 2] badge (reasonCodes[1])

// IMAGE CAROUSEL
- images[currentIndex] (up to 5 photos)
- Navigation arrows (left/right)
- Counter: "1/5" (absolute top-4 right-4)

// BOTTOM OVERLAY (absolute bottom-0)
- brand (teal, uppercase) - "MARRIOTT"
- name (text-2xl, bold, white) - "Hotel des Champs-Élysées"
- stars (5 Star icons, amber-400)
- rating.overall (white badge) - "4.5"
- rating.count (white/90) - "(1,243 reviews)"
- location.city, location.country - "Paris, France"
- location.distanceFromCenter - "1.2km to center"
- price.includes[] pills (emerald badges) - "✓ Breakfast", "✓ WiFi"

// PRICE BADGE (absolute bottom-6 right-6)
- price.total - "$1,295"
- price.perNight - "$185/night"
- nights - "7 nights"
- [Price Confidence] - "Great Deal" or "Premium" (if applicable)
```

**Backend Requirements**:

- `images[]` must have at least 1 URL (fallback to default)
- `price.total` must be calculated: `perNight * nights`
- `rating.overall` should be 0-5 scale
- `reasonCodes[]` should contain valid codes (see mapping)

---

#### 2. Details Section (p-6, white background)

**What's Displayed**:

```typescript
// ROOM TYPE & CANCELLATION (flex justify-between)
- roomType (with Building icon) - "Deluxe King Room"
- cancellation.free (green badge) - "Free Cancellation"
- cancellation.until (green text) - "Until Nov 15"

// AMENITIES GRID (grid-cols-3)
- amenities[0-5] (icon + text) - WiFi, Pool, Gym, etc.
- "+N more amenities" button (if > 6)

// BEST FOR TRAVELERS ⭐ NEW!
- Auto-generated tags based on amenities:
  - Families (purple) - if pool/kids amenities
  - Couples (pink) - if 4+ stars or spa
  - Business (blue) - if gym/business center
- Shows as: "👨‍👩‍👧‍👦 Families 9.2"

// RECOMMENDATION REASONS
- reasonCodes[0-2] displayed as bullets
- "Great Location • High Rating • Best Value"

// SELECTION INDICATOR (if selected)
- Teal gradient banner with checkmark
```

**Backend Requirements**:

- `amenities[]` should use standard names (WiFi, Pool, Gym, Spa, Restaurant, Parking, Business Center)
- `roomType` should be descriptive (not just "standard")
- `cancellation.until` should be ISO date string
- `reasonCodes[]` should map to these values:
  - `BEST_PRICE` → "Best Value"
  - `HIGH_RATING` → "High Rating"
  - `GREAT_LOCATION` → "Great Location"
  - `TOP_AMENITIES` → "Top Amenities"
  - `POPULAR_CHOICE` → "Popular Choice"

---

#### 3. Expandable Details Section (showDetails === true)

**What's Displayed**:

```typescript
// 3-COLUMN GRID
// Column 1: All Amenities
- amenities[] (all, with icons)

// Column 2: Policies
- roomType
- cancellation details
- price.includes[] (all items)

// Column 3: Location
- location.address
- location.city, location.country
- location.distanceFromCenter
```

**Backend Requirements**:

- Complete amenities list
- All price.includes items
- Full address details

---

### Smart Features (Calculated Client-Side)

#### Price Confidence Indicator

```typescript
// Calculate average from all results
const avgPricePerNight = calculateAverageFromResults();
const priceVsAverage = ((perNightPrice - avgPricePerNight) / avgPricePerNight) * 100;

// Display logic
if (priceVsAverage < -10) {
  // Show "Great Deal" with TrendingDown icon (emerald)
} else if (priceVsAverage > 10) {
  // Show "Premium" with TrendingUp icon (orange)
}
```

**Backend Could Enhance**: Send `priceVsMarket` field to avoid client calculation

#### "Best For" Traveler Types

```typescript
// Client-side logic based on amenities + stars
if (amenities.includes('pool') || amenities.includes('kids')) {
  tags.push({ icon: Users, label: 'Families', score: 9.2, color: 'purple' });
}
if (stars >= 4 || amenities.includes('spa')) {
  tags.push({ icon: Sparkles, label: 'Couples', score: 9.0, color: 'pink' });
}
if (amenities.includes('gym') || amenities.includes('business')) {
  tags.push({ icon: Briefcase, label: 'Business', score: 8.8, color: 'blue' });
}
```

**Backend Could Enhance**: Send `bestFor[]` array with actual scores from review sentiment

---

## ✈️ Flight Data Usage

### Data Structure

**Type**: `PlannerFlightOption`
**Location**: `src/services/plannerFlightAPI.ts:28-60`
**Backend Endpoint**: `POST /api/v1/flights/search`

### Complete Field Mapping

| Field                      | Type    | Required    | Used In UI | Display Location        | Purpose                       | Priority |
| -------------------------- | ------- | ----------- | ---------- | ----------------------- | ----------------------------- | -------- |
| `id`                       | string  | ✅ Yes      | Internal   | Key prop                | Unique identifier             | Critical |
| `airline`                  | string  | ✅ Yes      | ✅ **YES** | Card header + recap bar | Airline name                  | Critical |
| `flightNumber`             | string  | ✅ Yes      | ✅ **YES** | Card header             | "DL123"                       | High     |
| `origin.airport`           | string  | ✅ Yes      | ✅ **YES** | Route timeline          | "JFK" IATA code               | Critical |
| `origin.city`              | string  | ✅ Yes      | ✅ **YES** | Route timeline          | "New York" below code         | High     |
| `origin.terminal`          | string  | ⚠️ Optional | ❌ No      | -                       | Future: departure details     | Future   |
| `destination.airport`      | string  | ✅ Yes      | ✅ **YES** | Route timeline          | "LHR" IATA code               | Critical |
| `destination.city`         | string  | ✅ Yes      | ✅ **YES** | Route timeline          | "London" below code           | High     |
| `destination.terminal`     | string  | ⚠️ Optional | ❌ No      | -                       | Future: arrival details       | Future   |
| `departure`                | string  | ✅ Yes      | ✅ **YES** | Route timeline          | ISO datetime → "10:30 AM"     | Critical |
| `arrival`                  | string  | ✅ Yes      | ✅ **YES** | Route timeline          | ISO datetime → "11:45 PM"     | Critical |
| `duration`                 | number  | ✅ Yes      | ✅ **YES** | Route summary           | Minutes → "8h 15m"            | Critical |
| `stops`                    | number  | ✅ Yes      | ✅ **YES** | Route badge + timeline  | "Nonstop" or "1 stop"         | Critical |
| `stopCities[]`             | array   | ⚠️ Optional | ✅ **YES** | Layover section         | "via Boston" badges           | High     |
| `price.amount`             | number  | ✅ Yes      | ✅ **YES** | Price badge + recap     | "$875"                        | Critical |
| `price.currency`           | string  | ✅ Yes      | ❌ No      | -                       | Assumed USD                   | Low      |
| `class`                    | string  | ✅ Yes      | ✅ **YES** | Cabin selector          | Booking class code            | High     |
| `cabin`                    | string  | ✅ Yes      | ✅ **YES** | Card header + selector  | "Economy", "Business"         | Critical |
| `baggageIncluded.carry_on` | boolean | ✅ Yes      | ✅ **YES** | Fare details            | "Carry-on included"           | High     |
| `baggageIncluded.pieces`   | number  | ✅ Yes      | ✅ **YES** | Fare details            | "2 checked bags"              | High     |
| `optionId`                 | string  | ✅ Yes      | ✅ **YES** | Internal                | For price lock API call       | Critical |
| `reasonCodes[]`            | array   | ⚠️ Optional | ✅ **YES** | Top badges              | "Best Price", "Direct Flight" | High     |
| `recommended`              | boolean | ⚠️ Optional | ✅ **YES** | Top badge               | "Recommended" badge           | Medium   |

**Utilization Rate**: **20/23 fields = 87%** ✅

---

### UI Component Breakdown

#### 1. Flight Card Header

**What's Displayed**:

```typescript
// AIRLINE INFO (left side)
- <AirlineMark code={airline} /> (logo or badge)
- airline name (text-lg, font-semibold)
- flightNumber (text-sm, text-slate-600)

// BADGES (top-right)
- [Recommended] (if recommended === true)
- [Reason Code 1] (reasonCodes[0])
- [Reason Code 2] (reasonCodes[1])

// PRICE (right side)
- price.amount (text-2xl, font-bold)
- cabin (text-sm)
```

**Backend Requirements**:

- `airline` should be 2-letter IATA code (for logo lookup)
- `flightNumber` should include airline prefix (e.g., "DL123")
- `price.amount` must be per-person, not total

---

#### 2. Route Timeline (Visual Journey)

**What's Displayed**:

```typescript
// DEPARTURE (left)
- departure time (e.g., "10:30 AM")
- origin.airport (IATA code, large)
- origin.city (below code, smaller)

// TIMELINE (center)
- Plane icon
- duration ("8h 15m")
- stops badge ("Nonstop" or "1 stop")
- Horizontal line with progress bar

// LAYOVERS (if stops > 0)
- stopCities[] as badges
- "via Boston — 1h 45m layover"

// ARRIVAL (right)
- arrival time (e.g., "11:45 PM")
- destination.airport (IATA code)
- destination.city (below code)
```

**Backend Requirements**:

- `departure` and `arrival` must be ISO 8601 datetime strings
- `duration` in minutes (frontend converts to hours/minutes)
- `stopCities[]` should contain city names (not airport codes)
- **Future Enhancement**: Send layover durations per stop

---

#### 3. Cabin Class Selector

**What's Displayed**:

```typescript
// TABS (Economy, Premium Economy, Business, First)
- Active tab from `cabin` field
- Pricing for each tier (from cabinTiers array)

// DYNAMIC CONTENT (changes on tab select)
- Fare details (baggage, changes, cancellation)
- Amenities list (WiFi, meals, seat type)
- Price difference
```

**Backend Requirements**:

- Send all available cabin classes for the flight
- Each cabin should include:
  - `cabin`: "ECONOMY" | "PREMIUM_ECONOMY" | "BUSINESS" | "FIRST"
  - `price`: amount
  - `baggage`: { carryOn: boolean, checked: number }
  - `amenities`: string[]
  - `changes`: { allowed: boolean, fee?: number }
  - `cancellation`: { allowed: boolean, fee?: number }

**Current Issue**: Frontend hardcodes cabin details, should come from backend

---

#### 4. Fare Details Section

**What's Displayed**:

```typescript
// BAGGAGE
- baggageIncluded.carry_on → "Personal item" or "No carry-on"
- baggageIncluded.pieces → "2 checked bags included"

// CHANGES & CANCELLATION (hardcoded, should be dynamic)
- "Changes allowed for $150"
- "Non-refundable"
```

**Backend Should Send**:

```typescript
fareRules: {
  baggage: {
    carryOn: boolean;
    carryOnWeight: string; // "7 kg"
    checked: number;
    checkedWeight: string; // "23 kg per bag"
  };
  changes: {
    allowed: boolean;
    fee?: number; // null if free
    beforeDeparture: boolean;
  };
  cancellation: {
    allowed: boolean;
    refundPercentage: number; // 0-100
    fee?: number;
  };
  seatSelection: {
    included: boolean;
    fee?: number;
  };
}
```

---

#### 5. Sticky Recap Bar (Bottom of Screen)

**What's Displayed**:

```typescript
// OUTBOUND FLIGHT
- <AirlineMark code={airline} />
- origin.airport → destination.airport
- departure date (from tripDetails)
- cabin
- price.amount

// RETURN FLIGHT (if selected)
- Same format as outbound

// TOTAL PRICE
- Sum of both flights
- "Continue to Hotels" button
```

**Backend Requirements**:

- Keep flight data structure consistent
- Price must be per-person (frontend multiplies by passengers)

---

### Flight Amenities Mapping

**Current**: Hardcoded based on cabin class
**Should Be**: Backend provides per-flight amenities

```typescript
// Current hardcoded logic in FlightSelectionUpdated.tsx
const economyAmenities = [
  'Standard seat (30-32" pitch)',
  'Personal item',
  'Buy food & drinks onboard',
  'Streaming entertainment on your device',
];

// Backend should send
amenities: {
  cabin: string; // "ECONOMY"
  items: [
    { icon: 'seat', label: 'Standard seat', detail: '30-32" pitch' },
    { icon: 'bag', label: 'Personal item', detail: 'Fits under seat' },
    { icon: 'meal', label: 'Purchase onboard', detail: 'Snacks & drinks' },
    { icon: 'wifi', label: 'Streaming', detail: 'On your device' },
  ];
}
```

---

## 🔧 Backend Requirements

### Hotel Search Response (`POST /api/v1/hotels/search`)

#### Must Include (Critical):

```json
{
  "success": true,
  "tripId": "trip_abc123",
  "searchId": "search_xyz789",
  "results": [
    {
      "id": "hotel_001",
      "name": "Hotel des Champs-Élysées",
      "brand": "Marriott", // ⚠️ IMPORTANT FOR PRESTIGE
      "location": {
        "address": "123 Rue de Rivoli",
        "city": "Paris", // ✅ NOW USED
        "country": "France", // ✅ NOW USED
        "lat": 48.8566,
        "lng": 2.3522,
        "distanceFromCenter": 1.2
      },
      "rating": {
        "overall": 4.5, // ✅ MUST BE 0-5 SCALE
        "count": 1243
      },
      "stars": 4,
      "amenities": [
        // ✅ USE STANDARD NAMES
        "WiFi",
        "Pool",
        "Gym",
        "Spa",
        "Restaurant",
        "Parking",
        "Business Center",
        "Room Service"
      ],
      "images": [
        // ✅ PROVIDE 3-5 URLs
        "https://...",
        "https://..."
      ],
      "price": {
        "perNight": 185,
        "total": 1295, // ✅ MUST BE CALCULATED
        "currency": "USD",
        "includes": ["Breakfast", "WiFi", "Parking"] // ⭐ NEW FIELD!
      },
      "roomType": "Deluxe King Room", // ✅ BE DESCRIPTIVE
      "cancellation": {
        "free": true,
        "until": "2025-11-15T23:59:59Z" // ⭐ ISO DATETIME
      },
      "optionId": "opt_abc123", // ✅ REQUIRED FOR HOLD
      "reasonCodes": ["BEST_PRICE", "HIGH_RATING", "GREAT_LOCATION"], // ⚠️ USE VALID CODES
      "recommended": true
    }
  ],
  "meta": {
    "cityCode": "PAR",
    "dates": { "in": "2025-11-15", "out": "2025-11-22" },
    "rooms": 1,
    "guests": 2,
    "resultCount": 25
  }
}
```

#### Validation Rules:

- ✅ `price.total` must equal `price.perNight * nights`
- ✅ `images[]` must have at least 1 valid URL
- ✅ `rating.overall` must be 0-5 scale (not 0-10)
- ✅ `amenities[]` should use standard names for icon mapping
- ✅ `reasonCodes[]` must be valid (see mapping below)
- ✅ `cancellation.until` must be ISO datetime if `free: true`

---

### Flight Search Response (`POST /api/v1/flights/search`)

#### Must Include (Critical):

```json
{
  "success": true,
  "tripId": "trip_abc123",
  "searchId": "search_xyz789",
  "results": [
    // OUTBOUND FLIGHTS
    {
      "id": "flight_001",
      "airline": "DL", // ✅ 2-LETTER IATA CODE FOR LOGO
      "flightNumber": "DL123",
      "origin": {
        "airport": "JFK",
        "city": "New York", // ✅ REQUIRED FOR DISPLAY
        "terminal": "4" // ⚠️ OPTIONAL
      },
      "destination": {
        "airport": "LHR",
        "city": "London", // ✅ REQUIRED FOR DISPLAY
        "terminal": "5" // ⚠️ OPTIONAL
      },
      "departure": "2025-11-15T10:30:00Z", // ✅ ISO DATETIME
      "arrival": "2025-11-15T23:45:00Z", // ✅ ISO DATETIME
      "duration": 495, // ✅ MINUTES (8h 15m)
      "stops": 0,
      "stopCities": [], // ⚠️ REQUIRED IF stops > 0
      "price": {
        "amount": 875, // ✅ PER PERSON
        "currency": "USD"
      },
      "class": "Y", // Booking class
      "cabin": "ECONOMY",
      "baggageIncluded": {
        "carry_on": true,
        "pieces": 2 // Checked bags
      },
      "optionId": "opt_flight_xyz", // ✅ REQUIRED FOR HOLD
      "reasonCodes": ["BEST_PRICE", "DIRECT_FLIGHT"], // ⚠️ USE VALID CODES
      "recommended": true,

      // ⭐ MISSING: Should include fare rules
      "fareRules": {
        // 🚨 NOT CURRENTLY SENT
        "baggage": {
          "carryOnWeight": "7 kg",
          "checkedWeight": "23 kg per bag"
        },
        "changes": {
          "allowed": true,
          "fee": 150
        },
        "cancellation": {
          "allowed": false,
          "refundPercentage": 0
        }
      },

      // ⭐ MISSING: Should include cabin-specific amenities
      "amenities": {
        // 🚨 NOT CURRENTLY SENT
        "items": [
          "Standard seat (30-32\" pitch)",
          "Personal item included",
          "Buy food & drinks onboard"
        ]
      }
    }
  ],
  "returnResults": [
    // RETURN FLIGHTS (if roundtrip)
    // Same structure as outbound
  ],
  "meta": {
    "origin": "JFK",
    "destination": "LHR",
    "dates": { "out": "2025-11-15", "back": "2025-11-22" },
    "passengers": 2,
    "resultCount": 50
  }
}
```

#### Validation Rules:

- ✅ `departure` and `arrival` must be ISO 8601 datetime strings
- ✅ `duration` in minutes (not hours)
- ✅ `stopCities[]` required if `stops > 0` (city names, not codes)
- ✅ `origin.city` and `destination.city` must be provided
- ✅ `airline` should be 2-letter IATA code (for logo lookup)
- ✅ `price.amount` is per-person (frontend multiplies by passengers)
- 🚨 **MISSING**: `fareRules` object (changes, cancellation, baggage weights)
- 🚨 **MISSING**: `amenities` array (currently hardcoded per cabin)

---

## 📊 Reason Code Mappings

**Location**: `src/services/plannerHotelAPI.ts` (getReasonCodeLabel)

### Hotels

| Backend Code     | Frontend Label   | Badge Color |
| ---------------- | ---------------- | ----------- |
| `BEST_PRICE`     | "Best Value"     | Teal/White  |
| `HIGH_RATING`    | "High Rating"    | Teal/White  |
| `GREAT_LOCATION` | "Great Location" | Teal/White  |
| `TOP_AMENITIES`  | "Top Amenities"  | Teal/White  |
| `POPULAR_CHOICE` | "Popular Choice" | Teal/White  |

### Flights

| Backend Code      | Frontend Label      | Badge Color |
| ----------------- | ------------------- | ----------- |
| `BEST_PRICE`      | "Best Price"        | Teal/White  |
| `DIRECT_FLIGHT`   | "Direct Flight"     | Teal/White  |
| `SHORT_DURATION`  | "Shortest Duration" | Teal/White  |
| `BEST_SCHEDULE`   | "Best Schedule"     | Teal/White  |
| `POPULAR_AIRLINE` | "Popular Airline"   | Teal/White  |

**Backend Requirement**: Only send codes from these lists, otherwise labels won't display.

---

## 🔄 Data Flow Architecture

### Search Flow

```
User Input (Dates, Destination, Travelers)
    ↓
Frontend: /src/components/planner/steps/HotelSelectionUpdated.tsx
    ↓
API Call: plannerHotelAPI.search(params)
    ↓
Backend: POST /api/v1/hotels/search
    ↓
Amadeus Hotel Search API v3
    ↓
Backend Transform: Amadeus → PlannerHotelOption
    ↓
Backend Response: { success, results[], meta }
    ↓
Frontend Cache: requestCache (15 min TTL)
    ↓
Frontend Display: Premium hotel cards
    ↓
User Selects Hotel
    ↓
API Call: plannerHotelAPI.hold({ tripId, optionId })
    ↓
Backend: POST /api/v1/hotels/hold
    ↓
Create Price Lock (15 min expiry)
    ↓
Return: { priceLock: { id, expiresAt, amount } }
    ↓
Frontend: Display countdown timer
```

### Price Lock Flow

```
User Selects Hotel/Flight
    ↓
Frontend: handleHotelSelect(hotel)
    ↓
API Call: POST /api/v1/hotels/hold
    Body: { tripId, optionId, total, currency }
    ↓
Backend:
  1. Verify tripId exists
  2. Verify optionId valid
  3. Check if existing lock → release old lock
  4. Create new lock in Redis
  5. Set 15-minute TTL
    ↓
Response: {
  priceLock: {
    id: "lock_abc123",
    expiresAt: "2025-10-21T14:45:00Z",
    amount: 1295,
    status: "LOCKED"
  }
}
    ↓
Frontend:
  1. Display countdown timer (PriceLockTimer component)
  2. Store in state: setPriceLock(response.priceLock)
  3. Show green "Price Protected" badge
  4. Check status every 30 seconds
    ↓
After 15 Minutes:
  - Lock expires automatically
  - Frontend detects expired status
  - Show warning: "Price lock expired"
  - User must reselect
```

---

## 🚨 Missing / Future Data Fields

### Hotels

#### High Priority Missing:

```typescript
interface EnhancedHotelOption extends PlannerHotelOption {
  // SENTIMENT BREAKDOWN (from Amadeus Hotel Ratings API)
  sentiments?: {
    cleanliness: number; // 0-10
    location: number;
    service: number;
    facilities: number;
    valueForMoney: number;
    comfort: number;
  };

  // TRAVELER TYPE SCORES (from reviews analysis)
  bestFor?: {
    families: number; // 0-10
    couples: number;
    business: number;
    solo: number;
  };

  // GUEST HIGHLIGHTS (from recent reviews)
  recentReviews?: Array<{
    text: string; // "Great location and friendly staff"
    author: string; // "Sarah K."
    date: string; // ISO date
    verified: boolean;
  }>;

  // PRICE ANALYTICS
  priceAnalytics?: {
    vsMarketAverage: number; // percentage (-15 = 15% below avg)
    trend: 'rising' | 'stable' | 'falling';
    confidence: number; // 0-100
  };

  // BOOKING URGENCY
  availability?: {
    roomsLeft: number; // null if > 10
    lastBookedMinutesAgo: number;
    viewsInLast24h: number;
  };

  // DISTANCE TO ATTRACTIONS
  nearbyAttractions?: Array<{
    name: string;
    distance: number; // km
    walkingTime: number; // minutes
  }>;
}
```

#### Implementation Priority:

1. ⭐⭐⭐ `sentiments` - Visual bars, high user value
2. ⭐⭐⭐ `bestFor` - Replace client calculation with real data
3. ⭐⭐ `priceAnalytics.vsMarketAverage` - Replace client calculation
4. ⭐⭐ `recentReviews` - Social proof, builds trust
5. ⭐ `availability.roomsLeft` - Urgency messaging
6. ⭐ `nearbyAttractions` - Location context

---

### Flights

#### High Priority Missing:

```typescript
interface EnhancedFlightOption extends PlannerFlightOption {
  // FARE RULES (currently hardcoded!)
  fareRules: {
    baggage: {
      carryOnWeight: string; // "7 kg"
      carryOnDimensions: string; // "55x40x20 cm"
      checkedWeight: string; // "23 kg per bag"
      checkedDimensions: string; // "158 cm total"
    };
    changes: {
      allowed: boolean;
      fee: number | null; // null if free
      beforeDeparture: boolean;
    };
    cancellation: {
      allowed: boolean;
      refundPercentage: number; // 0-100
      fee: number | null;
    };
    seatSelection: {
      included: boolean;
      fee: number | null;
    };
  };

  // CABIN-SPECIFIC AMENITIES (currently hardcoded!)
  cabinAmenities: {
    cabin: string; // "ECONOMY"
    items: Array<{
      category: 'seat' | 'meal' | 'entertainment' | 'wifi' | 'power';
      label: string;
      detail: string;
    }>;
  };

  // LAYOVER DETAILS (missing durations!)
  layovers?: Array<{
    airport: string; // "BOS"
    city: string; // "Boston"
    duration: number; // minutes
    overnight: boolean;
  }>;

  // DELAY PREDICTION (Amadeus Flight Delay API)
  delayPrediction?: {
    probability: number; // 0-100
    riskLevel: 'low' | 'medium' | 'high';
    historicalOnTimePercentage: number;
  };

  // AIRCRAFT INFO
  aircraft?: {
    type: string; // "Boeing 737-800"
    age: number; // years
    wifiAvailable: boolean;
    powerOutlets: boolean;
  };

  // MULTIPLE CABIN OPTIONS (for same flight)
  cabinOptions?: Array<{
    cabin: string; // "PREMIUM_ECONOMY"
    price: { amount: number; currency: string };
    available: boolean;
    fareRules: /* same structure */;
    amenities: /* same structure */;
  }>;
}
```

#### Implementation Priority:

1. ⭐⭐⭐ `fareRules` - **CRITICAL**, currently hardcoded lies
2. ⭐⭐⭐ `cabinAmenities` - **CRITICAL**, currently hardcoded
3. ⭐⭐⭐ `cabinOptions` - Enable cabin comparison on same flight
4. ⭐⭐ `layovers[].duration` - Better layover visualization
5. ⭐ `delayPrediction` - Risk indicator badge
6. ⭐ `aircraft` - Transparency, trust-building

---

## 📈 Backend API Enhancement Roadmap

### Phase 1: CRITICAL (Fix Hardcoding)

**Timeline**: Immediate
**Priority**: 🔴 **BLOCKING**

1. **Flight Fare Rules** (`fareRules` object)

   - Backend must provide: changes, cancellation, baggage details
   - **Current Issue**: Frontend shows fake data ("Changes allowed for $150")
   - **Risk**: User expectations mismatch, complaints, refunds

2. **Flight Cabin Amenities** (`cabinAmenities` object)

   - Backend must provide: seat pitch, meal service, entertainment
   - **Current Issue**: Frontend hardcodes generic amenities
   - **Risk**: Inaccurate information, user dissatisfaction

3. **Hotel Price Includes** (`price.includes[]` array)
   - Backend must include: breakfast, WiFi, parking
   - **Status**: ✅ UI ready, backend must send data
   - **Impact**: High transparency, value communication

---

### Phase 2: ENHANCE (Real Data)

**Timeline**: 1-2 weeks
**Priority**: 🟡 **HIGH**

1. **Hotel Sentiments** (Amadeus Hotel Ratings API)

   - Add sentiment breakdown to search results
   - Display as visual bars (cleanliness, location, service)

2. **Hotel "Best For"** (Review analysis)

   - Replace client logic with backend scores
   - Show real scores from verified reviews

3. **Price vs Market Average**

   - Backend calculate and send `priceAnalytics.vsMarketAverage`
   - More accurate than client-side average

4. **Flight Layover Durations**
   - Add `duration` field to `layovers[]` array
   - Enable "via Boston — 1h 45m" display

---

### Phase 3: OPTIMIZE (UX Polish)

**Timeline**: 2-4 weeks
**Priority**: 🟢 **MEDIUM**

1. **Recent Hotel Reviews** (2-3 quotes)

   - Social proof, builds trust
   - "Great location!" - Sarah K., verified guest

2. **Nearby Attractions** (distance/time)

   - "500m to Eiffel Tower (6 min walk)"
   - Location context

3. **Booking Urgency** (rooms left, views)

   - "Only 2 rooms left at this price"
   - "42 travelers viewed in last 24h"

4. **Flight Delay Prediction** (Amadeus API)
   - "Low delay risk" badge
   - Historical on-time percentage

---

## 🎯 Summary: What Backend MUST Send

### Hotels (Required for Current UI):

✅ **Already Sending**:

- id, name, location, rating, stars, amenities, images, price, roomType, cancellation, optionId

⚠️ **Should Send (UI Ready)**:

- `brand` - Hotel chain/brand name
- `price.includes[]` - What's included (breakfast, WiFi)
- `location.city` - City name (not just address)
- `location.country` - Country name
- `cancellation.until` - Specific deadline date

---

### Flights (Required for Current UI):

✅ **Already Sending**:

- id, airline, flightNumber, origin, destination, departure, arrival, duration, stops, price, cabin, optionId

🚨 **MISSING (Critical)**:

- `fareRules` - Changes, cancellation, baggage (currently fake data!)
- `cabinAmenities` - Real amenities per cabin (currently hardcoded!)
- `stopCities[]` - City names for layovers
- `layovers[].duration` - How long each layover is

⚠️ **Should Send**:

- `origin.city` - City name for origin
- `destination.city` - City name for destination
- `cabinOptions[]` - Multiple cabin prices for same flight

---

## 📝 Backend Action Items

### Immediate (This Sprint):

- [ ] Add `price.includes[]` to hotel search response
- [ ] Add `brand` field to hotel search response
- [ ] Add `fareRules` object to flight search response (**CRITICAL**)
- [ ] Add `cabinAmenities` to flight search response (**CRITICAL**)
- [ ] Add `layovers[].duration` to flight search response
- [ ] Ensure `cancellation.until` is ISO datetime string

### Next Sprint:

- [ ] Integrate Amadeus Hotel Ratings API for sentiment breakdown
- [ ] Calculate and send `priceAnalytics.vsMarketAverage`
- [ ] Add `bestFor` traveler type scores (from review analysis)
- [ ] Add `cabinOptions[]` array to show multiple cabin prices

### Future:

- [ ] Integrate Amadeus Flight Delay Prediction API
- [ ] Add `recentReviews[]` (2-3 recent guest quotes)
- [ ] Add `nearbyAttractions[]` (distance to POIs)
- [ ] Add `availability.roomsLeft` for urgency messaging

---

**Document Version**: 1.0.0
**Last Review**: October 21, 2025
**Next Review**: November 15, 2025
**Owner**: Voyance Engineering Team
**Status**: ✅ CANONICAL REFERENCE
