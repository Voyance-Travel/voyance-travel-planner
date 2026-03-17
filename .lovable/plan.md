

## Fix: The Three Recurring Failures — Stall, Empty Days, Generic Meals

### Root Cause Analysis

These three bugs are a single failure chain, not independent issues:

1. **Backend generates fewer days than expected** (e.g., 5 days for a 6-day date range). This happens because the AI sometimes produces N-1 days. The backend still marks status `ready`.

2. **Frontend rejects the ready trip** because `fetchCompletedDaysFromBackend` requires `itineraryDays.length >= expectedTotalDays` (5 >= 6 = false). It retries 5 times, then falls back to `itinerary_days` table — which has 6 rows but **all with empty activities** (because `sync-itinerary-tables` fails to write activities due to non-UUID activity IDs like `"guard-breakfast-5-1773713379322"`).

3. **The stall triggers auto-resume**, which re-invokes `generate-itinerary`, which re-runs the meal guard on the existing data, which injects generic "Dinner at a restaurant" placeholders. The CORS errors from the stalled retry loop compound the problem.

**The activity sync UUID error** is the hidden root cause of empty `itinerary_days`: meal guard injects activities with IDs like `guard-breakfast-5-1773713379322`, which fail the `uuid` type constraint on `itinerary_activities.id`.

### The Fix — 4 Changes Across 3 Files

#### 1. Frontend: Trust `ready` status even with fewer days (ItineraryGenerator.tsx)

In `fetchCompletedDaysFromBackend`, change the strict day count check to accept data when it has real activities:

```
// Line 181 — current:
if (itineraryDays.length > 0 && expectedTotalDays > 0 && itineraryDays.length >= expectedTotalDays)

// New: Accept if we have days WITH activities, even if count < expected, when data exists
const daysWithActivities = itineraryDays.filter(d => Array.isArray(d.activities) && d.activities.length > 0);
if (daysWithActivities.length > 0 && (itineraryDays.length >= expectedTotalDays || daysWithActivities.length >= expectedTotalDays - 1)) {
  return itineraryDays;
}
```

Also in the fallback path (line 236), merge activities from `itinerary_data.days` into `itinerary_days` rows when they're empty, and remove the strict length guard:

```
// Line 236 — current: return [] if fallbackDays.length < expectedTotalDays
// New: Don't return empty — merge from JSON source and accept what we have
```

#### 2. Backend: Fix activity ID format for sync (action-sync-tables.ts)

The `itinerary_activities.id` column is UUID type, but meal guard and AI generation produce string IDs like `"guard-breakfast-5-..."` and `"bcn-day3-breakfast"`. The sync silently fails for every day.

Generate proper UUIDs when the activity ID isn't already a valid UUID:

```typescript
// In activityRows mapping (line 114-115):
const rawId = a.id || '';
const isValidUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rawId);
const id = isValidUuid ? rawId : crypto.randomUUID();
```

#### 3. Backend: Meal guard should use UUID-safe IDs (day-validation.ts)

The meal guard generates IDs like `guard-breakfast-5-1773713379322` which break the UUID column downstream. Change to generate proper UUIDs:

```typescript
// Line 805 — current:
id: `guard-${mealType}-${dayNumber}-${Date.now()}`,

// New:
id: crypto.randomUUID(),
```

Also apply the same fix in the client-side meal guard (`src/utils/mealGuard.ts` line 140):
```typescript
// Current:
id: `guard-${mealType}-${dayNumber}-${Date.now()}`,
// New:
id: crypto.randomUUID(),
```

#### 4. Frontend: Merge JSON activities into empty itinerary_days fallback (ItineraryGenerator.tsx)

When the fallback path reads from `itinerary_days` and gets empty activities, cross-reference against the JSON blob:

```typescript
// After building fallbackDays from dayRows (line 203-234):
// If a fallback day has 0 activities, try to pull from the trip's itinerary_data.days
if (tripData?.itinerary_data) {
  const jsonDays = (tripData.itinerary_data as any).days || [];
  for (const fb of fallbackDays) {
    if (fb.activities.length === 0) {
      const match = jsonDays.find((jd: any) => jd.dayNumber === fb.dayNumber);
      if (match?.activities?.length > 0) {
        fb.activities = match.activities;
      }
    }
  }
}
```

### Why This Fixes All Three Issues

| Problem | Root Cause | Fix |
|---------|-----------|-----|
| **Stall on "ready" page** | Frontend rejects 5/6 days | Accept N-1 days when they have real activities |
| **Empty days after refresh** | `itinerary_days` has no activities because sync fails on non-UUID IDs | Generate UUID IDs in meal guard + validate IDs in sync |
| **Generic "Dinner at restaurant"** | Stall triggers re-generation, which re-runs meal guard on empty days | Eliminating the stall eliminates spurious re-runs; UUID IDs fix sync so activities persist |

### Files to Change

| # | File | Change |
|---|------|--------|
| 1 | `src/components/itinerary/ItineraryGenerator.tsx` | Relax day count check; merge JSON into empty fallback rows |
| 2 | `supabase/functions/generate-itinerary/action-sync-tables.ts` | Validate/replace non-UUID activity IDs with `crypto.randomUUID()` |
| 3 | `supabase/functions/generate-itinerary/day-validation.ts` | Meal guard: use `crypto.randomUUID()` for injected activity IDs |
| 4 | `src/utils/mealGuard.ts` | Client meal guard: use `crypto.randomUUID()` for injected IDs |

