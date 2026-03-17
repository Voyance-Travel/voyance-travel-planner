

## Fix: Session State Persistence Across Trips

### Root Cause

When a user navigates to `/start` to create a new trip, three things bleed through from the previous session:

1. **TripPlannerContext state** — `plannerState.basics` (destination, dates, travelers, etc.) persists in React context across navigations. `Start.tsx` initializes its local state from this context (lines 2145-2161). A `resetTrip()` function exists but is **never called** when `/start` mounts.

2. **Chat messages** — `TripChatPlanner` persists messages to `sessionStorage` under `voyance_chat_messages` (line 132). They're only cleared on successful trip creation (lines 3120, 3130), not when starting a new trip.

3. **Draft storage** — `voyance_start_draft` in sessionStorage can carry Step 2 data (flights/hotels) from a quiz redirect flow and isn't cleared on fresh `/start` visits.

Flight and hotel `useState` defaults are empty strings (lines 2179-2213), so those don't leak. The main contamination is **Step 1 fields** (destination, dates, travelers, budget) via the context, and **chat history**.

### The Fix

**Add a reset effect at the top of the `Start` component** that fires on mount when there's no `fromQuiz` or `destination` query param (i.e., it's a fresh new-trip navigation):

**File: `src/pages/Start.tsx`**

- Destructure `resetTrip` from `useTripPlanner()` alongside `state` and `setBasics`
- Add a mount effect (~line 2140, after popstate listener):
  ```typescript
  // Reset stale session state when starting a fresh trip
  useEffect(() => {
    const isFromQuiz = searchParams.get('fromQuiz') === 'true';
    const hasDestination = !!searchParams.get('destination');
    if (!isFromQuiz && !hasDestination) {
      resetTrip();
      sessionStorage.removeItem('voyance_chat_messages');
      sessionStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  }, []); // mount-only
  ```
- This preserves pre-filled data when arriving from quiz or destination card clicks, but clears everything for "Build My Trip" navigations.

**Also reset the local Step 1 state** that was already initialized from the (now-stale) context. Since `useState` initializers only run once, the reset effect needs to explicitly clear them:
  ```typescript
  if (!isFromQuiz && !hasDestination) {
    resetTrip();
    setDestinationSelection({ display: '', cityName: '', airportCodes: undefined });
    setStartDate(undefined);
    setEndDate(undefined);
    setTravelers(2);
    setBudgetAmount(undefined);
    sessionStorage.removeItem('voyance_chat_messages');
    sessionStorage.removeItem(DRAFT_STORAGE_KEY);
  }
  ```

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/pages/Start.tsx` | Destructure `resetTrip`; add mount effect to clear context, local state, and sessionStorage for fresh trips |

Single file, ~15 lines added.

