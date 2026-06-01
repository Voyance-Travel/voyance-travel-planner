## Root cause

V2 day-chain (`generate-trip-day-v2`) fails on every day-1 call with:

```
resolveTripFacts: trip fetch failed: column trips.destination_iata does not exist
```

`supabase/functions/_shared/trip-facts.ts` line 138 selects `destination_iata` from `public.trips`, but that column was never added to the schema (verified: the table only has `destination`, `destination_country`). Postgres rejects the whole row read, `resolveTripFacts` throws, the launcher retries 3× and the trip stalls at day 1.

This is the only blocker — planner + enrichment + invoke queueing all succeed in the logs; the failure is the very first DB read inside the day handler.

## Fix

In `supabase/functions/_shared/trip-facts.ts`:

1. Remove `destination_iata` from the `.select(...)` string at line 138.
2. Simplify the IATA derivation at line 213 to just `flightHotel.arrivalAirport || null` (the `trip.destination_iata` fallback is dead — column never existed).

No schema change, no other call sites affected (`TripFacts.destination.iata` already tolerates `null`). Deploy `generate-itinerary`, then the stuck trip `938369b4-…` can resume via the existing self-resume path.

## Out of scope

- No change to planner, enrichment, or any downstream stage.
- Not adding a `destination_iata` column — IATA is correctly sourced from `flight_selection` / `flight_intelligence` via `flightHotel.arrivalAirport`.