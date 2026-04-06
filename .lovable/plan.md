

## Fix Restaurant Repetition Regression (Pino Day 3 + Day 4)

### Root Cause Analysis

I traced the full dedup pipeline. There are **two** dedup layers, and both likely failed for different reasons:

**Layer 1 — Per-day dedup** (line 883): Runs when Day 4 is generated. Checks `usedRestaurants` from metadata. If "Pino" was correctly extracted from Day 3 and stored, this should catch it. If replacement from `restaurantPool` fails (pool exhausted), it keeps the duplicate because lunch is a primary meal (`Meal > Uniqueness` rule).

**Layer 2 — Trip-wide failsafe** (line 1357): Runs after all days are assembled into `updatedDays`. Tries to replace duplicates using `FAILSAFE_FALLBACKS`. The city key lookup at line 1435-1436 does `tripDestination.includes('lisbon')` — but if the destination is stored as "**Lisboa**" (Portuguese), it won't match `"lisbon"`, so **no fallback list is found**. The duplicate is then kept because lunch is a primary meal.

**Most likely root cause**: The city key matching in the failsafe is too strict — `"lisboa".includes("lisbon")` is `false`. Additionally, logging is insufficient to confirm which layer is failing and why.

### Plan (1 file)

**File: `supabase/functions/generate-itinerary/action-generate-trip-day.ts`**

**Change 1: Fix city key matching in failsafe** (around line 1434-1436)

Add city aliases so "Lisboa" matches "lisbon", and similar for Porto/Oporto, etc.:

```typescript
const CITY_ALIASES: Record<string, string[]> = {
  'lisbon': ['lisboa', 'lisbonne', 'lissabon'],
  'porto': ['oporto'],
  'barcelona': ['barcelone', 'barcellona'],
};

const tripDestination = (updatedDays[0]?.destination || updatedDays[0]?.city || destination || '').toLowerCase().trim();
const cityKey = Object.keys(FAILSAFE_FALLBACKS).find(k => {
  if (tripDestination.includes(k)) return true;
  const aliases = CITY_ALIASES[k] || [];
  return aliases.some(a => tripDestination.includes(a));
}) || '';
```

**Change 2: Add diagnostic logging to failsafe** (around line 1438)

Log the resolved `cityKey` and `tripDestination` so we can confirm the lookup is working:

```typescript
console.log(`=== CROSS-DAY RESTAURANT DEDUP FAILSAFE ===`);
console.log(`tripDestination: "${tripDestination}", resolved cityKey: "${cityKey}"`);
```

**Change 3: Apply same city alias fix to per-day dedup pool lookup** (around line 355-370)

The `dayCity` lookup for restaurant pool also likely suffers from the same alias issue. Apply the same `CITY_ALIASES` map when resolving `restaurantPoolByCity[dayCity]`.

**Change 4: Add "Pino" to the used-restaurants logging** (no code change needed — existing debug logging at line 344-353 already covers this; just verify it's working)

### Files to edit
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — fix city alias matching in failsafe + pool lookup, add diagnostic logging

### Verification
Generate a 4-day Lisbon trip. Confirm:
- No restaurant appears on more than one day
- Console shows `CROSS-DAY RESTAURANT DEDUP FAILSAFE` with correct `cityKey: "lisbon"` even when destination is "Lisboa"
- If any duplicates found, `DEDUP REPLACEMENT` logs show successful replacement

