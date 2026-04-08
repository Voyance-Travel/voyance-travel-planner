

## Remove Duplicate Hotel Returns

### The Problem
Two consecutive "Return to Your Hotel" activities appear on the same day — one categorized as Activity/Wellness, the other as Stay. Only one is needed.

### The Fix (2 files)

#### 1. `action-generate-trip-day.ts` — After timing overlap fixer (~line 1212), before stage logger flush

Insert a dedup block that walks activities backward. If two consecutive activities both match hotel-return titles (`return to your hotel`, `return to hotel`, `back to your hotel`), remove the non-Stay version. If neither is Stay, remove the second one.

#### 2. `action-generate-day.ts` — After time overlap fixer (~line 542), before enrichment

Same dedup block on `normalizedActivities`.

### Logic

```
for i from (length - 2) down to 0:
  if activities[i] AND activities[i+1] are both hotel returns:
    keep the one with category === 'stay'
    splice out the other
    log removal
```

### Files Changed
1. `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
2. `supabase/functions/generate-itinerary/action-generate-day.ts`

