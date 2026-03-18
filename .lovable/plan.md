

## Fix: Post-Checkout Activities + Transport Data Not Flowing to Travel Cards

### Issue 1: Activities appearing after checkout

The departure-day trimming logic (lines 1607-1624) only runs when `isDepartureDay` is set. But the user also sees walks/activities after checkout on:
- The **last day** of the trip (homebound day) — which has no `isDepartureDay` flag
- Any checkout day where activities were generated with times after checkout

**Fix**: After injecting the final departure card AND after injecting any departure card, also trim activities that occur after checkout. Additionally, add a general post-checkout filter: on any day that has a checkout activity, remove non-synthetic activities scheduled after the checkout ends (unless they're explicitly before the transport departure).

Specifically in `EditorialItinerary.tsx`, after the final departure card injection block (~line 1726), add the same trim logic used for departure days — filter out non-synthetic activities that start after checkout time.

### Issue 2: Transport details from Step 2 not flowing to travel cards

The field names saved by `Start.tsx` into `trip_cities.transport_details` are:
- `operator` (not `carrier`)
- `departureStation` / `arrivalStation` (not `from` / `to`)
- `inTransitDuration` / `doorToDoorDuration` (not `duration`)
- `costPerPerson` / `totalCost` (not `price`)
- No `departureTime` / `arrivalTime` fields at all

But the card injection code reads `carrier`, `flightNumber`, `departureTime`, `arrivalTime`, `duration` — all of which are empty because the field names don't match.

**Fix**: Normalize the transport_details fields in both the **transition day** card (line 1450-1460) and the **departure day** card (line 1528-1534). Map legacy field names to the expected ones:

```
operator → carrier
departureStation → from (route endpoint)
arrivalStation → to (route endpoint) 
inTransitDuration / doorToDoorDuration → dur
totalCost → price
currency → currency
```

Also populate `from` in the departure card's `__travelMeta` (currently hardcoded to `''`).

### Changes

| # | File | Change |
|---|------|--------|
| 1 | `EditorialItinerary.tsx` (~line 1528-1534) | **Departure day card**: Normalize `transport_details` field names — read `operator` as carrier, `departureStation`/`arrivalStation` as from/to, `inTransitDuration`→dur, `totalCost`→price. Populate `__travelMeta.from` with the current city name. |
| 2 | `EditorialItinerary.tsx` (~line 1450-1460) | **Transition day card**: Same normalization for `d.transportDetails` — read `operator` as carrier, stations as endpoints, duration from `inTransitDuration`/`doorToDoorDuration`, price from `totalCost`/`costPerPerson`. |
| 3 | `EditorialItinerary.tsx` (after line ~1726) | **Post-checkout trim on last day**: After injecting the final departure card, apply the same activity trimming logic — filter out non-synthetic activities that start after checkout end time. |
| 4 | `EditorialItinerary.tsx` (~line 1607-1624) | **Strengthen departure day trim**: Also trim activities after checkout on departure days, not just before departure buffer. Activities between checkout and departure should only be transit-related. |

### Normalization Helper (added near the injection code)

```typescript
function normalizeTransportDetails(raw: Record<string, unknown>) {
  return {
    carrier: (raw.carrier || raw.operator || '') as string,
    flightNum: (raw.flightNumber || '') as string,
    depTime: (raw.departureTime || '') as string,
    arrTime: (raw.arrivalTime || '') as string,
    dur: (raw.duration || raw.inTransitDuration || raw.doorToDoorDuration || '') as string,
    price: raw.price != null ? raw.price as number 
         : raw.totalCost != null ? raw.totalCost as number 
         : undefined,
    currency: (raw.currency || 'USD') as string,
    fromStation: (raw.departureStation || raw.from || '') as string,
    toStation: (raw.arrivalStation || raw.to || '') as string,
    seatInfo: (raw.seatClass || raw.seat || raw.seatInfo || '') as string,
    bookingRef: (raw.bookingRef || raw.confirmationNumber || '') as string,
  };
}
```

This ensures that regardless of whether the data came from Step 2's transport picker (with `operator`, `departureStation`, etc.) or from a manually edited transport card (with `carrier`, `departureTime`, etc.), the travel cards display all available information.

