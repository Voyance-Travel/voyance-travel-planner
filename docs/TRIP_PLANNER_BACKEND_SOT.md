# Trip Planner Backend - Complete Source of Truth ⭐

**Last Updated**: 2025-10-11
**Last Validated**: 2025-10-12
**Status**: ✅ CURRENT

> **⚠️ AUTHORITATIVE DOCUMENT**: This is the SINGLE SOURCE OF TRUTH for the Trip Planner backend implementation. All code must match these specifications.

> **✅ VALIDATION NOTES** (Oct 12, 2025):
>
> - All 9 API endpoints verified matching frontend implementation
> - Request/response structures confirmed correct
> - Budget tier expectations aligned
> - IATA code requirements validated
> - Idempotency key format confirmed

## 🆕 UPDATE NOTICE

This document has been updated to reflect the actual implementation of new trip planner endpoints deployed on 2025-10-11.

## Table of Contents

1. [Database Schema](#database-schema)
2. [API Routes - Complete Implementation](#api-routes---complete-implementation)
3. [Data Flow & Processing](#data-flow--processing)
4. [Integration Points](#integration-points)

---

## Database Schema

### Core Tables

#### 1. `trips` Table (simplified schema: `tripPlannerOnly`)

Primary table for storing trip planning data.

| Column         | Type    | Default           | Description                                                                                             |
| -------------- | ------- | ----------------- | ------------------------------------------------------------------------------------------------------- |
| id             | uuid    | gen_random_uuid() | Primary key                                                                                             |
| user_id        | uuid    | required          | References users.id                                                                                     |
| session_id     | text    | optional          | Browser session tracking                                                                                |
| name           | text    | required          | Trip name                                                                                               |
| status         | text    | 'draft'           | 'draft', 'flight_selected', 'hotel_selected', 'payment_succeeded', 'payment_failed', 'checkout_expired' |
| trip_type      | text    | optional          | 'round_trip', 'one_way', 'multi_city'                                                                   |
| destination    | text    | optional          | City/region name                                                                                        |
| departure_city | text    | optional          | User's origin city                                                                                      |
| start_date     | date    | optional          | Trip start date                                                                                         |
| end_date       | date    | optional          | Trip end date                                                                                           |
| travelers      | integer | 1                 | Number of travelers (1-12)                                                                              |
| emotional_tags | text[]  | optional          | Trip style tags                                                                                         |
| primary_goal   | text    | optional          | Primary trip goal                                                                                       |
| traveler_type  | text    | optional          | Type of traveler                                                                                        |
| budget_range   | text    | optional          | Budget range                                                                                            |
| estimated_cost | decimal | optional          | Estimated trip cost                                                                                     |
| shared_with    | text[]  | optional          | Array of user IDs                                                                                       |

#### 2. `booking_sessions` Table

Manages price locks and hold states.

| Column              | Type        | Default  | Description                                 |
| ------------------- | ----------- | -------- | ------------------------------------------- |
| id                  | text        | required | Primary key                                 |
| trip_id             | uuid        | required | References trip.id                          |
| user_id             | uuid        | required | References users.id                         |
| active              | boolean     | true     | Is session active                           |
| price_locked_amount | numeric     | optional | Locked price                                |
| price_locked_until  | timestamp   | optional | Lock expiration                             |
| stripe_session_id   | text        | optional | Stripe checkout session                     |
| metadata            | text        | optional | JSON metadata                               |
| item_type           | varchar(20) | optional | 'flight', 'hotel', 'bundle'                 |
| currency            | varchar(3)  | optional | Currency code                               |
| lock_status         | varchar(20) | optional | 'LOCKED', 'RELEASED', 'CAPTURED', 'EXPIRED' |
| created_at          | timestamp   | now()    | Creation time                               |
| updated_at          | timestamp   | now()    | Last update                                 |

#### 3. `stripe_webhooks` Table

Tracks Stripe webhook events.

| Column     | Type      | Default  | Description       |
| ---------- | --------- | -------- | ----------------- |
| id         | text      | required | Stripe event ID   |
| type       | text      | required | Event type        |
| user_id    | uuid      | optional | Related user      |
| processed  | boolean   | false    | Processing status |
| created_at | timestamp | now()    | Event time        |

---

## API Routes - Complete Implementation

### Trip Management

#### POST /api/v1/planner/trips

Create a new trip planning session.

**Request**:

```json
{
  "originCity": "Atlanta, GA",
  "destinations": [
    {
      "id": "dest_uuid",
      "city": "London",
      "country": "United Kingdom" // ⚠️ REQUIRED - currently causing validation errors
    }
  ],
  "startDate": "2025-10-12",
  "endDate": "2025-10-17",
  "tripType": "round_trip",
  "travelers": 2,
  "priority": "flights_first",
  "budgetTier": "stretch",
  "styles": ["Adventure", "Foodie"]
}
```

**Response**:

```json
{
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "draft",
  "name": "Trip to London"
}
```

#### GET /api/v1/planner/trips/:id

Retrieve full trip context.

**Response**: Full trip object with current selections and locks

#### PATCH /api/v1/planner/trips/:id

Update trip details.

**Request**: Partial trip object
**Response**: Updated trip object

### Flight Operations

#### POST /api/v1/flights/search

Search flights using Amadeus API.

**Request**:

```json
{
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "origin": "ATL",
  "destination": "LHR",
  "dates": {
    "out": "2025-10-12",
    "back": "2025-10-17"
  },
  "cabin": "economy",
  "passengers": 2,
  "budgetTier": "stretch"
}
```

**Response**:

```json
{
  "success": true,
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "searchId": "search_123",
  "results": [
    {
      "id": "flight_123",
      "airline": "Delta",
      "flightNumber": "DL30",
      "origin": { "airport": "ATL" },
      "destination": { "airport": "LHR" },
      "departure": "2025-10-12T21:00:00",
      "arrival": "2025-10-13T09:30:00",
      "duration": 510,
      "stops": 0,
      "stopCities": [],
      "price": { "amount": 850, "currency": "USD" },
      "class": "M",
      "cabin": "economy",
      "baggageIncluded": { "carry_on": true, "pieces": 1 },
      "optionId": "opt_flight_123",
      "reasonCodes": ["budget_match", "nonstop_convenience"],
      "recommended": true
    }
  ],
  "meta": {
    "origin": "ATL",
    "destination": "LHR",
    "dates": { "out": "2025-10-12", "back": "2025-10-17" },
    "passengers": 2,
    "resultCount": 15
  }
}
```

#### POST /api/v1/flights/hold

Create flight price lock (15 minutes).

**Request**:

```json
{
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "optionId": "opt_flight_123",
  "total": 850,
  "currency": "USD"
}
```

**Response**:

```json
{
  "success": true,
  "priceLock": {
    "id": "lock_789",
    "expiresAt": "2025-10-11T15:45:00Z",
    "amount": 850,
    "currency": "USD",
    "status": "LOCKED"
  }
}
```

#### GET /api/v1/flights/hold/:lockId/status

Check flight price lock status.

**Response**:

```json
{
  "success": true,
  "lockId": "lock_789",
  "status": "LOCKED",
  "expiresAt": "2025-10-11T15:45:00Z",
  "timeRemaining": 892,
  "amount": 850,
  "currency": "USD"
}
```

### Hotel Operations

#### POST /api/v1/hotels/search

Search hotels using Amadeus API.

**Request**:

```json
{
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "cityCode": "LON", // ⚠️ Changed from destinationId
  "dates": {
    "in": "2025-10-12",
    "out": "2025-10-17"
  },
  "rooms": 1,
  "guests": 2,
  "budgetTier": "stretch"
}
```

**Response**:

```json
{
  "success": true,
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "searchId": "search_456",
  "results": [
    {
      "id": "hotel_123",
      "name": "The London Hotel",
      "location": {
        "lat": 51.5074,
        "lng": -0.1278,
        "city": "London",
        "address": "123 Piccadilly"
      },
      "stars": 4,
      "price": {
        "amount": 1200,
        "currency": "USD",
        "perNight": 240
      },
      "amenities": ["wifi", "pool", "gym"],
      "images": [...],
      "optionId": "opt_hotel_123",
      "reasonCodes": ["budget_match", "highly_rated"],
      "recommended": true,
      "pricePerNight": 240
    }
  ],
  "meta": {
    "destination": "London",
    "dates": { "in": "2025-10-12", "out": "2025-10-17" },
    "rooms": 1,
    "guests": 2,
    "nights": 5,
    "resultCount": 20
  }
}
```

#### POST /api/v1/hotels/hold

Create hotel price lock (15 minutes).

**Request**: Same format as flight hold
**Response**: Same format as flight hold

#### GET /api/v1/hotels/hold/:lockId/status

Check hotel price lock status.

**Response**: Same format as flight lock status

### Checkout Operations

#### POST /api/v1/bookings/checkout-session

Create Stripe checkout session.

**Headers**:

```
Idempotency-Key: trip_123:1736720400  // Required
```

**Request**:

```json
{
  "tripId": "550e8400-e29b-41d4-a716-446655440000",
  "customerId": "cus_stripe_123" // Optional Stripe customer ID
}
```

**Response**:

```json
{
  "success": true,
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_...",
  "expiresAt": "2025-10-11T16:15:00Z",
  "amount": 2050,
  "currency": "USD"
}
```

#### GET /api/v1/bookings/session/:sessionId

Get checkout session details.

**Response**:

```json
{
  "success": true,
  "session": {
    "id": "cs_test_...",
    "status": "open",
    "paymentStatus": "unpaid",
    "amountTotal": 2050,
    "currency": "usd",
    "customerEmail": "user@example.com",
    "expiresAt": "2025-10-11T16:15:00Z",
    "paymentIntentId": "pi_..."
  }
}
```

### Webhook Operations

#### POST /api/v1/webhooks/stripe

Handle Stripe webhook events.

**Headers**:

```
stripe-signature: t=...,v1=...  // Required for verification
```

**Handled Events**:

- `checkout.session.completed` - Mark trip as booked, capture price locks
- `checkout.session.expired` - Release price locks, clear session
- `payment_intent.succeeded` - Update payment status
- `payment_intent.payment_failed` - Handle payment failure

**Processing**:

1. Verify webhook signature
2. Check for duplicate processing
3. Update trip status
4. Capture/release price locks
5. Send confirmation email
6. Log audit event

---

## Data Flow & Processing

### Page-by-Page Implementation

#### Page 1: Trip Details → Create Trip

```
User Input → POST /api/v1/planner/trips → tripId
                    ↓
              Store in DB with status='draft'
```

#### Page 2: Budget & Companions → Update Trip

```
User Input → PATCH /api/v1/planner/trips/:id
                    ↓
              Update budgetTier, companions
```

#### Page 3: Flight Search → Search & Hold

```
Load Trip → POST /api/v1/flights/search → Display Results
                    ↓
         User Selects → POST /api/v1/flights/hold
                    ↓
              Create 15-min price lock
```

#### Page 4: Hotel Search → Search & Hold (Optional)

```
Load Trip → POST /api/v1/hotels/search → Display Results
                    ↓
         User Selects → POST /api/v1/hotels/hold
                    ↓
              Create 15-min price lock
```

#### Page 5: Review & Checkout → Payment

```
Load Trip + Locks → Display Summary
                    ↓
    User Confirms → POST /api/v1/bookings/checkout-session
                    ↓
              Redirect to Stripe → Webhook confirms
```

#### Page 6: Confirmation → Complete

```
Stripe Success → Webhook → Update trip status='booked'
                    ↓
              Send email → Show confirmation
```

### Price Lock Management

1. **Creation**: 15-minute locks on selection
2. **Validation**: Check expiry before checkout
3. **Release**: On new selection or expiry
4. **Capture**: On successful payment

### Error Handling

- **Expired Locks**: Force re-search with clear message
- **Duplicate Routes**: Removed old flight/hotel routes to avoid conflicts
- **Validation**: Frontend must send complete destination objects with country
- **Idempotency**: Required for checkout to prevent duplicates

---

## Integration Points

### External Services

1. **Amadeus API**

   - Flight search: `searchAmadeusFlights()`
   - Hotel search: `searchAmadeusHotelsByCity()`
   - Credentials: `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`

2. **Stripe**

   - Checkout: `stripe.checkout.sessions.create()`
   - Webhooks: `stripe.webhooks.constructEvent()`
   - Credentials: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`

3. **Email (SendGrid/Zoho)**
   - Confirmation: `emailService.send()`
   - Templates: Booking confirmation

### Frontend Requirements

1. **Destination Search**

   - ⚠️ NO automatic searches on page load
   - ⚠️ Must include `country` field in destination objects
   - Implement debounce (300-500ms)
   - Min 2-3 characters before search

2. **Price Locks**

   - Display countdown timer
   - Poll status every 10-30 seconds
   - Block checkout if expired

3. **Checkout**
   - Generate idempotency key: `${tripId}:${Date.now()}`
   - Handle redirect to Stripe
   - Handle return URL with session_id

### Deployment Notes

- **Railway**: `https://voyance-backend-production.up.railway.app`
- **Removed Routes**: Old `/api/v1/flights` and `/api/v1/hotels` to avoid duplicates
- **Environment**: All API keys configured in Railway

---

This document represents the complete, implemented backend for the trip planner as of 2025-10-11.
