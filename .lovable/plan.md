

# Fix: Duplicate Trip Creation Race Condition (1,000+ trips bug)

## Executive Summary

A critical race condition allows hundreds or thousands of duplicate trips to be created within seconds when a user rapidly clicks action buttons. This has happened twice, creating ~1,400 trips for a single user.

---

## Investigation Findings

### Evidence from Database

| Time Window | Trips Created | Destination |
|-------------|---------------|-------------|
| 03:06:24.772 → 03:06:25.069 (300ms) | 20+ trips | Marrakech |
| 03:06:00 → 03:06:59 (1 minute) | 594 trips | Marrakech |
| 03:10:00 → 03:10:59 (1 minute) | 786 trips | Marrakech |

**Total: 1,416 trips for user `abbaca64-3bb9-471f-a05e-d01de24bc05c`**

### Root Cause Analysis

The `saveTrip()` function in `TripPlannerContext.tsx` has **no protection against concurrent calls**:

```text
┌─────────────────────────────────────────────────────────────────────┐
│  CURRENT FLOW (BROKEN)                                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Click 1 ─────►  saveTrip()                                          │
│                    │ reads state.tripId = null                       │
│                    │ starts INSERT (async)                           │
│                    ▼                                                 │
│  Click 2 ─────►  saveTrip()                                          │
│                    │ reads state.tripId = null (INSERT not done yet) │
│                    │ starts ANOTHER INSERT                           │
│                    ▼                                                 │
│  Click 3 ─────►  saveTrip()                                          │
│                    │ reads state.tripId = null (both INSERTs pending)│
│                    │ starts YET ANOTHER INSERT                       │
│                    ▼                                                 │
│              ... 1000 more clicks ...                                │
│                                                                      │
│  Result: 1000+ duplicate trips created                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Vulnerable Code Paths

All these pages call `saveTrip()` from TripPlannerContext without guards:

| File | Function | Problem |
|------|----------|---------|
| `PlannerHotelEnhanced.tsx` | `handleContinue`, `handleSkipHotel`, `handleSelectHotel` | No `isSaving` guard |
| `PlannerFlightEnhanced.tsx` | `handleContinue` | No `isSaving` guard |
| `PlannerItinerary.tsx` | `initTrip` (useEffect) | Async effect without ref guard |
| `PlannerBooking.tsx` | Checkout handlers | Multiple calls to `saveTrip()` |
| `MultiCityPlanner.tsx` | Form submission | No guard |

---

## Solution: Add Ref-Based Guard in TripPlannerContext

### Why Ref-Based Guard (Not State)?

React state updates are **asynchronous**. If we use `isSaving` state:
- Click 1: Sets `isSaving = true` (async, not immediate)
- Click 2: Reads `isSaving = false` (state not updated yet) → **Bug persists**

A `useRef` updates **synchronously**, providing immediate blocking.

### Implementation Details

**File: `src/contexts/TripPlannerContext.tsx`**

Add a ref-based guard at the top of the provider:

```typescript
// Add import
import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';

// Inside TripPlannerProvider component, add:
const savingInProgressRef = useRef(false);
```

Update the `saveTrip` function:

```typescript
const saveTrip = async (): Promise<string | null> => {
  // CRITICAL: Prevent race condition with synchronous ref check
  if (savingInProgressRef.current) {
    console.warn('[TripPlanner] Save already in progress, returning existing tripId');
    return state.tripId;
  }
  savingInProgressRef.current = true;

  setState(prev => ({ ...prev, isLoading: true, error: null }));

  try {
    // ... existing trip creation logic ...
    
    // If trip already exists, just update it
    let tripId = state.tripId;
    
    // Before INSERT, double-check database for existing trip
    if (!tripId && user) {
      const { data: existingTrip } = await supabase
        .from('trips')
        .select('id')
        .eq('user_id', user.id)
        .eq('destination', state.basics.destination || 'Unknown')
        .eq('start_date', state.basics.startDate || new Date().toISOString().split('T')[0])
        .eq('end_date', state.basics.endDate || new Date().toISOString().split('T')[0])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (existingTrip?.id) {
        console.log('[TripPlanner] Found existing trip, using that instead:', existingTrip.id);
        tripId = existingTrip.id;
        // Set in state so future calls UPDATE instead of INSERT
        setState(prev => ({ ...prev, tripId }));
      }
    }

    // ... rest of existing INSERT/UPDATE logic ...
    
  } finally {
    savingInProgressRef.current = false; // Always release the lock
  }
};
```

### Additional Safeguards

**1. Button Disabling on UI Components**

Update pages that call `saveTrip()` to use `state.isLoading` for button disabling:

```typescript
// PlannerHotelEnhanced.tsx
<Button 
  onClick={handleContinue}
  disabled={plannerState.isLoading}  // ADD THIS
>
  Continue
</Button>
```

**2. Cleanup: Delete Duplicate Trips**

Run this SQL query to clean up existing duplicates (keeps the first trip created):

```sql
-- Identify duplicates (same user, destination, dates)
WITH duplicates AS (
  SELECT id, user_id, destination, start_date, end_date,
         ROW_NUMBER() OVER (
           PARTITION BY user_id, destination, start_date, end_date 
           ORDER BY created_at ASC
         ) as rn
  FROM trips
  WHERE user_id = 'abbaca64-3bb9-471f-a05e-d01de24bc05c'
)
DELETE FROM trips 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/contexts/TripPlannerContext.tsx` | Add ref-based guard, database-first validation before INSERT |
| `src/pages/planner/PlannerHotelEnhanced.tsx` | Disable buttons when `plannerState.isLoading` |
| `src/pages/planner/PlannerFlightEnhanced.tsx` | Disable buttons when `plannerState.isLoading` |
| `src/pages/planner/PlannerBooking.tsx` | Disable checkout when `plannerState.isLoading` |

---

## Expected Outcome After Fix

```text
┌─────────────────────────────────────────────────────────────────────┐
│  FIXED FLOW                                                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Click 1 ─────►  saveTrip()                                          │
│                    │ savingInProgressRef.current = true (SYNC)       │
│                    │ starts INSERT (async)                           │
│                    ▼                                                 │
│  Click 2 ─────►  saveTrip()                                          │
│                    │ savingInProgressRef.current = true? YES         │
│                    │ EARLY RETURN with existing tripId               │
│                    ▼                                                 │
│  Click 3 ─────►  saveTrip()                                          │
│                    │ EARLY RETURN                                    │
│                    ▼                                                 │
│                                                                      │
│  INSERT completes → savingInProgressRef.current = false              │
│  Result: Only 1 trip created                                         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

