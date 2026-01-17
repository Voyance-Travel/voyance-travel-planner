# Trip Planner Reference Guide

**Last Updated**: 2025-10-12
**Status**: ✅ CURRENT
**Purpose**: Quick reference for budget tiers, validation rules, and implementation status

> **Consolidated from**: `TRIP_PLANNER_FLOW.md`, `TRIP_PLANNER_IMPLEMENTATION_STATUS.md`, and `TRIP_PLANNER_STATEMENT_OF_WORK_FINAL.md`

---

## 🎯 Quick Reference

### Budget Tier Mapping

**Frontend → Backend Translation**:

| Frontend Value | Backend Value | Description             | Usage                 |
| -------------- | ------------- | ----------------------- | --------------------- |
| `economy`      | `safe`        | Budget-conscious travel | Economy class         |
| `standard`     | `stretch`     | Balanced comfort        | Standard class        |
| `premium`      | `stretch`     | Enhanced experience     | Also maps to stretch  |
| `luxury`       | `splurge`     | First-class experience  | Premium/Luxury travel |

**Implementation**:

```javascript
// From budgetTierMapping.ts
const BUDGET_TIER_MAP = {
  economy: 'safe',
  standard: 'stretch',
  premium: 'stretch', // Both standard and premium map to stretch
  luxury: 'splurge',
};

// Default value if undefined
export function mapBudgetTier(frontendValue) {
  if (!frontendValue) return 'stretch'; // Default
  return BUDGET_TIER_MAP[frontendValue] || 'stretch';
}
```

---

### Validation Rules

**Required Fields**:

- ✅ `originCity` - Cannot be empty
- ✅ `destinations` - Must have at least 1 destination with **city & country**
- ✅ `startDate` - Valid date in YYYY-MM-DD format
- ✅ `endDate` - Valid date in YYYY-MM-DD format
- ✅ `budgetTier` - MUST be exactly "safe", "stretch", or "splurge"

**Optional Fields with Defaults**:

- `tripType` - Defaults to "round_trip"
- `travelers` - Defaults to 1 (range: 1-12)
- `priority` - Defaults to "flights_first"
- `styles` - Defaults to empty array
- `companions` - Defaults to empty array

---

### Trip Type Options

```javascript
tripType: 'round_trip' | 'one_way' | 'multi_city';
```

---

## 📋 Implementation Status

### ✅ Completed Features

**Infrastructure** (January 2025):

- Budget tier mapping utility (`budgetTierMapping.ts`)
- IATA code mapping with 60+ cities (`iataCodeMapping.ts`)
- API configuration verified

**Components** (January 2025):

- `TripSetup` - Destination search, date selection, traveler count
- `FlightSelectionUpdated` - IATA-based search, price locks, countdown
- `HotelSelectionUpdated` - CityCode search, price locks, skip option
- `BookingReviewEnhanced` - Lock validation, checkout integration
- `PriceLockTimer` - Visual countdown (Green > 5min, Orange 2-5min, Red < 2min)
- `CheckoutButton` - Stripe session creation with idempotency

**API Services** (January 2025):

- `plannerAPI.ts` - Trip CRUD operations
- `plannerFlightAPI.ts` - Flight search, hold, status
- `plannerHotelAPI.ts` - Hotel search, hold, status
- `checkoutAPI.ts` - Stripe checkout with idempotency keys

**Critical Fixes Applied**:

- ✅ Country field properly captured and sent
- ✅ Budget tier mapping (economy/standard/premium/luxury → safe/stretch/splurge)
- ✅ TypeScript interfaces aligned
- ✅ Component integration completed
- ✅ Price lock polling (30-second intervals)

### ✅ Validated (October 2025):

- ✅ Country field flows correctly (TripSetup → planner/index → plannerAPI)
- ✅ All 9 API endpoints match backend SOT
- ✅ Budget tier mapping verified correct
- ✅ IATA code extraction working
- ✅ Idempotency keys correct format
- ✅ Price lock timers functional

### ⚠️ Pending Validation:

- ❌ Zero integration tests performed (frontend/backend never communicated)
- ❌ Price lock timing unverified in production
- ❌ Checkout flow untested end-to-end
- ❌ Error scenarios unhandled
- ⚠️ Polling interval needs backend confirmation (currently 30 seconds)

---

## 🗺️ Complete Trip Request Example

```javascript
const createTripPlan = async () => {
  const tripData = {
    // Required fields
    originCity: 'Atlanta, GA', // Or any city
    destinations: [
      {
        city: 'Paris',
        country: 'France', // ⚠️ REQUIRED - causes validation error if missing
        iata: ['CDG'], // Optional
      },
    ],
    startDate: '2025-10-20', // YYYY-MM-DD
    endDate: '2025-10-27', // YYYY-MM-DD
    budgetTier: 'stretch', // Must be: safe, stretch, or splurge

    // Optional fields
    tripType: 'round_trip', // or "one_way", "multi_city"
    travelers: 2, // 1-12
    priority: 'flights_first', // or "hotels_first"
    styles: ['adventure', 'relaxation'], // Array of strings
    companions: [], // Array of companion objects
  };

  try {
    const response = await fetch(
      'https://voyance-backend-production.up.railway.app/api/v1/planner/trips',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: JSON.stringify(tripData),
      }
    );

    if (!response.ok) {
      const error = await response.json();
      console.error('Validation error:', error);
      return;
    }

    const result = await response.json();
    // result: { tripId: "uuid-here", sessionId: "uuid-here" }

    // Navigate to flights with tripId
    window.location.href = `/trip/${result.tripId}/flights`;
  } catch (error) {
    console.error('Failed to create trip:', error);
  }
};
```

---

## ⚠️ Common Errors & Solutions

### 1. "Validation failed"

**Check**:

- All required fields are present
- `budgetTier` is exactly "safe", "stretch", or "splurge"
- Dates are in YYYY-MM-DD format
- `destinations` is an array with at least one object

### 2. "Invalid budgetTier"

```javascript
// ❌ WRONG
budgetTier: 'budget';
budgetTier: 'standard';
budgetTier: 'premium';

// ✅ CORRECT
budgetTier: 'safe'; // Budget option
budgetTier: 'stretch'; // Standard option
budgetTier: 'splurge'; // Premium option
```

### 3. "Destination country required"

```javascript
// ❌ WRONG
destinations: [{ city: 'Paris' }]; // Missing country

// ✅ CORRECT
destinations: [{ city: 'Paris', country: 'France' }];
```

### 4. "Invalid destinations"

```javascript
// ❌ WRONG
destinations: 'Paris'; // Not an array
destinations: []; // Empty array

// ✅ CORRECT
destinations: [{ city: 'Paris', country: 'France' }];
```

---

## 🔧 Implementation Details

### Price Lock Flow

1. User selects flight → API call to `/api/v1/flights/hold`
2. Backend returns `{ lockId, expiresAt, amount, status }`
3. Frontend starts `PriceLockTimer` component with `expiresAt`
4. Poll `/api/v1/flights/hold/:lockId/status` every 30 seconds
5. If `status === 'EXPIRED'`, clear selection and show message
6. On checkout, validate all locks are active before payment

### Critical Backend Endpoints

| Endpoint                              | Method | Purpose                   |
| ------------------------------------- | ------ | ------------------------- |
| `/api/v1/planner/trips`               | POST   | Create trip               |
| `/api/v1/flights/search`              | POST   | Search flights            |
| `/api/v1/flights/hold`                | POST   | Lock price (15 min)       |
| `/api/v1/flights/hold/:lockId/status` | GET    | Check lock status         |
| `/api/v1/hotels/search`               | POST   | Search hotels             |
| `/api/v1/hotels/hold`                 | POST   | Lock hotel price          |
| `/api/v1/bookings/checkout-session`   | POST   | Create Stripe session     |
| `/api/v1/bookings/session/:sessionId` | GET    | Get checkout session info |

**Base URL**: `https://voyance-backend-production.up.railway.app`

### Local Storage Usage

| Key                               | Purpose                | Cleanup                   |
| --------------------------------- | ---------------------- | ------------------------- |
| `flight_lock_${tripId}_departure` | Recovery after refresh | Manual cleanup            |
| `flight_lock_${tripId}_return`    | Recovery after refresh | Manual cleanup            |
| `hotel_lock_${tripId}`            | Recovery after refresh | Manual cleanup            |
| `checkout_session_${tripId}`      | Session recovery       | Auto-cleanup after 1 hour |

---

## 📊 Historical Context

### January 2025: Initial Implementation

- Frontend and backend teams built separately using shared SOT docs
- All components implemented and integrated
- Budget tier mapping fixed
- Country field handling corrected
- Price lock functionality complete
- **Status**: 100% complete, 0% validated

### October 2025: Backend Deployment

- Backend deployed to Railway on Oct 11
- Frontend guide updated with deployed endpoints
- **Critical**: First time frontend/backend will communicate
- **Status**: Ready for validation phase

### October 2025: Code Audit

- All API contracts verified matching
- Country field data flow validated
- Budget tier mapping confirmed correct
- All 9 endpoints match backend expectations
- **Status**: Ready for integration testing

---

## 🎯 Success Metrics

1. **API Success Rate**: 95%+ successful API calls
2. **Price Lock Reliability**: Locks last full 15 minutes
3. **Checkout Completion**: Successful Stripe integration
4. **Error Handling**: Clear user feedback for all errors
5. **Data Integrity**: No data loss through flow

---

## 📞 See Also

- **Backend API Docs**: `TRIP_PLANNER_BACKEND_SOT_UPDATED.md`
- **Frontend Guide**: `TRIP_PLANNER_FRONTEND_GUIDE.md`
- **QA Plan**: `TRIP_PLANNER_QA_VALIDATION_PLAN.md`
- **Complete Index**: `TRIP_PLANNER_INDEX.md`

---

**Last Validated**: October 12, 2025
**Maintained By**: Frontend & Backend Teams
**Next Review**: After first integration test
