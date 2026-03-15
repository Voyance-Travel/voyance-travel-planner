

## Bug: Transport Options Show Fake Airport-to-Hotel Data for City Routes

### Root Cause

Both `TransitModePicker` and `TransitGapIndicator` call the `airport-transfers` edge function for **all** point-to-point routes — even between two restaurants or attractions within a city.

The `airport-transfers` function:
- **Durations ARE real** — it calls Google Distance Matrix API with the actual origin/destination (lines 253-294)
- **Costs are wrong** — pulled from `airport_transfer_fares` DB table or `REGIONAL_ESTIMATES` hardcoded for airport-distance trips
- **Route descriptions are fake templates** — e.g., line 320: `"Direct door-to-door from airport to hotel"`, line 348: `"Airport express to central station, then walk/taxi to hotel"`, line 376: `"Airport shuttle to city center drop-off point"`
- **Pros/cons/booking tips are airport-specific** — "Driver waiting at arrivals", "Buy tickets at the airport station", etc.

So the user sees real travel times but fake routes, fake costs, and airport-specific copy for a 15-minute walk between two restaurants.

### Fix Plan

**File: `supabase/functions/airport-transfers/index.ts`** — Detect non-airport routes and generate city-appropriate responses:

1. **Add airport detection** — Check if origin or destination contains airport keywords (`airport`, `terminal`, known airport codes). Set `isAirportRoute` flag.

2. **For non-airport routes**, change option templates:
   - **Taxi**: Route = `"Direct ride from {origin} to {destination}"` instead of `"from airport to hotel"`. Cost = scale down from regional estimates (short city trip ~1/3 of airport fare).
   - **Train/Metro**: Route = `"Take metro/bus nearest to {destination}"` instead of `"Airport express to central station"`. Keep Google live transit duration.
   - **Bus**: Route = `"Local bus service"` instead of `"Airport shuttle to city center"`. Label stays `"Bus / Shuttle"`.
   - **Skip Hotel Car Service** entirely for non-airport routes (already filtered client-side, but should be server-side too).
   - **Adjust pros/cons** — Remove airport-specific ones ("Driver waiting at arrivals", "Buy tickets at airport station").

3. **Scale costs for city routes** — Use ~30-40% of airport fare estimates for short in-city trips, since airport distances are typically 20-40km vs 2-5km within a city.

**Files: `src/components/itinerary/TransitModePicker.tsx` and `TransitGapIndicator.tsx`** — Pass the actual origin and destination names to the edge function so it can generate proper route descriptions. Already mostly done, but ensure `origin` and `destination` params are populated correctly (not just city name).

### Files to Modify

| File | Change |
|------|--------|
| `supabase/functions/airport-transfers/index.ts` | Add `isAirportRoute` detection, branch route descriptions/costs/tips for city vs airport routes |
| `src/components/itinerary/TransitModePicker.tsx` | Ensure `origin` param includes activity location name (already does via `transitOrigin`) |
| `src/components/itinerary/TransitGapIndicator.tsx` | Already passes `originName` — no change needed |

