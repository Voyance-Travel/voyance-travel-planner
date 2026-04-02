

## Replace or Remove `enrich-itinerary` Simulated Data

### Context

The `enrich-itinerary` edge function is called by `useLovableItinerary.ts` after day-by-day generation completes. It returns:
- **Weather**: Random conditions with destination-based temperature heuristics (not real forecasts)
- **Walking distances**: Haversine straight-line calculations (the `transit-estimate` edge function already does this better, with Google Routes API support)
- **Destination photos**: Hardcoded Unsplash photo IDs rotated by destination name hash

Meanwhile, the primary pipeline (`generate-trip-day`) already handles weather context via `weather-backup.ts` and transit via `transit-estimate`. The real enrichment functions (`enrich-attraction`, `lookup-activity-url`, etc.) exist and are called from `enrichmentService.ts` by UI components.

### Recommendation: Remove `enrich-itinerary`

The function provides no real data. Its outputs are either duplicated by the main pipeline or are pure theater. Removing it simplifies the codebase.

### Changes

**1. `supabase/functions/enrich-itinerary/` — Delete**
- Remove the entire edge function directory

**2. `src/hooks/useLovableItinerary.ts` — Remove enrichment step**
- Remove the "Step 3: Enrich with weather/distances" block (~lines 450-500) that calls `enrich-itinerary`
- Adjust progress percentages: generation goes from 10% straight to 90%, then save at 90-100%
- Remove the `enriching` step from the progress state

**3. `supabase/functions/_shared/cost-tracker.ts` — Remove mapping**
- Remove the `enrich_itinerary` / `enrich-itinerary` entries from the action-to-category map

### Files

| File | Change |
|---|---|
| `supabase/functions/enrich-itinerary/index.ts` | **Delete** |
| `src/hooks/useLovableItinerary.ts` | Remove enrichment call block, adjust progress |
| `supabase/functions/_shared/cost-tracker.ts` | Remove cost category mapping entries |

