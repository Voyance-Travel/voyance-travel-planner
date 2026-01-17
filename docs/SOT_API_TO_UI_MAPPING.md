# API to UI Mapping - Source of Truth

**Last Updated**: October 21, 2025
**Purpose**: Complete mapping of backend API fields to frontend UI components
**Status**: ✅ CANONICAL REFERENCE

> **Critical**: This document shows EXACTLY which API fields power which UI elements. Use this when debugging "why isn't X showing?" issues.

---

## 📋 Table of Contents

- [Hotels: API → UI Mapping](#-hotels-api--ui-mapping)
- [Flights: API → UI Mapping](#-flights-api--ui-mapping)
- [Backend Requirements Summary](#-backend-requirements-summary)
- [Data Validation Rules](#-data-validation-rules)
- [Common Issues & Solutions](#-common-issues--solutions)

---

## 🏨 Hotels: API → UI Mapping

### Hotel API Structure (What Backend Sends)

**Endpoint**: `POST /api/v1/hotels/search`

```typescript
interface HotelResult {
  // Identification
  id: string; // Amadeus hotel ID
  name: string; // Hotel name
  optionId: string; // UUID for price locking

  // Pricing (MUST BE NUMBERS)
  pricePerNight: number; // ✅ Per night as NUMBER
  priceTotal: number; // ✅ Total as NUMBER
  currency: string; // "USD"

  // Visual
  photos: string[]; // ✅ Array of URLs

  // Location
  location: {
    lat: number;
    lng: number;
    city: string; // City code ("PAR")
    address: string | null;
    neighborhood: string | null;
  };

  // Classification
  stars: number; // 1-5
  brand: string; // "MC" (Marriott)
  chainCode: string;
  available: boolean;

  // Rooms
  roomOptions: Array<{
    id: string;
    type: string;
    description: string; // "Deluxe King Room"
    beds: number;
    bedType: string; // "KING"
    price: {
      total: number;
      perNight: number;
      currency: string;
    };
    cancellationPolicy?: {
      deadline: string; // ISO date
      amount?: string;
      numberOfNights?: number;
    };
  }>;

  // Amenities (CATEGORIZED)
  amenitiesDetailed: {
    basic: string[]; // ["WIFI", "PARKING", "BREAKFAST"]
    wellness: string[]; // ["GYM", "SPA", "POOL"]
    business: string[]; // ["BUSINESS_CENTER"]
    all: string[];
  };

  // Recommendations
  reasonCodes: string[]; // ["budget_match", "highly_rated"]
  recommended: boolean;

  // Legacy compatibility
  voyagerMaps: {
    rating: number;
    overall: number;
    reviewCount: number;
    photos: string[];
  };
}
```

---

### UI Component: Hotel Card (Complete Mapping)

**File**: `src/components/planner/steps/HotelSelectionUpdated.tsx`
**Component**: `HotelCard`

#### Hero Image Section (h-80)

| API Field                 | UI Element          | Location            | Code                                                        | Required    |
| ------------------------- | ------------------- | ------------------- | ----------------------------------------------------------- | ----------- |
| `photos[currentIndex]`    | Hero image          | Full background     | `<OptimizedImage src={displayImages[currentImageIndex]} />` | ✅ Critical |
| `photos.length`           | Image counter       | Top-right badge     | `{currentImageIndex + 1} / {displayImages.length}`          | ✅ Critical |
| `recommended`             | "Recommended" badge | Top-left            | `{hotel.recommended && <div>Recommended</div>}`             | ⚠️ Optional |
| `reasonCodes[0]`          | Reason badge 1      | Top-left            | `{plannerHotelAPI.getReasonCodeLabel(code)}`                | ⚠️ Optional |
| `reasonCodes[1]`          | Reason badge 2      | Top-left            | Second badge                                                | ⚠️ Optional |
| `brand`                   | Brand name          | Above hotel name    | `<div className="text-teal-600">{hotel.brand}</div>`        | ⚠️ Optional |
| `name`                    | Hotel name          | Overlay, large text | `<h3 className="text-2xl">{hotel.name}</h3>`                | ✅ Critical |
| `stars`                   | Star rating         | Below name          | `{renderStars(hotel.stars)}`                                | ✅ Critical |
| `voyagerMaps.overall`     | Numeric rating      | Badge               | `{hotel.voyagerMaps.overall?.toFixed(1)}`                   | ⚠️ Optional |
| `voyagerMaps.reviewCount` | Review count        | Text                | `({hotel.voyagerMaps.reviewCount} reviews)`                 | ⚠️ Optional |
| `location.city`           | City name           | Below rating        | `{hotel.location.city}`                                     | ✅ Critical |
| `location.neighborhood`   | Neighborhood        | With city           | Optional additional context                                 | ⚠️ Optional |
| `priceTotal`              | Total price         | Large price badge   | `${hotel.priceTotal.toFixed(2)}`                            | ✅ Critical |
| `pricePerNight`           | Per-night price     | Smaller text        | `${hotel.pricePerNight.toFixed(2)}/night`                   | ✅ Critical |
| `currency`                | Currency display    | With price          | Assumed USD for now                                         | ⚠️ Optional |

**Visual Example**:

```
┌──────────────────────────────────────────────────────┐
│ [photos[0] - HERO IMAGE]                             │
│  🏷️ Recommended  📍 {reasonCodes[0]}       [1/5]     │
│                                                      │
│  {brand}                                    ${priceTotal}│
│  {name}                                     ${pricePerNight}/night│
│  ⭐⭐⭐⭐⭐ {voyagerMaps.overall} ({reviewCount})        │
│  📍 {location.city}, {location.neighborhood}         │
└──────────────────────────────────────────────────────┘
```

---

#### Details Section (below image)

| API Field                                    | UI Element             | Location         | Code                                             | Required    |
| -------------------------------------------- | ---------------------- | ---------------- | ------------------------------------------------ | ----------- |
| `roomOptions[0].description`                 | Room type              | Details section  | `<div>{hotel.roomOptions[0]?.description}</div>` | ✅ Critical |
| `roomOptions[0].beds`                        | Bed count              | Room details     | `{room.beds} {room.bedType}`                     | ✅ Critical |
| `roomOptions[0].bedType`                     | Bed type               | Room details     | "KING", "QUEEN"                                  | ✅ Critical |
| `roomOptions[0].cancellationPolicy`          | Cancellation badge     | Green badge      | `Free Cancellation`                              | ⚠️ Optional |
| `roomOptions[0].cancellationPolicy.deadline` | Cancellation date      | Below badge      | `Until {date}`                                   | ⚠️ Optional |
| `amenitiesDetailed.basic[0-5]`               | Amenity grid           | 3-column grid    | First 6 amenities                                | ✅ Critical |
| `amenitiesDetailed.wellness[0-5]`            | Amenity grid           | Mixed with basic | Wellness amenities                               | ✅ Critical |
| `amenitiesDetailed.business[0-5]`            | Amenity grid           | Mixed with basic | Business amenities                               | ⚠️ Optional |
| `amenitiesDetailed.all.length`               | "+N more" button       | Below grid       | `+{length - 6} more amenities`                   | ⚠️ Optional |
| `reasonCodes[0-2]`                           | Recommendation reasons | Gradient section | All reason codes                                 | ⚠️ Optional |

**Code Mapping**:

```typescript
// Room Type Display
const primaryRoom = hotel.roomOptions?.[0];
<div className="flex items-center gap-2">
  <Building className="w-5 h-5" />
  <div>
    <div className="text-sm font-semibold">{primaryRoom?.description}</div>
    <div className="text-xs text-slate-500">
      {primaryRoom?.beds} {primaryRoom?.bedType} bed(s)
    </div>
  </div>
</div>;

// Amenities Grid (combining all categories)
const displayAmenities = [
  ...hotel.amenitiesDetailed.basic.slice(0, 3),
  ...hotel.amenitiesDetailed.wellness.slice(0, 3),
].slice(0, 6);

displayAmenities.map(amenity => (
  <div className="flex items-center gap-2">
    <IconComponent className="w-4 h-4" />
    <span>{amenity}</span>
  </div>
));
```

---

#### Expandable Details Section

| API Field               | UI Element        | Purpose                |
| ----------------------- | ----------------- | ---------------------- |
| `amenitiesDetailed.all` | Full amenity list | Show all amenities     |
| `roomOptions[]`         | All room types    | Show all room options  |
| `location.address`      | Full address      | Complete location info |

---

### Smart Features (Client-Side Calculations)

#### 1. "Best For" Traveler Tags

**API Fields Used**: `amenitiesDetailed.basic`, `amenitiesDetailed.wellness`, `stars`

**Logic**:

```typescript
const getBestForTags = () => {
  const tags = [];

  // Families
  if (
    hotel.amenitiesDetailed.wellness.some(
      a => a.toLowerCase().includes('pool') || a === 'KIDS_CLUB'
    )
  ) {
    tags.push({ icon: Users, label: 'Families', score: 9.2, color: 'purple' });
  }

  // Couples
  if (
    hotel.stars >= 4 ||
    hotel.amenitiesDetailed.wellness.some(a => a === 'SPA' || a === 'ROMANTIC')
  ) {
    tags.push({ icon: Sparkles, label: 'Couples', score: 9.0, color: 'pink' });
  }

  // Business
  if (
    hotel.amenitiesDetailed.business.length > 0 ||
    hotel.amenitiesDetailed.wellness.some(a => a === 'GYM')
  ) {
    tags.push({ icon: Briefcase, label: 'Business', score: 8.8, color: 'blue' });
  }

  return tags;
};
```

**Backend Could Enhance**: Send `bestFor: { families: 9.2, couples: 9.0, business: 8.8 }` with real scores

---

#### 2. Price Confidence Indicator

**API Fields Used**: `pricePerNight`, all results for average

**Logic**:

```typescript
const calculatePriceConfidence = () => {
  const avgPricePerNight = hotels.reduce((sum, h) => sum + h.pricePerNight, 0) / hotels.length;

  const priceVsAverage = ((hotel.pricePerNight - avgPricePerNight) / avgPricePerNight) * 100;

  if (priceVsAverage < -10) {
    return { label: 'Great Deal', color: 'emerald', icon: TrendingDown };
  } else if (priceVsAverage > 10) {
    return { label: 'Premium', color: 'orange', icon: TrendingUp };
  }
  return null;
};
```

**Backend Could Enhance**: Send `priceConfidence: { vsMarket: -15, label: "Great Deal" }`

---

#### 3. "What's Included" Pills

**API Field Used**: None currently (needs new field)

**Desired API Field**:

```typescript
interface HotelResult {
  // ... existing fields
  priceIncludes?: string[]; // ["BREAKFAST", "WIFI", "PARKING"]
}
```

**UI Display**:

```typescript
{
  hotel.priceIncludes
    ?.slice(0, 3)
    .map(item => (
      <div className="px-2 py-0.5 bg-emerald-500 text-white rounded-md text-xs">✓ {item}</div>
    ));
}
{
  hotel.priceIncludes?.length > 3 && (
    <span className="text-xs">+{hotel.priceIncludes.length - 3} more</span>
  );
}
```

**Status**: 🚨 **MISSING FROM API** - UI ready, backend must add

---

### Hotel Selection & Price Lock

**API Fields for Price Lock**:

```typescript
// When user selects hotel, call:
POST / api / v1 / hotels / hold;
Body: {
  tripId: string; // From search response
  optionId: string; // hotel.optionId
  total: number; // hotel.priceTotal
  currency: string; // hotel.currency
}

// Response:
{
  priceLock: {
    id: string;
    expiresAt: string; // ISO datetime
    amount: number;
    status: 'LOCKED';
  }
}
```

**UI Display**:

```typescript
// Show countdown timer
<PriceLockTimer
  expiresAt={priceLock.expiresAt}
  onExpired={() => toast.error('Price lock expired')}
/>
```

---

## ✈️ Flights: API → UI Mapping

### Flight API Structure (What Backend Sends)

**Endpoint**: `POST /api/v1/flights/search`

```typescript
interface FlightResult {
  // Identification
  id: string;
  airline: string; // 2-letter IATA code ("DL")
  flightNumber: string; // "DL123"
  optionId: string; // For price locking

  // Route
  origin: {
    airport: string; // "JFK"
    city: string; // "New York"
    terminal?: string; // "4"
  };
  destination: {
    airport: string; // "LHR"
    city: string; // "London"
    terminal?: string; // "5"
  };

  // Timing (MUST BE ISO STRINGS)
  departure: string; // "2025-11-15T10:30:00Z"
  arrival: string; // "2025-11-15T23:45:00Z"
  duration: number; // Minutes (495 = 8h 15m)

  // Stops
  stops: number; // 0, 1, 2
  stopCities?: string[]; // ["Boston", "Chicago"]
  layovers?: Array<{
    // 🚨 MISSING: Need durations
    airport: string;
    city: string;
    duration?: number; // Minutes (NOT SENT YET)
    overnight: boolean;
  }>;

  // Pricing (MUST BE NUMBERS)
  price: {
    amount: number; // ✅ Per person as NUMBER
    currency: string; // "USD"
  };

  // Cabin
  class: string; // Booking class ("Y")
  cabin: string; // "ECONOMY", "BUSINESS"

  // Baggage
  baggageIncluded: {
    carry_on: boolean;
    pieces: number; // Checked bags
  };

  // 🚨 MISSING: Fare rules (HARDCODED NOW!)
  fareRules?: {
    // NOT SENT YET
    baggage: {
      carryOnWeight: string; // "7 kg"
      checkedWeight: string; // "23 kg per bag"
    };
    changes: {
      allowed: boolean;
      fee: number | null;
    };
    cancellation: {
      allowed: boolean;
      refundPercentage: number;
    };
  };

  // 🚨 MISSING: Cabin amenities (HARDCODED NOW!)
  cabinAmenities?: {
    // NOT SENT YET
    items: Array<{
      category: string; // "seat", "meal", "wifi"
      label: string;
      detail: string;
    }>;
  };

  // Recommendations
  reasonCodes: string[]; // ["BEST_PRICE", "DIRECT_FLIGHT"]
  recommended: boolean;
}
```

---

### UI Component: Flight Card (Complete Mapping)

**File**: `src/components/planner/steps/FlightSelectionUpdated.tsx`
**Component**: Flight card

#### Card Header

| API Field          | UI Element          | Location      | Code                                    | Required    |
| ------------------ | ------------------- | ------------- | --------------------------------------- | ----------- |
| `airline`          | Airline logo        | Left side     | `<AirlineMark code={flight.airline} />` | ✅ Critical |
| `airline`          | Airline name        | Header text   | `{getAirlineName(flight.airline)}`      | ✅ Critical |
| `flightNumber`     | Flight number       | Below airline | `{flight.flightNumber}`                 | ✅ Critical |
| `recommended`      | "Recommended" badge | Top-right     | Teal badge                              | ⚠️ Optional |
| `reasonCodes[0-1]` | Reason badges       | Top-right     | White badges                            | ⚠️ Optional |
| `price.amount`     | Price               | Right side    | `${flight.price.amount}`                | ✅ Critical |
| `cabin`            | Cabin class         | Below price   | `{flight.cabin}`                        | ✅ Critical |

**Visual**:

```
┌──────────────────────────────────────────────────────┐
│ [Airline Logo] {airline} {flightNumber}    🏷️ {reason} │
│                                            ${price}   │
│                                            {cabin}    │
└──────────────────────────────────────────────────────┘
```

---

#### Route Timeline

| API Field             | UI Element      | Location        | Code                                          | Required       |
| --------------------- | --------------- | --------------- | --------------------------------------------- | -------------- |
| `departure`           | Departure time  | Left            | `{formatTime(flight.departure)}`              | ✅ Critical    |
| `origin.airport`      | Origin code     | Large text      | `{flight.origin.airport}`                     | ✅ Critical    |
| `origin.city`         | Origin city     | Below code      | `{flight.origin.city}`                        | ✅ Critical    |
| `arrival`             | Arrival time    | Right           | `{formatTime(flight.arrival)}`                | ✅ Critical    |
| `destination.airport` | Dest code       | Large text      | `{flight.destination.airport}`                | ✅ Critical    |
| `destination.city`    | Dest city       | Below code      | `{flight.destination.city}`                   | ✅ Critical    |
| `duration`            | Flight duration | Center          | `{formatDuration(flight.duration)}`           | ✅ Critical    |
| `stops`               | Stop badge      | Center          | `{stops === 0 ? "Nonstop" : `${stops} stop`}` | ✅ Critical    |
| `stopCities[]`        | Layover badges  | Below timeline  | `via {city}` badges                           | ⚠️ Optional    |
| `layovers[].duration` | Layover time    | With city badge | `1h 45m layover`                              | 🚨 **MISSING** |

**Code**:

```typescript
// Timeline Display
<div className="flex items-center justify-between">
  {/* Departure */}
  <div>
    <div className="text-2xl font-bold">
      {new Date(flight.departure).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}
    </div>
    <div className="text-xl font-semibold">{flight.origin.airport}</div>
    <div className="text-sm text-slate-500">{flight.origin.city}</div>
  </div>

  {/* Duration & Stops */}
  <div className="flex-1 mx-6">
    <div className="flex items-center justify-center gap-2">
      <Plane className="w-5 h-5" />
      <span className="text-sm font-medium">
        {Math.floor(flight.duration / 60)}h {flight.duration % 60}m
      </span>
    </div>
    <div className="h-1 bg-slate-200 rounded-full mt-2"></div>
    <div className="text-xs text-center mt-1">
      {flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
    </div>
  </div>

  {/* Arrival */}
  <div className="text-right">
    <div className="text-2xl font-bold">
      {new Date(flight.arrival).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      })}
    </div>
    <div className="text-xl font-semibold">{flight.destination.airport}</div>
    <div className="text-sm text-slate-500">{flight.destination.city}</div>
  </div>
</div>;

{
  /* Layovers - NEED DURATION FROM API */
}
{
  flight.stopCities && flight.stopCities.length > 0 && (
    <div className="mt-4 flex flex-wrap gap-2">
      {flight.stopCities.map((city, idx) => (
        <div key={idx} className="px-3 py-1 bg-slate-100 rounded-full text-sm">
          via {city}
          {/* 🚨 MISSING: Need layover duration from API */}
          {flight.layovers?.[idx]?.duration && (
            <span className="text-slate-500">
              {' '}
              — {Math.floor(flight.layovers[idx].duration! / 60)}h {flight.layovers[idx].duration! %
                60}m layover
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

#### Cabin Class Selector

| API Field | UI Element   | Status       | Issue                |
| --------- | ------------ | ------------ | -------------------- |
| `cabin`   | Active tab   | ✅ Works     | Current cabin shown  |
| N/A       | Economy tab  | ❌ Hardcoded | Need cabinOptions[0] |
| N/A       | Premium tab  | ❌ Hardcoded | Need cabinOptions[1] |
| N/A       | Business tab | ❌ Hardcoded | Need cabinOptions[2] |
| N/A       | First tab    | ❌ Hardcoded | Need cabinOptions[3] |

**What Backend Should Send**:

```typescript
interface FlightResult {
  // ... existing fields

  // 🚨 MISSING: Need cabin options for same flight
  cabinOptions: Array<{
    cabin: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST';
    class: string; // Booking class
    price: {
      amount: number;
      currency: string;
    };
    available: boolean;
    baggageIncluded: {
      carry_on: boolean;
      pieces: number;
    };
    amenities: {
      items: Array<{
        category: string;
        label: string;
        detail: string;
      }>;
    };
    fareRules: {
      changes: { allowed: boolean; fee: number | null };
      cancellation: { allowed: boolean; refundPercentage: number };
    };
  }>;
}
```

**Current Issue**: Frontend hardcodes cabin tiers with fake prices!

---

#### Fare Details Section

| API Field                         | UI Element     | Status         | Issue                        |
| --------------------------------- | -------------- | -------------- | ---------------------------- |
| `baggageIncluded.carry_on`        | Carry-on text  | ✅ Works       | Shows "Personal item"        |
| `baggageIncluded.pieces`          | Checked bags   | ✅ Works       | Shows count                  |
| `fareRules.baggage.carryOnWeight` | Baggage weight | 🚨 **MISSING** | Hardcoded "7 kg"             |
| `fareRules.changes.allowed`       | Changes policy | 🚨 **MISSING** | Hardcoded "allowed for $150" |
| `fareRules.cancellation.allowed`  | Refund policy  | 🚨 **MISSING** | Hardcoded "non-refundable"   |

**Current Code (HARDCODED - BAD!)**:

```typescript
// 🚨 THIS IS FAKE DATA - NEEDS TO COME FROM API
const getCabinTiers = () => [
  {
    name: 'Economy',
    price: basePrice,
    baggage: 'Personal item + 1 checked bag',
    changes: 'Changes allowed for $150',
    cancellation: 'Non-refundable',
  },
  {
    name: 'Premium Economy',
    price: basePrice * 1.3,
    baggage: 'Carry-on + 2 checked bags',
    changes: 'Changes allowed for $75',
    cancellation: 'Refundable (50% penalty)',
  },
  // ... MORE FAKE DATA
];
```

**What We Need From Backend**:

```typescript
// Real fare rules from Amadeus
fareRules: {
  baggage: {
    carryOnWeight: "7 kg",
    carryOnDimensions: "55x40x20 cm",
    checkedWeight: "23 kg per bag",
    checkedDimensions: "158 cm total"
  },
  changes: {
    allowed: true,
    fee: 150,              // Actual fee from airline
    beforeDeparture: true
  },
  cancellation: {
    allowed: false,        // Actual policy
    refundPercentage: 0,   // Actual percentage
    fee: null
  }
}
```

---

#### Cabin Amenities Section

| API Field              | UI Element   | Status         | Issue                       |
| ---------------------- | ------------ | -------------- | --------------------------- |
| `cabinAmenities.items` | Amenity list | 🚨 **MISSING** | Hardcoded generic amenities |

**Current Code (HARDCODED - BAD!)**:

```typescript
// 🚨 THIS IS FAKE DATA - NEEDS TO COME FROM API
const economyAmenities = [
  'Standard seat (30-32" pitch)',
  'Personal item',
  'Buy food & drinks onboard',
  'Streaming entertainment on your device',
];

const businessAmenities = [
  'Lie-flat seat (78" pitch)',
  'Priority boarding',
  'Premium meals & drinks',
  'Noise-canceling headphones',
];
```

**What We Need From Backend**:

```typescript
cabinAmenities: {
  items: [
    {
      category: 'seat',
      label: 'Standard seat',
      detail: '30-32" pitch, 17" width', // Real seat specs from Amadeus
    },
    {
      category: 'meal',
      label: 'Meal service',
      detail: 'Complimentary snacks & drinks', // Real meal info
    },
    {
      category: 'entertainment',
      label: 'Entertainment',
      detail: 'Seatback screen with 100+ movies', // Real IFE info
    },
    {
      category: 'wifi',
      label: 'WiFi',
      detail: '$8 full flight or free messaging', // Real WiFi pricing
    },
  ];
}
```

---

#### Sticky Recap Bar (Bottom of Screen)

| API Field                                | UI Element   | Purpose             |
| ---------------------------------------- | ------------ | ------------------- |
| `airline`                                | Airline mark | Show carrier logo   |
| `origin.airport` → `destination.airport` | Route        | Show flight route   |
| `departure` (date)                       | Date         | Show flight date    |
| `cabin`                                  | Cabin class  | Show selected cabin |
| `price.amount`                           | Price        | Show flight price   |

**Code**:

```typescript
<div className="sticky bottom-0 left-0 right-0 bg-white border-t shadow-lg p-6">
  <div className="flex justify-between items-center">
    {/* Outbound */}
    <div className="flex items-center gap-4">
      <AirlineMark code={selectedOutbound.airline} />
      <div>
        <div className="font-semibold">
          {selectedOutbound.origin.airport} → {selectedOutbound.destination.airport}
        </div>
        <div className="text-sm text-slate-500">
          {new Date(selectedOutbound.departure).toLocaleDateString()}
          {' • '}
          {selectedOutbound.cabin}
        </div>
      </div>
      <div className="text-lg font-bold">${selectedOutbound.price.amount}</div>
    </div>

    {/* Return (if selected) */}
    {selectedReturn && <div className="flex items-center gap-4">{/* Same structure */}</div>}

    {/* Total & Action */}
    <div className="flex items-center gap-4">
      <div>
        <div className="text-sm text-slate-500">Total</div>
        <div className="text-2xl font-bold">
          ${selectedOutbound.price.amount + (selectedReturn?.price.amount || 0)}
        </div>
      </div>
      <button onClick={handleContinue}>Continue to Hotels</button>
    </div>
  </div>
</div>
```

---

## 🎯 Backend Requirements Summary

### Hotels: What Must Be Sent

#### ✅ Already Correct (Keep These):

- `id`, `name`, `optionId` (strings)
- `pricePerNight`, `priceTotal` (numbers, not strings!)
- `currency` (string)
- `photos` (array of URLs)
- `location.lat`, `location.lng` (numbers)
- `location.city` (string)
- `stars` (number 1-5)
- `brand`, `chainCode` (strings)
- `roomOptions` (array with pricing)
- `amenitiesDetailed` (categorized object)
- `reasonCodes` (array)
- `recommended` (boolean)

#### ⚠️ Should Add (UI Ready):

```typescript
interface HotelResult {
  // ... existing fields

  // 1. What's included in price
  priceIncludes?: string[]; // ["BREAKFAST", "WIFI", "PARKING"]

  // 2. Sentiment scores (from Amadeus Hotel Ratings)
  sentiments?: {
    cleanliness: number; // 0-10
    location: number;
    service: number;
    facilities: number;
  };

  // 3. Traveler type scores
  bestFor?: {
    families: number; // 0-10 (real scores from reviews)
    couples: number;
    business: number;
  };

  // 4. Price analytics
  priceAnalytics?: {
    vsMarketAverage: number; // -15 means 15% below market
    trend: 'rising' | 'stable' | 'falling';
  };
}
```

---

### Flights: What Must Be Sent

#### ✅ Already Correct (Keep These):

- `id`, `optionId` (strings)
- `airline` (2-letter IATA code)
- `flightNumber` (string with prefix)
- `origin.airport`, `origin.city` (strings)
- `destination.airport`, `destination.city` (strings)
- `departure`, `arrival` (ISO datetime strings)
- `duration` (number in minutes)
- `stops` (number)
- `stopCities` (array of city names)
- `price.amount` (number, per person)
- `cabin` (string)
- `baggageIncluded.carry_on`, `baggageIncluded.pieces` (boolean, number)
- `reasonCodes`, `recommended`

#### 🚨 CRITICAL MISSING (Frontend Has Fake Data!):

```typescript
interface FlightResult {
  // ... existing fields

  // 1. FARE RULES (HARDCODED NOW!)
  fareRules: {
    baggage: {
      carryOnWeight: string;        // "7 kg" (from Amadeus)
      carryOnDimensions: string;    // "55x40x20 cm"
      checkedWeight: string;        // "23 kg per bag"
      checkedDimensions: string;    // "158 cm total"
    };
    changes: {
      allowed: boolean;             // From airline policy
      fee: number | null;           // Actual fee, not fake "$150"
      beforeDeparture: boolean;
    };
    cancellation: {
      allowed: boolean;             // From airline policy
      refundPercentage: number;     // 0-100, actual percentage
      fee: number | null;
    };
    seatSelection: {
      included: boolean;
      fee: number | null;
    };
  };

  // 2. CABIN AMENITIES (HARDCODED NOW!)
  cabinAmenities: {
    items: Array<{
      category: 'seat' | 'meal' | 'entertainment' | 'wifi' | 'power';
      label: string;                // "Standard seat"
      detail: string;               // "30-32" pitch" (from Amadeus)
    }>;
  };

  // 3. LAYOVER DURATIONS (MISSING!)
  layovers: Array<{
    airport: string;
    city: string;
    duration: number;               // Minutes! Not sent currently
    overnight: boolean;
  }>;

  // 4. CABIN OPTIONS (for price comparison)
  cabinOptions: Array<{
    cabin: string;                  // "PREMIUM_ECONOMY"
    price: { amount: number };      // Actual pricing
    available: boolean;
    fareRules: /* same structure */;
    cabinAmenities: /* same structure */;
  }>;
}
```

---

## ✅ Data Validation Rules

### Hotels

#### Numeric Fields (MUST call .toFixed()):

```typescript
// ✅ MUST be numbers, NOT strings
typeof hotel.pricePerNight === 'number'; // true
typeof hotel.priceTotal === 'number'; // true
typeof hotel.location.lat === 'number'; // true
typeof hotel.location.lng === 'number'; // true
typeof hotel.stars === 'number'; // true

// ❌ WRONG - Will break .toFixed()
hotel.pricePerNight = '185.50'; // NO!
hotel.priceTotal = '1295'; // NO!
```

#### Array Fields (MUST be arrays):

```typescript
// ✅ MUST be arrays, NOT null/undefined
Array.isArray(hotel.photos); // true (even if empty: [])
Array.isArray(hotel.roomOptions); // true
Array.isArray(hotel.amenitiesDetailed.basic); // true
Array.isArray(hotel.amenitiesDetailed.wellness); // true
Array.isArray(hotel.reasonCodes); // true

// ❌ WRONG - Will break .map()
hotel.photos = null; // NO!
hotel.photos = undefined; // NO!
```

#### Object Fields (MUST be objects):

```typescript
// ✅ MUST be objects, NOT null/undefined
typeof hotel.location === 'object'; // true
typeof hotel.amenitiesDetailed === 'object'; // true
typeof hotel.roomOptions[0].price === 'object'; // true
```

---

### Flights

#### Numeric Fields:

```typescript
// ✅ MUST be numbers
typeof flight.price.amount === 'number'; // true
typeof flight.duration === 'number'; // true (minutes)
typeof flight.stops === 'number'; // true

// ❌ WRONG
flight.price.amount = '875'; // NO!
flight.duration = '8h 15m'; // NO! Must be minutes (495)
```

#### ISO Datetime Fields:

```typescript
// ✅ MUST be valid ISO 8601 strings
flight.departure = '2025-11-15T10:30:00Z'; // YES
flight.arrival = '2025-11-15T23:45:00Z'; // YES

// ❌ WRONG
flight.departure = '10:30 AM'; // NO!
flight.departure = '2025-11-15'; // NO! Need time
flight.departure = 'Nov 15, 2025'; // NO! Not ISO format
```

#### IATA Codes:

```typescript
// ✅ MUST be valid IATA codes
flight.airline = 'DL'; // YES (2 letters)
flight.origin.airport = 'JFK'; // YES (3 letters)
flight.destination.airport = 'LHR'; // YES

// ❌ WRONG
flight.airline = 'Delta'; // NO! Use "DL"
flight.airline = 'delta'; // NO! Must be uppercase
flight.origin.airport = 'New York'; // NO! Use "JFK"
```

---

## 🔧 Data Validation Functions

### Frontend Validation (Development Mode)

```typescript
// Add to src/utils/apiValidation.ts
export function validateHotelData(hotel: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Critical numeric fields
  if (typeof hotel.pricePerNight !== 'number') {
    errors.push('pricePerNight must be number');
  }
  if (typeof hotel.priceTotal !== 'number') {
    errors.push('priceTotal must be number');
  }
  if (typeof hotel.stars !== 'number' || hotel.stars < 1 || hotel.stars > 5) {
    errors.push('stars must be number 1-5');
  }

  // Required arrays
  if (!Array.isArray(hotel.photos)) {
    errors.push('photos must be array');
  }
  if (!Array.isArray(hotel.roomOptions)) {
    errors.push('roomOptions must be array');
  }
  if (!hotel.amenitiesDetailed || !Array.isArray(hotel.amenitiesDetailed.basic)) {
    errors.push('amenitiesDetailed.basic must be array');
  }

  // Location
  if (!hotel.location || typeof hotel.location.lat !== 'number') {
    errors.push('location.lat must be number');
  }
  if (!hotel.location || typeof hotel.location.lng !== 'number') {
    errors.push('location.lng must be number');
  }

  // Room options pricing
  if (hotel.roomOptions && hotel.roomOptions.length > 0) {
    hotel.roomOptions.forEach((room: any, idx: number) => {
      if (typeof room.price?.total !== 'number') {
        errors.push(`roomOptions[${idx}].price.total must be number`);
      }
      if (typeof room.price?.perNight !== 'number') {
        errors.push(`roomOptions[${idx}].price.perNight must be number`);
      }
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

export function validateFlightData(flight: any): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Critical numeric fields
  if (typeof flight.price?.amount !== 'number') {
    errors.push('price.amount must be number');
  }
  if (typeof flight.duration !== 'number') {
    errors.push('duration must be number (minutes)');
  }
  if (typeof flight.stops !== 'number') {
    errors.push('stops must be number');
  }

  // ISO datetime validation
  const isValidISO = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toString() !== 'Invalid Date' && dateStr.includes('T');
  };

  if (!isValidISO(flight.departure)) {
    errors.push('departure must be valid ISO 8601 datetime');
  }
  if (!isValidISO(flight.arrival)) {
    errors.push('arrival must be valid ISO 8601 datetime');
  }

  // IATA codes
  if (!flight.airline || flight.airline.length !== 2) {
    errors.push('airline must be 2-letter IATA code');
  }
  if (!flight.origin?.airport || flight.origin.airport.length !== 3) {
    errors.push('origin.airport must be 3-letter IATA code');
  }
  if (!flight.destination?.airport || flight.destination.airport.length !== 3) {
    errors.push('destination.airport must be 3-letter IATA code');
  }

  // Stop cities
  if (flight.stops > 0 && !Array.isArray(flight.stopCities)) {
    errors.push('stopCities must be array if stops > 0');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

// Development logger
export function logValidationErrors(type: 'hotel' | 'flight', data: any[], label: string) {
  if (process.env.NODE_ENV !== 'development') return;

  console.group(`🔍 Validating ${type} data: ${label}`);

  data.forEach((item, idx) => {
    const validation = type === 'hotel' ? validateHotelData(item) : validateFlightData(item);

    if (validation.isValid) {
      console.log(`✅ Item ${idx + 1}: Valid`);
    } else {
      console.error(`❌ Item ${idx + 1}: Invalid`);
      validation.errors.forEach(err => console.error(`  - ${err}`));
    }
  });

  console.groupEnd();
}
```

**Usage in Components**:

```typescript
// In HotelSelectionUpdated.tsx
import { validateHotelData, logValidationErrors } from '@/utils/apiValidation';

useEffect(() => {
  if (process.env.NODE_ENV === 'development' && hotels.length > 0) {
    logValidationErrors('hotel', hotels, 'Search Results');
  }
}, [hotels]);

// In FlightSelectionUpdated.tsx
useEffect(() => {
  if (process.env.NODE_ENV === 'development' && flights.length > 0) {
    logValidationErrors('flight', flights, 'Search Results');
  }
}, [flights]);
```

---

## 🚨 Common Issues & Solutions

### Issue 1: "Cannot read property 'toFixed' of undefined"

**Cause**: Price field is not a number

**Fix**:

```typescript
// ❌ BAD - Backend sent string
hotel.priceTotal = "1295.50"  // String!
${hotel.priceTotal.toFixed(2)}  // ERROR!

// ✅ GOOD - Backend sends number
hotel.priceTotal = 1295.50  // Number!
${hotel.priceTotal.toFixed(2)}  // "1295.50"
```

---

### Issue 2: "Cannot read property 'map' of undefined"

**Cause**: Array field is null/undefined

**Fix**:

```typescript
// ❌ BAD - Backend sent null
hotel.photos = null
hotel.photos.map(...)  // ERROR!

// ✅ GOOD - Backend always sends array (even if empty)
hotel.photos = []  // or ["url1", "url2"]
hotel.photos.map(...)  // Works!
```

---

### Issue 3: "Invalid Date" in timeline

**Cause**: Datetime is not ISO 8601 format

**Fix**:

```typescript
// ❌ BAD - Not ISO format
flight.departure = '10:30 AM'; // ERROR!
flight.departure = 'Nov 15, 2025'; // ERROR!

// ✅ GOOD - ISO 8601
flight.departure = '2025-11-15T10:30:00Z';
new Date(flight.departure).toLocaleTimeString(); // Works!
```

---

### Issue 4: Airline logo not showing

**Cause**: Wrong airline code format

**Fix**:

```typescript
// ❌ BAD - Full name or lowercase
flight.airline = "Delta"  // ERROR!
flight.airline = "dl"     // ERROR!

// ✅ GOOD - 2-letter IATA code, uppercase
flight.airline = "DL"
<AirlineMark code={flight.airline} />  // Shows Delta logo
```

---

### Issue 5: Hardcoded fare rules/amenities

**Cause**: Backend not sending `fareRules` and `cabinAmenities`

**Current Workaround** (temporary):

```typescript
// Frontend hardcodes (NOT IDEAL)
const getCabinTiers = () => [...]  // Fake data

// Users see: "Changes allowed for $150"
// Reality: May not be accurate!
```

**Solution**: Backend must integrate Amadeus fare rules and send real data

---

## 📋 Backend Action Checklist

### Hotels (Immediate):

- [ ] Verify `pricePerNight` and `priceTotal` are sent as numbers
- [ ] Verify `photos` is always an array (never null)
- [ ] Verify `roomOptions` is always an array with pricing
- [ ] Verify `amenitiesDetailed` has basic/wellness/business arrays
- [ ] Add `priceIncludes: string[]` field (what's included in price)

### Hotels (Next Sprint):

- [ ] Integrate Amadeus Hotel Ratings API for `sentiments`
- [ ] Calculate and send `bestFor` traveler scores
- [ ] Calculate and send `priceAnalytics.vsMarketAverage`

### Flights (CRITICAL - This Sprint):

- [ ] Add `fareRules` object with real data from Amadeus
- [ ] Add `cabinAmenities` with real amenity data
- [ ] Add `layovers[].duration` field (minutes)
- [ ] Verify `departure` and `arrival` are ISO 8601 strings
- [ ] Verify `airline` is 2-letter IATA code (uppercase)
- [ ] Verify `duration` is in minutes (not hours)

### Flights (Next Sprint):

- [ ] Add `cabinOptions[]` array for cabin comparison
- [ ] Add `fareRules` for each cabin option
- [ ] Add terminal information if available

---

**Document Version**: 1.0.0
**Last Updated**: October 21, 2025
**Next Review**: When API structure changes
**Owner**: Voyance Engineering Team
**Status**: ✅ CANONICAL REFERENCE - Use this to debug data issues
