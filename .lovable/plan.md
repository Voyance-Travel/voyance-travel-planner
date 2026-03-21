

## Fix: Multi-City Departure Day — Duplicate Checkout & Airport References on Train Departure

### Problem (from screenshot)
On a Rome → Florence departure day (next leg = train), three issues:
1. **Duplicate checkout**: Both "Checkout & Departure Preparation" (category: activity, ~$40) AND "Hotel Checkout from" (category: accommodation, Free) appear
2. **Airport reference**: Transit gap shows "Private Transfer to Fiumicino Airport (FCO)" despite the next leg being a train to Florence
3. **Bloated day**: The minimum-activity validator requires 5 real activities for this day (treats it as a normal mid-trip day), forcing the AI to pad with extra logistics

### Root Causes

**Issue 1 & 3 — Minimum activity count too high for multi-city departure days**
Line 2740 in `index.ts`:
```typescript
const minimumRealActivities = isLastDay ? 1 : (isFirstDay ? 3 : 5);
```
A multi-city departure day (`isLastDayInCity && !isLastDay`) gets the "5 activities" requirement. The AI overstuffs the day and generates duplicate checkout activities to fill the quota.

**Issue 2 — No post-processing dedup for checkout activities**
When the AI generates both a generic "Checkout & Departure Preparation" (category: activity) and a proper "Hotel Checkout" (category: accommodation), nothing strips the duplicate.

**Issue 3 — Airport transit gap on non-flight departure**
The `transportation` field on the generated "Checkout & Departure Preparation" activity likely references the airport. The strip filter at line 2680 removes activities with "airport" in the title, but "Checkout & Departure Preparation" doesn't contain "airport" — the airport reference is in the transit gap between activities, populated from the activity's location data pointing at Fiumicino.

### Fix (1 file, ~25 lines)

**File: `supabase/functions/generate-itinerary/index.ts`**

**Change 1: Lower minimum activity count for multi-city departure days (line 2740)**

```typescript
// Before:
const minimumRealActivities = isLastDay ? 1 : (isFirstDay ? 3 : 5);

// After:
const isMultiCityDepartureDay = paramIsLastDayInCity && !isLastDay;
const minimumRealActivities = isLastDay ? 1 : (isMultiCityDepartureDay ? 1 : (isFirstDay ? 3 : 5));
```

This allows the AI to generate a light departure morning (breakfast + checkout + transfer to station) without padding.

**Change 2: Post-processing — dedup checkout activities (after line 2697)**

Add a dedup pass that keeps only one checkout activity per day on multi-city departure days. When multiple checkout-like activities exist, keep the one with category `accommodation` and strip the others:

```typescript
if (isLastDayInCity) {
  const checkoutActivities = generatedDay.activities.filter((a: any) => {
    const t = (a.title || '').toLowerCase();
    return t.includes('checkout') || t.includes('check-out') || t.includes('check out') ||
           t.includes('departure preparation');
  });
  if (checkoutActivities.length > 1) {
    // Keep the accommodation-category one; remove duplicates
    const keepId = checkoutActivities.find((a: any) => a.category === 'accommodation')?.id 
                   || checkoutActivities[0].id;
    const removeIds = new Set(checkoutActivities.filter((a: any) => a.id !== keepId).map((a: any) => a.id));
    generatedDay.activities = generatedDay.activities.filter((a: any) => !removeIds.has(a.id));
    console.log(`[Stage 2] Day ${dayNumber}: Deduped ${removeIds.size} duplicate checkout activities`);
  }
}
```

**Change 3: Extend airport stripping to include location-based airport references (line 2682)**

Broaden the non-flight departure filter to also catch activities whose location references an airport:

```typescript
generatedDay.activities = generatedDay.activities.filter((a: any) => {
  const t = (a.title || '').toLowerCase();
  const locName = (a.location?.name || '').toLowerCase();
  const desc = (a.description || '').toLowerCase();
  const isAirportRef =
    t.includes('airport') || t.includes('flight departure') || t.includes('head to airport') ||
    (a.category === 'transport' && (locName.includes('airport') || locName.includes('aeroporto') || locName.includes('aéroport')));
  // Also strip transport activities whose description mentions airport when next leg isn't flight
  const descAirportRef = a.category === 'transport' && desc.includes('airport');
  return !isAirportRef && !descAirportRef;
});
```

### Scope
1 edge function file, ~25 lines changed. No client-side or database changes.

