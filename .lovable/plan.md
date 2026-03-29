

# Fix: Ensure 3 Meals Per Day (Except Arrival/Departure)

## Problem

When no flight data is provided, the meal policy for Day 1 defaults to `['dinner']` only (assuming a conservative afternoon arrival). This means breakfast and lunch are skipped on Day 1. The user wants all standard days — including Day 1 without flight data — to have breakfast, lunch, and dinner.

Data confirms: Vienna trip `c28f...` Day 1 has **zero dining activities** out of 7 total activities. The meal guard should catch this but the policy itself only requires dinner, so nothing is flagged as missing.

## Root Cause

In `supabase/functions/generate-itinerary/meal-policy.ts`, lines 148-150:

```typescript
// No arrival time — conservative (assume afternoon arrival)
return meal('midday_arrival', ['dinner'], usableHours,
  'Arrival time unknown — conservatively planning dinner only.');
```

When `isFirstDay` is true but no `arrivalTime24` is provided, only dinner is required. Similarly, when `isLastDay` is true with no departure time, only breakfast is required (line 184).

## Changes

### File: `supabase/functions/generate-itinerary/meal-policy.ts`

**Change 1 — Day 1 without flight data (line 148-150):**
When no arrival time is provided, treat it as a morning arrival (full day) instead of assuming afternoon:

```typescript
// No arrival time — assume full day available (morning start)
return meal('morning_arrival', ['breakfast', 'lunch', 'dinner'], usableHours,
  'Arrival time unknown — planning a full day with all 3 meals. Add flight details to adjust if arriving later.');
```

**Change 2 — Last day without departure time (line 183-185):**
When no departure time is provided, plan breakfast + lunch instead of breakfast only:

```typescript
// No departure time — plan morning + lunch before checkout
return meal('midday_departure', ['breakfast', 'lunch'], usableHours,
  'Departure time unknown — planning breakfast + lunch. Add flight details for better planning.');
```

## Why This Is Safe

- If the user later adds flight data, the meal policy will recalculate with the actual times
- The meal guard + validation pipeline still enforces whatever the policy says
- Mid-trip days (the main concern) are already correct — they get `full_exploration` with all 3 meals
- This only changes the default when flight info is missing, which should err on the side of **more meals, not fewer**

## Files to modify
- `supabase/functions/generate-itinerary/meal-policy.ts` — 2 small edits to default meal requirements

