# Trip Planner Frontend Implementation Guide 📱

**Last Updated**: 2025-10-12 15:30 PST
**Last Validated**: 2025-10-12
**Status**: ✅ CURRENT

> **🎯 PURPOSE**: Step-by-step guide for frontend implementation of the trip planner flow with exact API calls, request/response formats, and UI requirements.

> **✅ VALIDATION NOTES** (Oct 12, 2025):
>
> - Country field data flow validated (TripSetup → planner/index → plannerAPI)
> - Budget tier mapping confirmed working (economy/standard/premium/luxury → safe/stretch/splurge)
> - All API service implementations match this guide
> - Polling interval set to 30 seconds (confirm with backend if optimal)
>
> **🔧 UX FIXES APPLIED** (Oct 12, 2025 15:30):
>
> - ✅ Travelers count now displays correctly in Trip Overview
> - ✅ Budget tier radio controls added (economy/standard/premium/luxury)
> - ✅ "Lock prices & continue" button now navigates to flights step
> - ✅ Return flights tab now functional with proper flight separation
> - ✅ Loading skeleton added for flight search (5 placeholder cards + message)
> - ✅ Flight cards enhanced with airline names, formatted cabin class, baggage info
> - ✅ Comprehensive error handling for backend errors with specific user messages

## Quick Reference - All Endpoints

```
POST   /api/v1/planner/trips              - Create trip
GET    /api/v1/planner/trips/:id          - Get trip details
PATCH  /api/v1/planner/trips/:id          - Update trip

POST   /api/v1/flights/search             - Search flights
POST   /api/v1/flights/hold               - Lock flight price
GET    /api/v1/flights/hold/:lockId/status - Check lock status

POST   /api/v1/hotels/search              - Search hotels
POST   /api/v1/hotels/hold                - Lock hotel price
GET    /api/v1/hotels/hold/:lockId/status - Check lock status

POST   /api/v1/bookings/checkout-session  - Create payment session
GET    /api/v1/bookings/session/:sessionId - Get session details
```

---

## Page 1: Trip Details 🗺️

### UI Requirements

- Destination search with typeahead
- Date pickers (no past dates)
- Origin city (pre-filled from profile)
- Trip type selector
- Traveler count

### API Calls

#### 1. Load User Profile (Page Load)

```javascript
// Get user's default origin city
const response = await fetch('/api/v1/profile', {
  headers: { Authorization: `Bearer ${token}` },
});

const profile = await response.json();
// Use profile.defaultOrigin || profile.homeAirport for origin field
```

#### 2. Destination Search (User Types - Debounced)

```javascript
// ONLY call when user has typed 2+ characters
// Implement 300-500ms debounce

const searchDestinations = async query => {
  if (query.length < 2) return;

  const response = await fetch(
    `/api/v1/destinations/search?q=${encodeURIComponent(query)}&limit=12`
  );
  const data = await response.json();

  // Display results
  // data.results = [{
  //   id: "dest_123",
  //   city: "London",
  //   country: "United Kingdom",
  //   iata: ["LHR", "LGW", "STN"]
  // }]
};
```

#### 3. Create Trip (Submit Button)

```javascript
// ⚠️ CRITICAL: Destination must include country!
const createTrip = async () => {
  const response = await fetch('/api/v1/planner/trips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      originCity: 'Atlanta, GA',
      destinations: [
        {
          id: selectedDestination.id,
          city: selectedDestination.city,
          country: selectedDestination.country, // ⚠️ REQUIRED
        },
      ],
      startDate: '2025-10-12',
      endDate: '2025-10-17',
      tripType: 'round_trip',
      travelers: 2,
      priority: 'flights_first',
      budgetTier: 'stretch', // default
      styles: [],
    }),
  });

  const { tripId } = await response.json();
  // Navigate to: /budget?tripId=${tripId}
};
```

### Common Errors

- ❌ "Invalid request body: Required" → Missing `country` in destination
- ❌ "Destination not found" → User typed custom text instead of selecting
- ❌ "Invalid date range" → End date before start date

---

## Page 2: Budget & Companions 💰

### UI Requirements

- Budget tier selector with radio buttons (economy/standard/premium/luxury) ✅ **IMPLEMENTED**
  - Economy: "Value-focused"
  - Standard: "Balanced comfort" (default)
  - Premium: "Enhanced experience"
  - Luxury: "Finest options"
- Budget amount input (numeric, $100-$50,000)
- Trip Overview panel showing:
  - Destination
  - Travel dates
  - **Travelers count** (displays correctly) ✅ **FIXED**
- Companion search and invite
- "Lock prices & continue" button ✅ **NOW NAVIGATES TO FLIGHTS**
- Skip button (optional page)

### API Calls

#### 1. Load Trip Data

```javascript
const response = await fetch(`/api/v1/planner/trips/${tripId}`, {
  headers: { Authorization: `Bearer ${token}` },
});

const trip = await response.json();
// Pre-select trip.budgetTier if exists
```

#### 2. Search Companions (Optional)

```javascript
const searchUsers = async query => {
  const response = await fetch(`/api/v1/users/search?q=${encodeURIComponent(query)}`);
  const { results } = await response.json();

  // results = [{
  //   id: "user_123",
  //   name: "John Doe",
  //   username: "johndoe",
  //   email: "john@example.com",
  //   avatar: "https://..."
  // }]
};
```

#### 3. Update Trip

```javascript
const updateTrip = async () => {
  await fetch(`/api/v1/planner/trips/${tripId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      budgetTier: 'stretch',
      companions: [{ userId: 'user_123', name: 'John Doe' }],
    }),
  });

  // Navigate to: /flights?tripId=${tripId}
};
```

---

## Page 3: Flight Search ✈️

### UI Requirements

- **Loading skeleton during search** ✅ **IMPLEMENTED**
  - Shows 5 placeholder cards with pulse animation
  - Loading message: "Searching for the best flight options..."
- Flight results with:
  - **Enhanced airline display** (e.g., "United Airlines" not "UA") ✅ **FIXED**
  - **Formatted cabin class** (e.g., "Business Class" not "business") ✅ **FIXED**
  - Airport codes and times
  - Duration, stops, and stop cities
  - **Formatted price** with commas ✅ **FIXED**
  - **Baggage info** (e.g., "2 bags included" or "Carry-on only") ✅ **FIXED**
  - Reason badges (if flight is recommended)
- **Round trip tabs**: Departure / Return ✅ **FIXED**
  - Return tab shows flight count
  - Return tab enables after departure selection
  - Return flights properly separated from departure flights
- Selection state
- Price lock countdown timer
- **Graceful error handling** ✅ **IMPLEMENTED**
  - OFFER_EXPIRED: "This flight option is no longer available..."
  - VALIDATION_ERROR: "Invalid flight selection..."
  - LOCK_OWNERSHIP: "This price is already locked..."
  - PROVIDER_ERROR: "Flight booking system temporarily unavailable..."
  - 500 errors: "Server error occurred. Our team has been notified..."

### API Calls

#### 1. Search Flights

```javascript
const searchFlights = async () => {
  // First, get trip details for context
  const tripResponse = await fetch(`/api/v1/planner/trips/${tripId}`);
  const trip = await tripResponse.json();

  // Extract IATA code from destination
  const destinationCode = trip.destinations[0].iata?.[0] || 'LON'; // fallback

  const response = await fetch('/api/v1/flights/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tripId: tripId,
      origin: 'ATL', // Or extract IATA from originCity
      destination: destinationCode,
      dates: {
        out: trip.startDate,
        back: trip.endDate, // omit for one-way
      },
      cabin: 'economy',
      passengers: trip.travelers,
      budgetTier: trip.budgetTier || 'stretch',
    }),
  });

  const data = await response.json();
  // data.results = array of flight options
};
```

#### 2. Hold Flight Selection

```javascript
const holdFlight = async flight => {
  const response = await fetch('/api/v1/flights/hold', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tripId: tripId,
      optionId: flight.optionId,
      total: flight.price.amount,
      currency: flight.price.currency,
    }),
  });

  const { priceLock } = await response.json();

  // Start countdown timer
  startCountdown(priceLock.expiresAt);

  // Store lock ID for status checks
  localStorage.setItem(`flight_lock_${tripId}`, priceLock.id);
};
```

#### 3. Check Lock Status (Timer)

```javascript
// Poll every 30 seconds
const checkLockStatus = async lockId => {
  const response = await fetch(`/api/v1/flights/hold/${lockId}/status`);
  const data = await response.json();

  if (data.status === 'EXPIRED') {
    // Show alert: "Price expired, please search again"
    // Disable continue button
  } else {
    // Update countdown: data.timeRemaining seconds
  }
};
```

### UI Components

#### Reason Code Badges

```javascript
const reasonCodeLabels = {
  lowest_price: '💰 Lowest Price',
  nonstop_convenience: '⚡ Nonstop',
  budget_match: '✓ Within Budget',
  preferred_airline: '⭐ Preferred Airline',
};

// Display as: flight.reasonCodes.map(code => reasonCodeLabels[code])
```

---

## Page 4: Hotel Search 🏨

### UI Requirements

- Optional page (skip button)
- Hotel results with amenities
- Map integration (future)
- Selection state

### API Calls

#### 1. Search Hotels

```javascript
const searchHotels = async () => {
  const tripResponse = await fetch(`/api/v1/planner/trips/${tripId}`);
  const trip = await tripResponse.json();

  // Extract city code (first IATA or city name)
  const cityCode =
    trip.destinations[0].iata?.[0] || trip.destinations[0].city.substring(0, 3).toUpperCase();

  const response = await fetch('/api/v1/hotels/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      tripId: tripId,
      cityCode: cityCode, // ⚠️ Not destinationId anymore
      dates: {
        in: trip.startDate,
        out: trip.endDate,
      },
      rooms: 1,
      guests: trip.travelers,
      budgetTier: trip.budgetTier || 'stretch',
    }),
  });

  const data = await response.json();
  // data.results = array of hotel options
};
```

#### 2. Hold Hotel (Optional)

```javascript
// Same pattern as flight hold
const holdHotel = async hotel => {
  const response = await fetch('/api/v1/hotels/hold', {
    method: 'POST',
    // ... same as flight hold
  });
};
```

---

## Page 5: Review & Checkout 💳

### UI Requirements

- Trip summary
- Price breakdown
- Lock status indicators
- Stripe payment integration

### API Calls

#### 1. Load Complete Trip State

```javascript
const loadReviewData = async () => {
  // Get trip details
  const tripResponse = await fetch(`/api/v1/planner/trips/${tripId}`);
  const trip = await tripResponse.json();

  // Check flight lock status
  const flightLockId = localStorage.getItem(`flight_lock_${tripId}`);
  if (flightLockId) {
    const lockResponse = await fetch(`/api/v1/flights/hold/${flightLockId}/status`);
    const flightLock = await lockResponse.json();
    // Display lock status/timer
  }

  // Check hotel lock if exists
  // ... similar pattern
};
```

#### 2. Create Checkout Session

```javascript
const proceedToCheckout = async () => {
  // Generate idempotency key
  const idempotencyKey = `${tripId}:${Date.now()}`;

  const response = await fetch('/api/v1/bookings/checkout-session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'Idempotency-Key': idempotencyKey, // ⚠️ REQUIRED
    },
    body: JSON.stringify({
      tripId: tripId,
      customerId: user.stripeCustomerId, // optional
    }),
  });

  const { url, sessionId } = await response.json();

  // Store session for return
  sessionStorage.setItem('checkout_session', sessionId);

  // Redirect to Stripe
  window.location.href = url;
};
```

### Stripe Return Handling

```javascript
// On /booking-confirmation?session_id=cs_test_...
const verifyPayment = async () => {
  const sessionId = new URLSearchParams(window.location.search).get('session_id');

  const response = await fetch(`/api/v1/bookings/session/${sessionId}`);
  const { session } = await response.json();

  if (session.paymentStatus === 'paid') {
    // Show success
  } else {
    // Show pending or error
  }
};
```

---

## Page 6: Booking Confirmation 🎉

### UI Requirements

- Confirmation number
- Trip summary
- Email confirmation note
- Next steps

### API Calls

#### 1. Get Final Trip State

```javascript
const loadConfirmation = async () => {
  const response = await fetch(`/api/v1/planner/trips/${tripId}`);
  const trip = await response.json();

  // Trip should now have status: 'booked'
  // Display confirmation details
};
```

---

## Error Handling Matrix ✅ **UPDATED**

| Error                        | User Message                                                                                        | Action                   |
| ---------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------ |
| `400.INVALID_INPUT`          | "Please check your information"                                                                     | Highlight invalid fields |
| `OFFER_EXPIRED`              | "This flight option is no longer available. Please select another flight."                          | Clear selection          |
| `VALIDATION_ERROR`           | "Invalid flight selection. Please try selecting again."                                             | Clear selection          |
| `LOCK_OWNERSHIP`             | "This price is already locked for another trip. Please select a different flight."                  | Clear selection          |
| `PROVIDER_ERROR`             | "Flight booking system is temporarily unavailable. Please try again in a moment."                   | Keep selection, retry    |
| `500` Server Error           | "Server error occurred. Our team has been notified. Please try again or select a different flight." | Clear selection          |
| `Price lock expired`         | "Price no longer available"                                                                         | Force re-search          |
| `No flights found`           | "Try flexible dates"                                                                                | Show date flexibility    |
| `Return flights unavailable` | "Departure/Return flights not available. Please adjust your search criteria."                       | Show filters             |
| `Stripe error`               | "Payment failed, try again"                                                                         | Return to checkout       |
| `Network error`              | "Connection issue"                                                                                  | Show retry button        |

## State Management

### URL Parameters

Always maintain `tripId` in URL for:

- Deep linking support
- Page refresh handling
- Back button navigation

### Local Storage

```javascript
flight_lock_${tripId}: lockId
hotel_lock_${tripId}: lockId
trip_search_${tripId}: searchParams (optional cache)
```

### Session Storage

```javascript
checkout_session: Stripe session ID
```

## Testing Checklist

- [ ] Destination search only fires on user input (not page load)
- [ ] Country field included in destination objects
- [ ] Price locks show countdown timer
- [ ] Expired locks block checkout
- [ ] Idempotency key sent with checkout
- [ ] Proper error messages for all failure cases
- [ ] Deep links work (e.g., /hotels?tripId=...)
- [ ] Page refresh maintains state

---

This guide represents the complete frontend implementation requirements for the trip planner flow.
