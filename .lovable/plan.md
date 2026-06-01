
## Real cause (from edge function logs)

The "launcher timed out" toast is a downstream symptom. The actual error in every Day 1 attempt is:

```
[v2] generate-trip-day fatal: TypeError: Cannot read properties of undefined (reading 'map')
    at repairDay (pipeline/repair-day.ts:1029:46)   ← deployed line offset
    at v2/generate-trip-day-v2.ts:213
```

That maps to source line 535 of `repair-day.ts`:

```ts
const lockedIds = new Set(lockedActivities.map(l => l.id));
```

The v2 entrypoint `v2/generate-trip-day-v2.ts` calls `repairDay({...})` (around line 196) **without** passing `lockedActivities`, `restaurantPool`, `usedRestaurants`, `hotelName`, `hasHotel`, etc. — so the destructure leaves those `undefined` and `.map()` throws on the very first day. Day 1 never returns → the 90s watchdog fires → the frontend shows "Generation could not start (launcher timed out)". This is the only failure mode in the logs for trip `1b5bba8d-…`.

## Fix (minimal, two surgical edits)

### 1. Make `repairDay` defensive on optional collection inputs

In `supabase/functions/generate-itinerary/pipeline/repair-day.ts` line 535, default the value at the call site so a missing caller field can never crash the whole chain:

```ts
const lockedIds = new Set((lockedActivities || []).map(l => l.id));
```

Also default `restaurantPool` and `usedRestaurants` to `[]` where they are first dereferenced (these are the other optional arrays the v2 caller does not pass yet — leaving them `undefined` will produce the same class of fatal once the lockedIds line is fixed).

This is the same defensive shape already used elsewhere in the file (e.g. `(usedRestaurants || []).map(...)` at lines 636/1239/1371/1668).

### 2. Pass the fields v2 actually has

In `supabase/functions/generate-itinerary/v2/generate-trip-day-v2.ts` at the `repairDay({...})` call (around line 197), forward the locked activities + hotel context that the v1 path already computes from `facts`/`compiled`:

```ts
repairDay({
  day: ai.day,
  dayNumber,
  destination: facts.destination.city,
  destinationCountry: facts.destination.country,
  facts: dayFacts,
  compiled,
  mealPolicy: facts.mealPolicy(dayNumber),
  lockedActivities: dayFacts?.lockedActivities ?? [],
  hotelName: facts?.hotel?.name,
  hasHotel: !!facts?.hotel,
  hotelAddress: facts?.hotel?.address,
  restaurantPool: [],
  usedRestaurants: [],
} as any)
```

(Exact field names will be confirmed against `dayFacts` / `facts` shape during implementation — the defensive default in step 1 is the actual crash-blocker; step 2 just stops sending `undefined` where empty arrays make sense.)

## Verification

1. Redeploy `generate-itinerary` immediately after the edit.
2. Curl the v2 chain entrypoint directly (`action: 'generate-trip-day'`, day 1) and confirm it returns `success: true` instead of `V2_FATAL`.
3. Re-check `generate-itinerary` logs for the exact string `Cannot read properties of undefined (reading 'map')` — must be gone.
4. Watch `[GENTRACE] phase=launcher_day_1_invoke_returned status=ok` and absence of `LAUNCHER_TIMEOUT`.

## Out of scope

- No schema changes.
- No Day 4 timing changes.
- No frontend/UI changes.
- No new pipeline stages — only the missing-input crash that has blocked every Day 1 since the v2 wiring landed.
