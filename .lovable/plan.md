## CL.3 — Dispose of flight search

### State of play (verified)

`searchFlights`/`useFlightSearch` are **still wired** in two pages, but those pages are **route-orphaned** — `/planner/flight` is registered in `App.tsx` and `routes.ts` but **nothing in the live UI navigates to it**. Direct-URL only. So this is Path 2b (UI present), but the UI is already detached from the user flow.

Surface area to remove:
- 2 pages: `src/pages/planner/PlannerFlight.tsx`, `src/pages/planner/PlannerFlightEnhanced.tsx`
- 2 components used only by those pages: `src/components/planner/flight/EnhancedFlightCard.tsx`, `src/components/planner/flight/FlightFilters.tsx`
- 1 route + 1 route constant + 1 admin tracking entry
- Search-related exports in `src/services/flightAPI.ts`
- The entire `supabase/functions/flights/` edge function

Surface area to **keep**:
- `supabase/functions/flight-status/` — used by `FlightStatusTracker.tsx` for post-booking tracking. Different feature.
- `src/components/planner/flight/MultiLegFlightEditor.tsx` — used by `src/pages/Start.tsx` for **manual** flight entry. Keep.
- `src/services/flightItineraryPatch.ts` and `src/services/flightRankingAPI.ts` — manual entry parsing/ranking. Keep.

### Step 1 — Delete UI files

```
src/pages/planner/PlannerFlight.tsx
src/pages/planner/PlannerFlightEnhanced.tsx
src/components/planner/flight/EnhancedFlightCard.tsx
src/components/planner/flight/FlightFilters.tsx
```

`MultiLegFlightEditor.tsx` stays — `Start.tsx` still uses it.

### Step 2 — Remove route + constants

- `src/App.tsx`: remove the `import PlannerFlight from "./pages/planner/PlannerFlightEnhanced";` line and the `<Route path="/planner/flight" …>` line.
- `src/config/routes.ts`: remove `FLIGHT: '/planner/flight'` from `ROUTES.PLANNER`.
- `src/pages/admin/UserTracking.tsx`: remove the `'/planner/flight': 'Flight Search'` map entry.
- `src/test/navigation.test.ts`: remove the three `/planner/flight` lines (lines 78, 137, 446) so the test no longer asserts the dead route exists.

### Step 3 — Trim `src/services/flightAPI.ts`

The file mixes search (going away) with hold/details/amadeus helpers (only consumed by the two pages above, so also dead). Remove all of:

- `searchFlights`, `searchRoundtripFlights`
- `useFlightSearch`, `useRoundtripFlightSearch`, `useFlightDetails`, `useCreateFlightHold`, `useReleaseFlightHold`, `useAmadeusConfig`
- `getFlightDetails`, `createFlightHold`, `releaseFlightHold`, `getAmadeusConfig`
- `generateMockFlights` (only used by `searchFlights`)
- `RoundtripFlightResults`, `FlightHoldInput`, `FlightHoldResponse` interfaces
- The bottom `export const flightAPI = { … }` aggregate

Keep the data-shape interfaces (`FlightSegment`, `FlightPassengers`, `FlightPrice`, `FlightBaggage`, `FlightPriceLock`, `FlightOption`, `FlightSearchResponse`) since `flightItineraryPatch.ts`/`flightRankingAPI.ts` and the manual-entry editor may import them — verify with a grep before pruning.

If after pruning the file is empty of runtime code, delete it entirely. Otherwise keep it as a types module.

### Step 4 — Delete the edge function

```
supabase/functions/flights/
```

Then call `delete_edge_functions` for `["flights"]` to remove the deployed copy.

### Step 5 — Verify

- `grep -rn "searchFlights\|useFlightSearch\|FlightSearchParams" src --include="*.ts" --include="*.tsx"` → 0 hits
- `grep -rn "/planner/flight" src --include="*.ts" --include="*.tsx"` → 0 hits
- `ls supabase/functions/flights` → not found
- `ls supabase/functions/flight-status` → still exists
- Build/type-check passes (the harness runs it automatically)
- `MultiLegFlightEditor` and `flight-status` paths unchanged

### Out of scope

- No data migration: there's no user-generated flight-search history table to clean up; results were always live.
- The dead `'flights'` query-key on `releaseFlightHold` invalidation goes away with the hook itself, so no orphan cache state.
- `flightRankingAPI.ts` line 238 comment ("actual flight fetching … happens in flightAPI") is stale once we land this. Will update the comment to reflect manual-only flow.

### Risk

Very low. The route is already orphaned from the live UI, so deleting it removes a direct-URL escape hatch but no user-visible flow. The only way someone reaches it today is by typing `/planner/flight` manually, and after Step 2 they'll get the 404 page — which is the intended end state.
