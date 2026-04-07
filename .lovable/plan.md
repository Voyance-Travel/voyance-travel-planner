

## Create Universal Quality Pass Orchestrator

### Goal
Consolidate 9 scattered quality enforcement steps into one reusable `universalQualityPass()` function, then wire it into both generation paths.

### New File: `supabase/functions/generate-itinerary/universal-quality-pass.ts`

Creates and exports `universalQualityPass(activities, options)` that runs these steps in order:

| Step | Function | Source |
|------|----------|--------|
| 1. Arrival timing | `enforceArrivalTiming()` | Already in `flight-hotel-context.ts` |
| 2. Departure timing | `enforceDepartureTiming()` | Already in `flight-hotel-context.ts` |
| 3. Fix placeholder meals | `fixPlaceholdersForDay()` | Move/re-export from `action-generate-day.ts` |
| 4. Free venue pricing | `checkAndApplyFreeVenue()` | Already in `sanitization.ts` |
| 5. Market dining cap | `enforceMarketDiningCap()` | Already in `sanitization.ts` |
| 6. Universal price caps | `enforceBarNightcapPriceCap()` + `enforceCasualVenuePriceCap()` + `enforceVenueTypePriceCap()` + `enforceTicketedAttractionPricing()` + `enforceMichelinPriceFloor()` | Already in `sanitization.ts` |
| 7. Cross-day venue dedup | New inline logic using fuzzy `venueNamesMatch()` | Currently inline in `action-generate-trip-day.ts` lines 1020-1057 |
| 8. Hotel return injection | New logic — append "Return to Your Hotel" if last activity isn't STAY (skip departure day) | Currently not implemented |
| 9. Update used venues set | New inline — adds all venue names to `usedVenueNames` for next day | Currently inline |

**Options interface:**
```typescript
interface UniversalQualityOptions {
  city: string;
  country: string;
  tripType: string;
  dayIndex: number;        // 0-based
  totalDays: number;
  usedVenueNames: Set<string>;
  arrivalTime?: string;    // HH:MM, day 0 only
  departureTime?: string;  // HH:MM, last day only
  dayTitle?: string;
  budgetTier?: string;
  apiKey?: string;
  lockedActivities?: any[];
}
```

### Extract `fixPlaceholdersForDay` to Shared Module

`fixPlaceholdersForDay()` currently lives as a private function inside `action-generate-day.ts` (line 270). It needs to be importable by the new orchestrator.

**File: `supabase/functions/generate-itinerary/fix-placeholders.ts`** — Move the function here and export it. Update `action-generate-day.ts` to import from the new file.

### Wire Into `action-generate-trip-day.ts`

Replace the scattered quality steps (cross-day dedup at lines 1020-1057, pricing guards at lines 1764-1776) with a single call to `universalQualityPass()` per day during the generation loop. The trip-level Michelin count check (lines 1778-1803) stays as-is since it's a trip-wide concern.

### Wire Into `action-generate-day.ts`

Replace the scattered steps (placeholder fix at line 765, arrival/departure at lines 781-791, final pricing guard at lines 1568-1574) with a single `universalQualityPass()` call after normalization.

### Files to Edit

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/universal-quality-pass.ts` | **New** — orchestrator function |
| `supabase/functions/generate-itinerary/fix-placeholders.ts` | **New** — extracted from action-generate-day.ts |
| `supabase/functions/generate-itinerary/action-generate-day.ts` | Import `fixPlaceholdersForDay` from new file; replace scattered quality steps with `universalQualityPass()` call |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Replace scattered dedup + pricing loops with `universalQualityPass()` call per day |

### What Stays Unchanged
- All individual enforcement functions in `sanitization.ts` and `flight-hotel-context.ts` — untouched
- Trip-level Michelin count warning — stays in `action-generate-trip-day.ts`
- Locked activity conflict resolution — stays separate (runs before quality pass)
- Meal guard — stays separate (runs after quality pass)

### Deployment
Redeploy `generate-itinerary` edge function.

