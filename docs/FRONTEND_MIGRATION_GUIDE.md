# Frontend Migration Guide - Trip Planner Updates

## 🚨 Critical Fixes Required

This guide provides exact code changes needed for the frontend to work with the new trip planner backend endpoints deployed on 2025-10-11.

## 1. Fix Trip Creation (CRITICAL - Blocking Everything)

### Problem
Trip creation is failing because the frontend doesn't include the `country` field in destinations.

### Solution
Update the trip creation in `/pages/planner/index.tsx` or wherever `createTrip` is called:

```typescript
// ❌ OLD CODE - This causes validation errors
const createTrip = async () => {
  const response = await fetch('/api/v1/planner/trips', {
    method: 'POST',
    body: JSON.stringify({
      destinations: [{
        id: selectedDestination.id,
        city: selectedDestination.city
        // Missing country!
      }],
      // ... other fields
    })
  });
};

// ✅ NEW CODE - Include country from search results
const createTrip = async () => {
  const response = await fetch('/api/v1/planner/trips', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      originCity: originCity, // e.g., "Atlanta, GA"
      destinations: [{
        id: selectedDestination.id,
        city: selectedDestination.city,
        country: selectedDestination.country // ⚠️ REQUIRED!
      }],
      startDate: startDate,
      endDate: endDate,
      tripType: tripType || "round_trip",
      travelers: travelers,
      priority: "flights_first",
      budgetTier: mapBudgetTier(budgetSelection), // See mapping below
      styles: selectedStyles || []
    })
  });

  const { tripId } = await response.json();
  // Navigate to next page with tripId
  router.push(`/planner/budget?tripId=${tripId}`);
};
```

## 2. Fix Budget Tier Mapping

### Problem
Frontend uses different budget tier values than backend expects.

### Solution
Add this mapping function to your utilities:

```typescript
// utils/budgetMapping.ts
export const mapBudgetTier = (frontendValue: string): string => {
  const mapping = {
    'budget': 'safe',
    'standard': 'stretch',
    'premium': 'splurge'
  };
  return mapping[frontendValue] || 'stretch'; // Default to stretch
};

// Reverse mapping for displaying
export const mapBudgetTierDisplay = (backendValue: string): string => {
  const mapping = {
    'safe': 'budget',
    'stretch': 'standard',
    'splurge': 'premium'
  };
  return mapping[backendValue] || 'standard';
};
```

## 3. Update Flight API Service

### Problem
Using old generic flight endpoints instead of new planner-specific ones with price lock support.

### Solution
Update `/services/flightAPI.ts`:

```typescript
// ❌ OLD CODE
export const searchFlights = async (params) => {
  return fetch('/api/v1/flights/search', {
    method: 'POST',
    body: JSON.stringify(params)
  });
};

// ✅ NEW CODE
export const plannerFlightAPI = {
  // Search flights with trip context
  search: async (params: {
    tripId: string;
    origin: string;
    destination: string;
    dates: { out: string; back?: string };
    cabin: string;
    passengers: number;
    budgetTier: string;
  }) => {
    const response = await fetch('/api/v1/flights/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(params)
    });
    return response.json();
  },

  // Create price lock (15 minutes)
  hold: async (params: {
    tripId: string;
    optionId: string;
    total: number;
    currency: string;
  }) => {
    const response = await fetch('/api/v1/flights/hold', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(params)
    });
    return response.json();
  },

  // Check lock status
  checkLockStatus: async (lockId: string) => {
    const response = await fetch(`/api/v1/flights/hold/${lockId}/status`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    return response.json();
  }
};
```

## 4. Update Hotel API Service

### Problem
Using `destinationId` instead of `cityCode`, missing price lock functionality.

### Solution
Update `/services/hotelAPI.ts`:

```typescript
// ❌ OLD CODE
export const searchHotels = async (params) => {
  return fetch('/api/v1/hotels/search', {
    method: 'POST',
    body: JSON.stringify({
      destinationId: params.destinationId, // Wrong parameter!
      // ...
    })
  });
};

// ✅ NEW CODE
export const plannerHotelAPI = {
  search: async (params: {
    tripId: string;
    cityCode: string; // Changed from destinationId!
    dates: { in: string; out: string };
    rooms: number;
    guests: number;
    budgetTier: string;
  }) => {
    const response = await fetch('/api/v1/hotels/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(params)
    });
    return response.json();
  },

  // Create price lock (15 minutes)
  hold: async (params: {
    tripId: string;
    optionId: string;
    total: number;
    currency: string;
  }) => {
    const response = await fetch('/api/v1/hotels/hold', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(params)
    });
    return response.json();
  },

  // Check lock status
  checkLockStatus: async (lockId: string) => {
    const response = await fetch(`/api/v1/hotels/hold/${lockId}/status`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    return response.json();
  }
};
```

## 5. Add Checkout API Service

### Problem
Missing checkout session creation with Stripe.

### Solution
Create `/services/checkoutAPI.ts`:

```typescript
export const checkoutAPI = {
  createSession: async (tripId: string, customerId?: string) => {
    // Generate idempotency key
    const idempotencyKey = `${tripId}:${Date.now()}`;

    const response = await fetch('/api/v1/bookings/checkout-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`,
        'Idempotency-Key': idempotencyKey // ⚠️ REQUIRED!
      },
      body: JSON.stringify({
        tripId,
        customerId
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Checkout failed');
    }

    return response.json();
  },

  getSessionStatus: async (sessionId: string) => {
    const response = await fetch(`/api/v1/bookings/session/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${getAuthToken()}`
      }
    });
    return response.json();
  }
};
```

## 6. Implement Price Lock UI Component

### Problem
No UI for showing price lock countdown timers.

### Solution
Create `/components/PriceLockTimer.tsx`:

```tsx
import { useState, useEffect } from 'react';

interface PriceLockTimerProps {
  expiresAt: string;
  onExpired: () => void;
}

export const PriceLockTimer: React.FC<PriceLockTimerProps> = ({ 
  expiresAt, 
  onExpired 
}) => {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const remaining = Math.max(0, expires - now);
      
      setTimeRemaining(remaining);
      
      if (remaining === 0) {
        onExpired();
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt, onExpired]);

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getTimerColor = () => {
    const minutes = Math.floor(timeRemaining / 60000);
    if (minutes <= 2) return 'text-red-600';
    if (minutes <= 5) return 'text-orange-600';
    return 'text-green-600';
  };

  return (
    <div className={`font-semibold ${getTimerColor()}`}>
      {timeRemaining > 0 
        ? `Price locked for ${formatTime(timeRemaining)}` 
        : 'Price lock expired'
      }
    </div>
  );
};
```

## 7. Update Flight Selection Component

Update `/components/planner/steps/FlightSelection.tsx`:

```tsx
// Add price lock functionality
const FlightSelection = () => {
  const [selectedFlight, setSelectedFlight] = useState(null);
  const [priceLock, setPriceLock] = useState(null);
  const [isLockExpired, setIsLockExpired] = useState(false);

  // Search flights
  const searchFlights = async () => {
    const trip = await plannerAPI.getTrip(tripId);
    
    const results = await plannerFlightAPI.search({
      tripId: tripId,
      origin: extractIATACode(trip.originCity), // e.g., "ATL"
      destination: trip.destinations[0].iata?.[0] || "LON",
      dates: {
        out: trip.startDate,
        back: trip.tripType === 'round_trip' ? trip.endDate : undefined
      },
      cabin: "economy",
      passengers: trip.travelers,
      budgetTier: trip.budgetTier || "stretch"
    });

    setFlights(results.results);
  };

  // Hold selected flight
  const holdFlight = async (flight) => {
    try {
      const { priceLock } = await plannerFlightAPI.hold({
        tripId: tripId,
        optionId: flight.optionId,
        total: flight.price.amount,
        currency: flight.price.currency
      });

      setPriceLock(priceLock);
      setSelectedFlight(flight);
      
      // Store lock ID for status checks
      localStorage.setItem(`flight_lock_${tripId}`, priceLock.id);
      
      // Start checking lock status
      startLockStatusPolling(priceLock.id);
    } catch (error) {
      toast.error('Failed to lock price. Please try again.');
    }
  };

  // Poll lock status
  const startLockStatusPolling = (lockId: string) => {
    const interval = setInterval(async () => {
      const status = await plannerFlightAPI.checkLockStatus(lockId);
      
      if (status.status === 'EXPIRED') {
        setIsLockExpired(true);
        clearInterval(interval);
        toast.error('Price lock expired. Please search again.');
      }
    }, 30000); // Check every 30 seconds
  };

  // Continue button logic
  const canContinue = selectedFlight && priceLock && !isLockExpired;

  return (
    <div>
      {/* Flight search UI */}
      
      {priceLock && (
        <PriceLockTimer 
          expiresAt={priceLock.expiresAt}
          onExpired={() => setIsLockExpired(true)}
        />
      )}
      
      <button 
        onClick={() => router.push(`/planner/hotels?tripId=${tripId}`)}
        disabled={!canContinue}
      >
        Continue
      </button>
    </div>
  );
};
```

## 8. Update Hotel Selection Component

Update `/components/planner/steps/HotelSelection.tsx`:

```tsx
// Key change: Use cityCode instead of destinationId
const searchHotels = async () => {
  const trip = await plannerAPI.getTrip(tripId);
  
  // Extract city code
  const cityCode = trip.destinations[0].iata?.[0] || 
                   trip.destinations[0].city.substring(0, 3).toUpperCase();

  const results = await plannerHotelAPI.search({
    tripId: tripId,
    cityCode: cityCode, // ⚠️ Changed from destinationId!
    dates: {
      in: trip.startDate,
      out: trip.endDate
    },
    rooms: 1,
    guests: trip.travelers,
    budgetTier: trip.budgetTier || "stretch"
  });

  setHotels(results.results);
};
```

## Quick Testing Checklist

1. **Trip Creation**
   - [ ] Destination search includes country field
   - [ ] Trip creates successfully without validation errors

2. **Flight Search**
   - [ ] Uses new endpoint with tripId
   - [ ] Shows reason code badges
   - [ ] Price lock creates successfully
   - [ ] Timer counts down properly
   - [ ] Expired lock blocks continue

3. **Hotel Search**
   - [ ] Uses cityCode instead of destinationId
   - [ ] Optional skip works
   - [ ] Price lock works (if selected)

4. **Checkout**
   - [ ] Idempotency key included
   - [ ] Redirects to Stripe
   - [ ] Return handling works

## Common Errors & Solutions

| Error Message | Cause | Solution |
|---------------|-------|----------|
| "Invalid request body: Required" | Missing country in destination | Include country field from search results |
| "Price lock expired" | 15-minute timer expired | Force user to re-search |
| "Method 'POST' already declared" | Old endpoints removed | Use new planner endpoints |
| "destinationId not found" | Using old parameter | Change to cityCode |

## Testing Data

Use these for manual testing:
- Origins: ATL (Atlanta), JFK (New York), LAX (Los Angeles)
- Destinations: LON (London), CDG (Paris), NRT (Tokyo)
- Budget Tiers: safe, stretch, splurge
- Dates: Any future dates

## Need Help?

Check the backend SOT documents:
- [Backend Implementation](./source-of-truth/TRIP_PLANNER_BACKEND_SOT_UPDATED.md)
- [Complete Flow](./source-of-truth/TRIP_PLANNER_FLOW.md)
- [Frontend Guide](./source-of-truth/TRIP_PLANNER_FRONTEND_GUIDE.md)