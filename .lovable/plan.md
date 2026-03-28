

## Enforce Consistent Transport Bookend Pattern

### The Problem

The itinerary has **two separate transport systems** that don't coordinate:

1. **AI-generated transport activities** — The AI creates activities with `category: "transport"` (e.g., "Taxi to Ginza"). These are **hidden from the card list** by `isTransportActivity()` and only surface indirectly through `TransitGapIndicator` between visible cards.

2. **`TransitGapIndicator`** — A UI component that calculates the time gap between two consecutive *visible* activities and shows a small transit row. It uses the `transportation` field embedded on the *preceding* activity (not a separate card).

The result: the AI generates "Taxi to Four Seasons" as a transport activity → the frontend hides it → no "Arrive at Four Seasons" card exists → the user sees nothing. Meanwhile "Taxi to Ginza" shows up because Ginza has a visible activity card, so the `TransitGapIndicator` fires. The pattern is inconsistent because it depends on whether the *destination* happens to be a visible activity.

### Specific failures the user described

| What happens | Why |
|---|---|
| Taxi to Four Seasons — no arrival card | AI generates transport-to-hotel but no "Freshen up at hotel" accommodation card follows it |
| Dinner → Bar with no transit | AI didn't generate a transport activity between them, and the `transportation` field on the dinner activity is empty |
| Bar → Taxi to hotel but no hotel arrival | AI generates transport-to-hotel at end of night but no "Return to hotel" accommodation card |
| Inconsistent: some transitions show transport, others don't | AI compliance is hit-or-miss on the "TRANSIT between EVERY pair" rule |

### Root Cause

The AI prompt says "include TRANSIT between every pair" and "end day with Return to Hotel," but:

1. **No post-generation validation** checks that transport activities actually exist between every pair of visible activities
2. **No validation** ensures hotel bookend cards (arrival/return) exist when transport-to-hotel is generated
3. The prompt's "HOTEL RETURN" and "RETURN TO HOTEL" instructions (lines 9080-9083) are suggestions, not enforced

### Fix: Post-Generation Transport & Bookend Validator

Add a **deterministic post-processing stage** in `generate-itinerary/index.ts` that runs after the AI returns each day. This stage:

#### 1. Ensure hotel bookends exist

**File: `supabase/functions/generate-itinerary/index.ts`** — after validation (around line 10700)

After the day is validated and duplicate-stripped, scan activities for:
- If last non-transport activity is transport-to-hotel → inject a "Return to [Hotel]" accommodation card after it (startTime = transport endTime + 5min)
- If a mid-day transport-to-hotel exists but no accommodation card follows → inject a "Freshen up at [Hotel]" card (30-60min duration)

```
for each activity where title matches "to [hotel]" or location matches hotel:
  if next visible activity is NOT accommodation:
    inject { title: "Return to [Hotel]", category: "accommodation", duration: 30 }
```

#### 2. Ensure transport exists between every pair of visible activities

**File: `supabase/functions/generate-itinerary/index.ts`** — same post-processing stage

After hotel bookends are resolved, scan consecutive visible (non-transport) activity pairs:
- If Activity A's location ≠ Activity B's location AND no transport activity exists between them → inject a stub transport activity with `method: "unknown"` so the frontend's `TransitGapIndicator` picks it up
- This ensures no "teleporting" gaps in the UI

```
for i = 0 to visibleActivities.length - 2:
  A = visibleActivities[i]
  B = visibleActivities[i + 1]
  if no transport between A and B in raw activity list:
    if A.location.name !== B.location.name:
      inject { title: "Travel to [B.name]", category: "transport", startTime: A.endTime }
```

#### 3. Ensure end-of-day hotel return exists

If the last visible activity is NOT accommodation and the traveler has a hotel:
- Inject "Return to [Hotel]" as the final card
- Preceded by a transport activity from the last venue

#### 4. Strengthen prompt language

**File: `supabase/functions/generate-itinerary/index.ts`** — REQUIRED DAY STRUCTURE section (line 9080-9083)

Change the hotel return items from suggestions to explicit requirements with validation language:

```
6. HOTEL RETURN (REQUIRED if dinner is far from hotel) — "Freshen up at [EXACT Hotel Name]" with category "accommodation", duration 30-60 min
9. RETURN TO HOTEL (REQUIRED as LAST activity) — "Return to [EXACT Hotel Name]" with category "accommodation". This is the final card of every day.
```

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` | Add post-generation bookend validator (~50 lines); strengthen prompt wording for hotel returns |

### What this does NOT change

- The `TransitGapIndicator` component — it already works correctly when data is present
- The `isTransportActivity` filter — transport activities should remain hidden (they're UI noise)
- The `ActivityRow` rendering — no UI changes needed
- The auto-route optimizer — unrelated to this issue

### Expected result

Every day follows a predictable rhythm:
```
Breakfast → 🚕 transit → Activity → 🚕 transit → Lunch → 🚕 transit → Activity → 🚕 transit → Hotel Freshen Up → 🚕 transit → Dinner → 🚕 transit → Bar → 🚕 transit → Return to Hotel
```

No orphaned transits, no missing hotel arrivals, no gaps without transport indicators.

