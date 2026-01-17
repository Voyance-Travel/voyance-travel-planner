# Amadeus API Integration - Source of Truth

**Last Updated**: October 21, 2025
**Voyance Integration Status**: Active Development
**Amadeus Account**: Production Access

> **Purpose**: This document serves as the canonical reference for all Amadeus APIs available to Voyance, detailing current usage, integration status, and future planning for each endpoint.

---

## 📋 Table of Contents

### By Category

- [✈️ Flight APIs](#️-flight-apis)
- [🏨 Hotel APIs](#-hotel-apis)
- [🚕 Transfer & Ground Transport APIs](#-transfer--ground-transport-apis)
- [🎯 Tours & Activities APIs](#-tours--activities-apis)
- [🧭 Travel Insights & Recommendations](#-travel-insights--recommendations)
- [📍 Location & Reference Data APIs](#-location--reference-data-apis)
- [💳 Booking & Order Management](#-booking--order-management)

### Quick Reference

- [Summary Classification Table](#-summary-classification-table)
- [Authentication & Rate Limits](#-authentication--rate-limits)
- [Integration Architecture](#-integration-architecture)

---

## 🔐 Authentication & Rate Limits

### Authentication

- **Type**: OAuth 2.0 Client Credentials
- **Token Endpoint**: `https://test.api.amadeus.com/v1/security/oauth2/token` (Test)
- **Production Endpoint**: `https://api.amadeus.com/v1/security/oauth2/token`
- **Grant Type**: `client_credentials`
- **Token Lifespan**: 30 minutes (refresh before expiry)

### Standard Headers

```http
Authorization: Bearer {access_token}
Content-Type: application/json
Accept: application/json
```

### Rate Limits

- **Free Tier**: 10 requests/second, 1,000 requests/month
- **Production Tier**: 200 requests/minute, unlimited monthly quota
- **429 Response**: Rate limit exceeded, retry with exponential backoff
- **Rate Limit Headers**:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

### Voyance Backend Configuration

- All Amadeus API calls are proxied through Voyance backend (`/api/v1/*`)
- Backend handles authentication, rate limiting, caching, and response transformation
- Frontend never calls Amadeus directly
- 15-minute cache TTL for flight/hotel searches (matches price lock duration)

---

## ✈️ Flight APIs

### 1. Flight Offers Search

**Status:** ✅ **ACTIVE** | **Category:** Flights
**Purpose:** Search for flight offers based on origin, destination, dates, and passenger details. Returns comprehensive pricing and availability data.

**Endpoint(s):**

- `POST https://api.amadeus.com/v2/shopping/flight-offers`
- Voyance Backend: `POST /api/v1/flights/search`

#### 🔐 Authentication

- Token type: OAuth2 Bearer
- Scope: Standard API access
- Example header:
  ```http
  Authorization: Bearer {access_token}
  ```

#### 🧩 Request Schema (Voyance Format)

| Field       | Type   | Required | Description                               |
| ----------- | ------ | -------- | ----------------------------------------- |
| tripId      | string | yes      | Voyance trip identifier                   |
| origin      | string | yes      | 3-letter IATA code (e.g., "JFK")          |
| destination | string | yes      | 3-letter IATA code (e.g., "LHR")          |
| dates.out   | string | yes      | Departure date (YYYY-MM-DD)               |
| dates.back  | string | no       | Return date for round-trip                |
| cabin       | string | yes      | economy, premium_economy, business, first |
| passengers  | number | yes      | Number of travelers (1-9)                 |
| budgetTier  | string | yes      | safe, stretch, splurge                    |

#### 🧾 Response Schema (Voyance Format)

| Field            | Type    | Description                       |
| ---------------- | ------- | --------------------------------- |
| success          | boolean | Request success status            |
| tripId           | string  | Trip identifier                   |
| searchId         | string  | Unique search session ID          |
| results          | array   | Outbound flight options           |
| returnResults    | array   | Return flight options (roundtrip) |
| meta.resultCount | number  | Total results returned            |

#### 🧮 Sample Request

```json
{
  "tripId": "trip_abc123",
  "origin": "ATL",
  "destination": "CDG",
  "dates": {
    "out": "2025-11-15",
    "back": "2025-11-22"
  },
  "cabin": "economy",
  "passengers": 2,
  "budgetTier": "stretch"
}
```

#### 🧾 Sample Response (Simplified)

```json
{
  "success": true,
  "tripId": "trip_abc123",
  "searchId": "search_xyz789",
  "results": [
    {
      "id": "flight_001",
      "airline": "Delta Air Lines",
      "flightNumber": "DL123",
      "origin": { "airport": "ATL", "city": "Atlanta" },
      "destination": { "airport": "CDG", "city": "Paris" },
      "departure": "2025-11-15T10:30:00",
      "arrival": "2025-11-16T01:45:00",
      "duration": 555,
      "stops": 0,
      "price": { "amount": 875.0, "currency": "USD" },
      "cabin": "ECONOMY",
      "optionId": "opt_abc123",
      "recommended": true,
      "reasonCodes": ["BEST_PRICE", "DIRECT_FLIGHT"]
    }
  ]
}
```

#### 💡 Voyance Usage

- **Core Feature**: Trip Planner Flight Selection (Step 3)
- **Caching Strategy**: 15-minute in-memory cache with `requestCache` utility
- **Transformation**: Amadeus response → Voyance `PlannerFlightOption` format
- **Budget Tier Integration**: Results filtered/sorted based on user's budgetTier
- **Recommendation Engine**: Backend applies `reasonCodes` for smart suggestions
- **Price Lock**: Each result includes `optionId` for subsequent hold operation

#### ⚙️ Integration Notes

- **Rate Limit**: 200 requests/minute (production tier required)
- **Pagination**: Amadeus supports pagination, Voyance implements client-side pagination (10 items/page)
- **Error Handling**:
  - `400 BAD_REQUEST`: Invalid IATA codes or date format
  - `404 NOT_FOUND`: No flights available for route/date
  - `429 RATE_LIMIT`: Retry with exponential backoff
  - `500 SERVER_ERROR`: Fallback to cached results if available
- **Current Implementation**: `src/services/plannerFlightAPI.ts`
- **Backend Endpoint**: Voyance backend wraps this in `/api/v1/flights/search`

---

### 2. Flight Offers Price

**Status:** ⚙️ **AVAILABLE** | **Category:** Flights
**Purpose:** Confirm pricing and availability for specific flight offers before booking. Ensures price hasn't changed since search.

**Endpoint(s):**

- `POST https://api.amadeus.com/v1/shopping/flight-offers/pricing`
- Voyance Backend: `POST /api/v1/flights/hold` (price lock implementation)

#### 🔐 Authentication

- Token type: OAuth2 Bearer
- Scope: Standard API access

#### 🧩 Request Schema

| Field             | Type   | Required | Description                       |
| ----------------- | ------ | -------- | --------------------------------- |
| data.type         | string | yes      | "flight-offers-pricing"           |
| data.flightOffers | array  | yes      | Flight offers from search results |

#### 🧾 Response Schema

| Field                    | Type   | Description                                |
| ------------------------ | ------ | ------------------------------------------ |
| data.flightOffers        | array  | Confirmed flight offers with final pricing |
| data.bookingRequirements | object | Requirements for completing booking        |

#### 💡 Voyance Usage

- **Integration Status**: Partially integrated via `/api/v1/flights/hold`
- **Use Case**: Price confirmation before 15-minute price lock
- **Implementation**: Backend validates price, creates lock session, stores in Redis
- **User Experience**: User sees countdown timer, price guaranteed for 15 minutes
- **Next Step**: Currently used implicitly during hold operation

#### ⚙️ Integration Notes

- **Rate Limit**: Lower priority, use sparingly
- **Caching**: Not cached (real-time pricing verification)
- **Error Codes**: `400` (offer expired), `409` (price changed)
- **Voyance Enhancement**: Backend adds 15-minute lock mechanism on top of Amadeus pricing

---

### 3. Flight Create Orders

**Status:** 🕓 **PLANNED** | **Category:** Flights
**Purpose:** Create flight booking and generate PNR (Passenger Name Record). Final step after payment confirmation.

**Endpoint(s):**

- `POST https://api.amadeus.com/v1/booking/flight-orders`
- Voyance Backend: `POST /api/v1/flights/book` (planned)

#### 🔐 Authentication

- Token type: OAuth2 Bearer
- Scope: Booking API (requires paid tier)

#### 🧩 Request Schema

| Field             | Type   | Required | Description                              |
| ----------------- | ------ | -------- | ---------------------------------------- |
| data.type         | string | yes      | "flight-order"                           |
| data.flightOffers | array  | yes      | Selected offers from pricing             |
| data.travelers    | array  | yes      | Passenger details (name, DOB, passport)  |
| data.contacts     | array  | yes      | Email and phone for booking confirmation |
| data.payment      | object | yes      | Payment method details                   |

#### 🧾 Response Schema

| Field                   | Type   | Description                        |
| ----------------------- | ------ | ---------------------------------- |
| data.id                 | string | Amadeus booking ID                 |
| data.queuingOfficeId    | string | Office ID for managing reservation |
| data.associatedRecords  | array  | PNR and other reference numbers    |
| data.travelers          | array  | Confirmed traveler details         |
| data.ticketingAgreement | object | Ticketing details and restrictions |

#### 💡 Voyance Usage

- **Integration Status**: NOT YET IMPLEMENTED
- **Planned Use Case**: Post-MVP booking flow after Stripe payment
- **Dependencies**: Requires Stripe webhook confirmation first
- **Backend Flow**:
  1. User completes Stripe checkout
  2. Webhook confirms payment
  3. Backend calls Amadeus Flight Create Orders
  4. Store PNR in database
  5. Send confirmation email
- **Frontend**: Display booking confirmation with PNR

#### ⚙️ Integration Notes

- **Requires**: Production tier + Booking API access (paid)
- **Testing**: Use Amadeus test environment with test cards
- **Error Handling**: Critical - any failure requires refund via Stripe
- **Retry Logic**: Implement idempotency key to prevent duplicate bookings
- **Current Workaround**: Manual booking confirmation

---

### 4. Flight Order Management

**Status:** 🕓 **PLANNED** | **Category:** Flights
**Purpose:** Retrieve, cancel, or modify existing flight bookings. Post-booking management.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/booking/flight-orders/{id}`
- `DELETE https://api.amadeus.com/v1/booking/flight-orders/{id}` (cancellation)
- Voyance Backend: `/api/v1/flights/orders/*` (planned)

#### 💡 Voyance Usage

- **Planned Feature**: Post-MVP trip management dashboard
- **Use Cases**:
  - View booking details
  - Cancel bookings (with refund processing)
  - Retrieve PNR for traveler
- **Dependencies**: Requires Flight Create Orders to be implemented first

#### ⚙️ Integration Notes

- **Requires**: Booking API tier (paid)
- **Cancellation Policy**: Depends on fare class and airline rules
- **Refund Processing**: Coordinate with Stripe refund API

---

### 5. Airport & City Search

**Status:** ✅ **ACTIVE** | **Category:** Reference Data
**Purpose:** Autocomplete and search for airports by city name, airport code, or location. Returns IATA codes for flight search.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/reference-data/locations`
- Voyance Backend: `GET /api/airports/search`

#### 🧩 Request Schema

| Field       | Type   | Required | Description                             |
| ----------- | ------ | -------- | --------------------------------------- |
| keyword     | string | yes      | Search query (city, airport name, IATA) |
| subType     | string | no       | AIRPORT, CITY (default: both)           |
| page[limit] | number | no       | Results per page (default: 10)          |

#### 🧾 Response Schema

| Field                      | Type   | Description               |
| -------------------------- | ------ | ------------------------- |
| data                       | array  | Array of location objects |
| data[].iataCode            | string | 3-letter IATA code        |
| data[].name                | string | Airport/city name         |
| data[].address.cityName    | string | City name                 |
| data[].address.countryName | string | Country name              |

#### 💡 Voyance Usage

- **Active Feature**: Airport autocomplete in trip planner
- **Component**: `AutoCompleteSelect` with `airportAPI.searchAirports()`
- **Transformation**: Backend converts to `AirportSearchResult` format
- **Fallback**: Frontend includes hardcoded fallback for major airports
- **UX**: Shows flag emoji, city, country, and IATA code
- **Validation**: Extracts IATA code from user selection for flight search

#### ⚙️ Integration Notes

- **Caching**: Results cached for 24 hours (rarely change)
- **Fallback Data**: 10 major airports hardcoded in `airportAPI.ts`
- **Error Handling**: Graceful fallback to local data on API failure
- **Search Optimization**: Minimum 2 characters before search
- **Current File**: `src/services/airportAPI.ts`

---

### 6. Airline Code Lookup

**Status:** ✅ **ACTIVE** (via static mapping) | **Category:** Reference Data
**Purpose:** Convert airline codes (IATA/ICAO) to full airline names and retrieve logos.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/reference-data/airlines`
- Voyance Implementation: Static mapping in `src/utils/airlineMapping.ts`

#### 💡 Voyance Usage

- **Current Implementation**: Static mapping file (no API calls)
- **Use Case**: Display airline names and logos in flight cards
- **Logo Integration**: Uses Kiwi.com CDN for airline logos:
  - URL: `https://images.kiwi.com/airlines/64/{IATA_CODE}.png`
  - Fallback: Gradient badge with airline code
- **Component**: `AirlineMark.tsx` displays logo or styled badge
- **Future**: Could integrate Amadeus API for dynamic airline data

#### ⚙️ Integration Notes

- **Why Static**: Airline codes rarely change, saves API calls
- **Logo Handling**: CSP updated to allow `images.kiwi.com`
- **Fallback UI**: Gradient colored badges for unknown airlines
- **Update Frequency**: Manual updates when new airlines added

---

### 7. Flight Cheapest Date Search

**Status:** 📊 **AVAILABLE** | **Category:** Flight Inspiration
**Purpose:** Find cheapest dates to fly for a given route. Helps users find budget-friendly travel windows.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/shopping/flight-dates`

#### 🧩 Request Schema

| Field         | Type    | Required | Description                      |
| ------------- | ------- | -------- | -------------------------------- |
| origin        | string  | yes      | IATA code                        |
| destination   | string  | yes      | IATA code                        |
| departureDate | string  | no       | Start of date range (YYYY-MM-DD) |
| oneWay        | boolean | no       | One-way vs round-trip            |
| duration      | string  | no       | Trip duration (1-15 days)        |
| nonStop       | boolean | no       | Direct flights only              |
| maxPrice      | number  | no       | Maximum price filter             |

#### 🧾 Response Schema

| Field                | Type   | Description                      |
| -------------------- | ------ | -------------------------------- |
| data                 | array  | Array of date/price combinations |
| data[].departureDate | string | Departure date                   |
| data[].returnDate    | string | Return date (if round-trip)      |
| data[].price.total   | string | Total price                      |

#### 💡 Voyance Usage

- **Potential Feature**: "Flexible Dates" price calendar
- **Use Case**: Help budget-conscious users find cheapest travel dates
- **UI Concept**: Heat map calendar showing price variations
- **Integration Priority**: Nice-to-have for future enhancement
- **User Benefit**: Price-aware date selection before committing

#### ⚙️ Integration Notes

- **Rate Limit**: Standard (200/min)
- **Caching**: 24-hour cache (prices change daily)
- **Frontend Display**: Calendar with color-coded prices
- **Backend Transformation**: Convert to calendar-friendly format

---

### 8. Flight Delay Prediction

**Status:** 📊 **AVAILABLE** | **Category:** Travel Insights
**Purpose:** Predict flight delay probability based on historical data and current conditions.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/travel/predictions/flight-delay`

#### 💡 Voyance Usage

- **Potential Feature**: "Flight Risk Score" indicator
- **Use Case**: Warn users about historically delayed routes
- **Display**: Badge on flight cards ("High delay risk")
- **Integration Priority**: Post-MVP enhancement
- **User Benefit**: Make informed decisions, plan buffer time

#### ⚙️ Integration Notes

- **Requires**: Paid tier access
- **Update Frequency**: Real-time predictions
- **Cache**: Short TTL (1 hour, conditions change)
- **UX**: Non-intrusive badge, not a booking blocker

---

### 9. On-Demand Flight Status

**Status:** 📊 **AVAILABLE** | **Category:** Travel Tracking
**Purpose:** Real-time flight status, gate info, and delay updates for booked flights.

**Endpoint(s):**

- `GET https://api.amadeus.com/v2/schedule/flights`

#### 💡 Voyance Usage

- **Planned Feature**: Trip dashboard with live flight tracking
- **Use Case**: Track booked flights in real-time
- **Notifications**: Email/push for gate changes, delays
- **Integration Priority**: Post-booking features (Phase 2)

---

### 10. SeatMap Display

**Status:** 📊 **AVAILABLE** | **Category:** Flight Extras
**Purpose:** Retrieve aircraft seat maps for seat selection during booking.

**Endpoint(s):**

- `POST https://api.amadeus.com/v1/shopping/seatmaps`

#### 💡 Voyance Usage

- **Planned Feature**: Premium booking flow
- **Use Case**: Visual seat selection, show available seats
- **Requires**: Integration with Flight Create Orders
- **Integration Priority**: Phase 3 (premium features)

---

### 11. Flight Price Analysis

**Status:** 📊 **AVAILABLE** | **Category:** Travel Insights
**Purpose:** Analyze if current flight price is good deal based on historical data.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/analytics/itinerary-price-metrics`

#### 💡 Voyance Usage

- **Potential Feature**: "Price Confidence" indicator
- **Use Case**: Show "Great Deal" or "Price Above Average" badge
- **Display**: Visual indicator on flight cards
- **User Benefit**: Confidence in booking decision
- **Integration Priority**: Nice-to-have

---

## 🏨 Hotel APIs

### 12. Hotel Search

**Status:** ✅ **ACTIVE** | **Category:** Hotels
**Purpose:** Search for hotels by city, dates, and guest count. Returns availability and pricing.

**Endpoint(s):**

- `GET https://api.amadeus.com/v3/shopping/hotel-offers`
- Voyance Backend: `POST /api/v1/hotels/search`

#### 🔐 Authentication

- Token type: OAuth2 Bearer
- Scope: Standard API access

#### 🧩 Request Schema (Voyance Format)

| Field      | Type   | Required | Description                 |
| ---------- | ------ | -------- | --------------------------- |
| tripId     | string | yes      | Voyance trip identifier     |
| cityCode   | string | yes      | 3-letter city/IATA code     |
| dates.in   | string | yes      | Check-in date (YYYY-MM-DD)  |
| dates.out  | string | yes      | Check-out date (YYYY-MM-DD) |
| rooms      | number | yes      | Number of rooms             |
| guests     | number | yes      | Total guests                |
| budgetTier | string | yes      | safe, stretch, splurge      |

#### 🧾 Response Schema (Voyance Format)

| Field                    | Type    | Description        |
| ------------------------ | ------- | ------------------ |
| success                  | boolean | Request success    |
| results                  | array   | Hotel options      |
| results[].name           | string  | Hotel name         |
| results[].stars          | number  | Star rating (1-5)  |
| results[].rating.overall | number  | Guest rating (1-5) |
| results[].price.total    | number  | Total stay price   |
| results[].optionId       | string  | ID for price lock  |
| results[].amenities      | array   | Hotel amenities    |
| results[].images         | array   | Hotel photos       |
| results[].recommended    | boolean | AI recommendation  |

#### 🧮 Sample Request

```json
{
  "tripId": "trip_abc123",
  "cityCode": "PAR",
  "dates": {
    "in": "2025-11-15",
    "out": "2025-11-22"
  },
  "rooms": 1,
  "guests": 2,
  "budgetTier": "stretch"
}
```

#### 🧾 Sample Response (Simplified)

```json
{
  "success": true,
  "tripId": "trip_abc123",
  "results": [
    {
      "id": "hotel_001",
      "name": "Hotel des Champs-Élysées",
      "stars": 4,
      "rating": { "overall": 4.5, "count": 1243 },
      "location": {
        "address": "123 Rue de Rivoli",
        "city": "Paris",
        "lat": 48.8566,
        "lng": 2.3522,
        "distanceFromCenter": 1.2
      },
      "price": {
        "perNight": 185,
        "total": 1295,
        "currency": "USD",
        "includes": ["Breakfast", "WiFi"]
      },
      "amenities": ["WiFi", "Pool", "Gym", "Restaurant"],
      "images": ["https://..."],
      "optionId": "opt_hotel_xyz",
      "recommended": true,
      "reasonCodes": ["BEST_VALUE", "HIGH_RATING"]
    }
  ]
}
```

#### 💡 Voyance Usage

- **Active Feature**: Trip Planner Hotel Selection (Step 4)
- **Caching**: 15-minute cache with `requestCache`
- **UI Components**: Premium magazine-style hotel cards
- **Features**:
  - Photo carousel with 5 images
  - Star rating + guest reviews
  - Amenities grid (6 visible, expandable)
  - Free cancellation badge
  - Distance from city center
  - Recommendation reasons
- **Price Lock**: `optionId` used for 15-minute hold
- **Client-Side Pagination**: 10 hotels per page
- **Filters**: Star rating, price, amenities (Pool, WiFi, Gym, etc.)

#### ⚙️ Integration Notes

- **Rate Limit**: 200 requests/minute (production tier)
- **Error Handling**:
  - `400`: Invalid city code or dates
  - `404`: No hotels available
  - `500`: Fallback to cached results
- **Current Implementation**: `src/services/plannerHotelAPI.ts`
- **Component**: `HotelSelectionUpdated.tsx` with premium card design
- **Backend**: Wraps Amadeus Hotel Search v3 API

---

### 13. Hotel Booking

**Status:** 🕓 **PLANNED** | **Category:** Hotels
**Purpose:** Create hotel reservation after payment confirmation. Generates confirmation number.

**Endpoint(s):**

- `POST https://api.amadeus.com/v1/booking/hotel-bookings`
- Voyance Backend: `/api/v1/hotels/book` (planned)

#### 💡 Voyance Usage

- **Integration Status**: NOT YET IMPLEMENTED
- **Planned Use**: Post-payment booking confirmation
- **Dependencies**: Stripe payment + Amadeus Booking API tier
- **Flow**:
  1. User completes Stripe checkout
  2. Webhook confirms payment
  3. Backend creates hotel booking via Amadeus
  4. Store confirmation in database
  5. Send confirmation email with voucher

#### ⚙️ Integration Notes

- **Requires**: Paid tier + Booking API access
- **Critical**: Booking failure requires Stripe refund
- **Retry Logic**: Implement idempotency
- **Testing**: Use Amadeus test environment

---

### 14. Hotel Ratings

**Status:** ⚙️ **AVAILABLE** | **Category:** Hotels
**Purpose:** Retrieve detailed hotel ratings and reviews sentiment analysis.

**Endpoint(s):**

- `GET https://api.amadeus.com/v2/e-reputation/hotel-sentiments`

#### 💡 Voyance Usage

- **Current**: Basic rating shown from search results
- **Enhancement Opportunity**: Detailed sentiment breakdown
- **Potential Display**:
  - Cleanliness score
  - Location score
  - Service score
  - Value for money
  - Sentiment tags (e.g., "Great location", "Excellent breakfast")
- **Integration Priority**: UI enhancement, not critical

#### ⚙️ Integration Notes

- **Caching**: 7-day cache (reviews don't change frequently)
- **Display**: Show in hotel card expandable section
- **Data Source**: Aggregated from multiple review platforms

---

### 15. Hotel Name Autocomplete

**Status:** ⚙️ **AVAILABLE** | **Category:** Hotels
**Purpose:** Autocomplete for hotel names and properties. Useful for "book your own hotel" flow.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/reference-data/locations/hotels/by-city`
- `GET https://api.amadeus.com/v1/reference-data/locations/hotels/by-geocode`

#### 💡 Voyance Usage

- **Current**: Not implemented (using city-based search)
- **Potential Feature**: "Skip hotel selection" + specific hotel booking
- **Use Case**: User wants to book specific hotel chain
- **Integration Priority**: Low (current city search sufficient)

---

### 16. Hotel List

**Status:** ⚙️ **AVAILABLE** | **Category:** Hotels
**Purpose:** Get list of hotel IDs in a city for bulk lookups or integrations.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/reference-data/locations/hotels/by-city`

#### 💡 Voyance Usage

- **Use Case**: Pre-populate hotel database for faster search
- **Integration Priority**: Optimization, not critical
- **Benefit**: Reduce API calls by caching hotel metadata

---

## 🚕 Transfer & Ground Transport APIs

### 17. Transfer Search

**Status:** 📊 **AVAILABLE** | **Category:** Transfers
**Purpose:** Search for airport transfers and ground transportation options.

**Endpoint(s):**

- `POST https://api.amadeus.com/v1/shopping/transfer-offers`

#### 💡 Voyance Usage

- **Planned Feature**: Post-MVP ground transport booking
- **Use Cases**:
  - Airport to hotel transfers
  - Hotel to attractions
  - City tours
- **Integration Priority**: Phase 2 (after flight/hotel booking live)

---

### 18. Transfer Booking

**Status:** 📊 **AVAILABLE** | **Category:** Transfers
**Purpose:** Book transfer services.

**Endpoint(s):**

- `POST https://api.amadeus.com/v1/booking/transfer-orders`

#### 💡 Voyance Usage

- **Planned**: Same timeline as Transfer Search
- **Requires**: Booking API tier

---

### 19. Transfer Management

**Status:** 📊 **AVAILABLE** | **Category:** Transfers
**Purpose:** View, modify, or cancel transfer bookings.

**Endpoint(s):**

- `GET/DELETE https://api.amadeus.com/v1/booking/transfer-orders/{id}`

---

## 🎯 Tours & Activities APIs

### 20. Tours and Activities

**Status:** ⚙️ **AVAILABLE** (Alternative via Viator) | **Category:** Activities
**Purpose:** Search and book tours, activities, and experiences at destination.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/shopping/activities`
- `GET https://api.amadeus.com/v1/shopping/activities/{id}`
- `GET https://api.amadeus.com/v1/shopping/activities/by-square`

#### 💡 Voyance Usage

- **Current Status**: Using alternative providers (Google Places, Viator)
- **Implementation**: `venueAPI.ts` for activity search
- **Future**: Could integrate Amadeus for unified booking flow
- **Why Alternative**: Amadeus activities have limited coverage
- **Integration Priority**: Evaluate coverage before switching

---

## 🧭 Travel Insights & Recommendations

### 21. Flight Inspiration Search

**Status:** 📊 **AVAILABLE** | **Category:** Inspiration
**Purpose:** Discover destinations from origin within budget. "Where can I go for $X?"

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/shopping/flight-destinations`

#### 💡 Voyance Usage

- **Potential Feature**: "Surprise Me" destination selector
- **Use Case**: Budget-based destination discovery
- **User Journey**: "I have $2000 and 5 days, where should I go?"
- **Integration Priority**: High interest for "Voyance Surprise" feature

---

### 22. Flight Most Booked Destinations

**Status:** 📊 **AVAILABLE** | **Category:** Insights
**Purpose:** Trending destinations and popular routes from specific origin.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/travel/analytics/air-traffic/booked`

#### 💡 Voyance Usage

- **Potential Feature**: "Trending Now" destination carousel
- **Display**: Homepage or destination explorer
- **Data**: Show monthly/seasonal trends
- **Integration Priority**: Marketing/discovery feature

---

### 23. Trip Purpose Prediction

**Status:** 📊 **AVAILABLE** | **Category:** AI/ML
**Purpose:** Predict if trip is business or leisure based on search patterns.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/travel/predictions/trip-purpose`

#### 💡 Voyance Usage

- **Potential Feature**: Personalized recommendations
- **Use Case**: Adjust hotel/activity suggestions based on trip purpose
- **Integration**: Combine with Voyance Travel DNA
- **Priority**: AI enhancement, Phase 3

---

### 24. Safe Place (Amadeus COVID-19)

**Status:** 🗑️ **DEPRECATED** | **Category:** Health/Safety
**Purpose:** COVID-19 safety ratings for locations.

**Note**: Feature deprecated post-pandemic, not applicable.

---

## 📍 Location & Reference Data APIs

### 25. City and Airport Search (Consolidated)

**Status:** ✅ **ACTIVE** | **Category:** Reference
**Purpose:** Consolidated reference data for cities, airports, and points of interest.

**Covered Above**: See [Airport & City Search](#5-airport--city-search)

---

### 26. Airline Routes

**Status:** ⚙️ **AVAILABLE** | **Category:** Reference
**Purpose:** Get direct and connected routes for specific airline.

**Endpoint(s):**

- `GET https://api.amadeus.com/v1/airline/destinations`

#### 💡 Voyance Usage

- **Use Case**: Filter flights by preferred airline
- **Feature**: "Show me only Delta flights"
- **Integration Priority**: Low (not user-requested)

---

## 💳 Booking & Order Management

### 27. Flight Order Management

**Covered Above**: See [Flight Order Management](#4-flight-order-management)

---

### 28. Hotel Booking Management

**Covered Above**: See [Hotel Booking](#13-hotel-booking)

---

## 🧾 Summary Classification Table

| API Name                 | Category    | Status       | Used in Voyance | Feature Dependency      | Rate Limit | Tier Required | Integration Priority | Notes                      |
| ------------------------ | ----------- | ------------ | --------------- | ----------------------- | ---------- | ------------- | -------------------- | -------------------------- |
| Flight Offers Search     | Flights     | ✅ Active    | Yes             | Flight Planner Search   | 200/min    | Production    | ⭐⭐⭐ CRITICAL      | Core search, 15min cache   |
| Flight Offers Price      | Flights     | ⚙️ Available | Partial         | Price Lock (Hold)       | 200/min    | Production    | ⭐⭐⭐ CRITICAL      | Used via /hold endpoint    |
| Flight Create Orders     | Flights     | 🕓 Planned   | No              | Post-Payment Booking    | 200/min    | Booking API   | ⭐⭐ HIGH            | Requires paid tier         |
| Flight Order Management  | Flights     | 🕓 Planned   | No              | Trip Dashboard          | 200/min    | Booking API   | ⭐ MEDIUM            | Post-booking features      |
| Airport & City Search    | Reference   | ✅ Active    | Yes             | Airport Autocomplete    | 200/min    | Standard      | ⭐⭐⭐ CRITICAL      | With fallback data         |
| Airline Code Lookup      | Reference   | ✅ Active    | Yes (Static)    | Airline Logos           | N/A        | N/A           | ⭐⭐ HIGH            | Static mapping file        |
| Hotel Search             | Hotels      | ✅ Active    | Yes             | Hotel Planner Search    | 200/min    | Production    | ⭐⭐⭐ CRITICAL      | Core search, premium cards |
| Hotel Booking            | Hotels      | 🕓 Planned   | No              | Post-Payment Booking    | 200/min    | Booking API   | ⭐⭐ HIGH            | Requires paid tier         |
| Hotel Ratings            | Hotels      | ⚙️ Available | Partial         | Hotel Card Details      | 200/min    | Standard      | ⭐ LOW               | Nice-to-have sentiment     |
| Hotel Name Autocomplete  | Hotels      | ⚙️ Available | No              | Specific Hotel Search   | 200/min    | Standard      | LOW                  | City search sufficient     |
| Hotel List               | Hotels      | ⚙️ Available | No              | Database Pre-population | 200/min    | Standard      | LOW                  | Optimization only          |
| Flight Cheapest Date     | Inspiration | 📊 Available | No              | Flexible Date Picker    | 200/min    | Standard      | ⭐ MEDIUM            | Price calendar feature     |
| Flight Delay Prediction  | Insights    | 📊 Available | No              | Flight Risk Indicator   | 200/min    | Paid          | LOW                  | Post-MVP enhancement       |
| Flight Status            | Tracking    | 📊 Available | No              | Live Flight Tracking    | 200/min    | Standard      | ⭐ MEDIUM            | Trip dashboard feature     |
| SeatMap Display          | Extras      | 📊 Available | No              | Seat Selection          | 200/min    | Standard      | LOW                  | Phase 3 premium            |
| Flight Price Analysis    | Insights    | 📊 Available | No              | Price Confidence Badge  | 200/min    | Paid          | LOW                  | Nice-to-have               |
| Transfer Search          | Transfers   | 📊 Available | No              | Ground Transport        | 200/min    | Standard      | ⭐ MEDIUM            | Phase 2                    |
| Transfer Booking         | Transfers   | 📊 Available | No              | Ground Transport        | 200/min    | Booking API   | ⭐ MEDIUM            | Phase 2                    |
| Transfer Management      | Transfers   | 📊 Available | No              | Booking Management      | 200/min    | Booking API   | LOW                  | Phase 2                    |
| Tours & Activities       | Activities  | ⚙️ Available | Alternative     | Activity Booking        | 200/min    | Standard      | LOW                  | Using Viator/Google        |
| Flight Inspiration       | Inspiration | 📊 Available | No              | Surprise Feature        | 200/min    | Standard      | ⭐⭐ HIGH            | "Surprise Me" flow         |
| Most Booked Destinations | Insights    | 📊 Available | No              | Trending Carousel       | 200/min    | Standard      | ⭐ MEDIUM            | Marketing feature          |
| Trip Purpose Prediction  | AI/ML       | 📊 Available | No              | Personalization         | 200/min    | Paid          | LOW                  | Phase 3 AI features        |

---

## 🏗️ Integration Architecture

### Voyance Backend Proxy Layer

```
┌─────────────────┐
│   Frontend      │
│   (React)       │
└────────┬────────┘
         │ API Calls: /api/v1/*
         ↓
┌─────────────────┐
│  Voyance        │ ← JWT Auth
│  Backend        │ ← Rate Limiting
│  (Node/Express) │ ← Caching (Redis)
│                 │ ← Request Transformation
└────────┬────────┘
         │ OAuth2 Bearer Token
         ↓
┌─────────────────┐
│   Amadeus       │
│   API           │
│  (Production)   │
└─────────────────┘
```

### Authentication Flow

1. **Backend Initialization**:

   - Store Amadeus API Key + Secret in environment variables
   - Request OAuth2 token on server startup
   - Refresh token every 25 minutes (5min buffer before 30min expiry)

2. **Request Flow**:

   - Frontend sends request to `/api/v1/flights/search`
   - Backend validates user JWT token
   - Backend adds Amadeus Bearer token to request
   - Backend calls Amadeus API
   - Backend transforms response to Voyance format
   - Backend caches result (15min TTL for searches)
   - Return response to frontend

3. **Error Handling**:
   - 401 from Amadeus → Refresh token, retry once
   - 429 Rate Limit → Return cached result or error
   - 5xx → Fallback to cache, log error for monitoring

### Caching Strategy

| Data Type     | TTL       | Storage     | Reason                      |
| ------------- | --------- | ----------- | --------------------------- |
| Flight Search | 15 min    | Redis       | Matches price lock duration |
| Hotel Search  | 15 min    | Redis       | Matches price lock duration |
| Airport Data  | 24 hours  | Redis       | Rarely changes              |
| Airline Codes | Permanent | Static File | Never changes               |
| Price Locks   | 15 min    | Redis       | Expires with lock           |
| Hotel Ratings | 7 days    | Redis       | Reviews update slowly       |

### Rate Limiting

- **Frontend**: No direct rate limiting (all via backend)
- **Backend → Amadeus**:
  - 200 requests/minute (production tier)
  - Implement token bucket algorithm
  - Queue requests when approaching limit
  - Return cached results when rate limited
  - Monitor via backend metrics dashboard

---

## 📈 Integration Roadmap

### Phase 1: CURRENT (Oct 2025)

- ✅ Flight Search
- ✅ Hotel Search
- ✅ Airport Autocomplete
- ✅ Price Lock (Hold) for Flights & Hotels
- ✅ Airline Logo Display (static)

### Phase 2: POST-MVP (Nov 2025)

- 🕓 Flight Booking (Create Orders)
- 🕓 Hotel Booking
- 🕓 Stripe → Amadeus Booking Flow
- 🕓 Transfer Search & Booking
- 🕓 Flight Inspiration ("Surprise Me")

### Phase 3: ENHANCEMENTS (Dec 2025+)

- 📊 Flight Delay Prediction
- 📊 SeatMap Display
- 📊 Most Booked Destinations (Homepage)
- 📊 Flight Status Tracking
- 📊 Price Confidence Indicators
- 📊 Hotel Sentiment Analysis

### Phase 4: PREMIUM FEATURES (2026)

- 📊 Trip Purpose Prediction + AI Personalization
- 📊 Flexible Date Price Calendar
- 📊 Preferred Airline Filters
- 📊 Advanced Search Filters

---

## 🔧 Development Notes

### Environment Variables Required

```bash
# Amadeus API Credentials
AMADEUS_API_KEY=your_api_key_here
AMADEUS_API_SECRET=your_api_secret_here
AMADEUS_ENV=production  # or 'test'

# Amadeus Endpoints
AMADEUS_TOKEN_URL=https://api.amadeus.com/v1/security/oauth2/token
AMADEUS_API_BASE=https://api.amadeus.com

# Redis for Caching
REDIS_URL=redis://localhost:6379
REDIS_TTL_FLIGHT_SEARCH=900      # 15 minutes
REDIS_TTL_HOTEL_SEARCH=900       # 15 minutes
REDIS_TTL_AIRPORT_DATA=86400     # 24 hours
REDIS_TTL_PRICE_LOCK=900         # 15 minutes

# Rate Limiting
AMADEUS_RATE_LIMIT_RPM=200       # Requests per minute
```

### Testing

```bash
# Use Amadeus Test Environment
AMADEUS_ENV=test
AMADEUS_API_BASE=https://test.api.amadeus.com

# Test Credentials (from Amadeus dashboard)
AMADEUS_TEST_API_KEY=test_key
AMADEUS_TEST_API_SECRET=test_secret

# Mock Data (for frontend development without API calls)
USE_MOCK_FLIGHT_API=true
USE_MOCK_HOTEL_API=true
```

### Monitoring

- **Log all Amadeus API calls** with response time and status
- **Track rate limit usage** (requests per minute)
- **Monitor cache hit rate** (should be >70% for searches)
- **Alert on 429 errors** (rate limit breached)
- **Alert on 5xx errors** (Amadeus downtime)

---

## 📚 External Resources

- **Amadeus Developer Portal**: https://developers.amadeus.com/
- **API Documentation**: https://developers.amadeus.com/self-service/apis-docs
- **Postman Collection**: Available in Amadeus dashboard
- **SDKs**: Node.js SDK available (`npm install amadeus`)
- **Support**: developers@amadeus.com

---

## 🚨 Critical Integration Rules

1. **Never expose Amadeus API credentials to frontend**
2. **Always proxy through Voyance backend**
3. **Implement idempotency keys for booking operations**
4. **Cache search results for 15 minutes to reduce API calls**
5. **Handle rate limits gracefully with cached fallbacks**
6. **Refresh OAuth tokens 5 minutes before expiry**
7. **Log all booking operations for audit trail**
8. **Test booking flow in Amadeus test environment before production**
9. **Implement circuit breaker for Amadeus downtime**
10. **Never retry booking operations (risk of duplicate bookings)**

---

**Document Version**: 1.0.0
**Last Review**: October 21, 2025
**Next Review**: December 1, 2025
**Owner**: Voyance Engineering Team
**Status**: ✅ ACTIVE - CANONICAL REFERENCE
