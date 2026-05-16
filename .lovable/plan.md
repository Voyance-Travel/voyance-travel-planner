# Final-Departure Card Mode Inference Fix

## Problem

On the last day of your Stockholm trip the synthetic "final departure" card renders as:

> **Heading Home · TRAIN** · ARN → Home · 11:15 AM · 240 min

The trip actually has a `flight_selection` with two legs (`ARN` arrival 10:20, `ARN` departure 11:15), no carrier and no flight number entered. The mode-inference fallback in `EditorialItinerary.tsx` then incorrectly resolves the mode to `train` because the carrier string is empty.

## Root Cause

`src/components/itinerary/EditorialItinerary.tsx` around line 1974:

```ts
tType = explicitMode
  || (flightNum
      ? 'flight'
      : (carrier && !(carrier || '').toLowerCase().includes('train') ? 'flight' : 'train'));
```

When `carrier` is `''` (empty), the inner ternary short-circuits to `'train'`. Any `flightSelection` with blank metadata silently becomes a train card, even when the origin is an IATA airport code like `ARN`.

## Fix (single, surgical UI change)

In `EditorialItinerary.tsx`, replace the mode-inference fallback with a hierarchy that trusts the most reliable signal:

1. `flightSelection.transportMode` if explicitly set in Step 2
2. `'flight'` when a flight number is present
3. `'train'` only when carrier explicitly mentions train/rail (`/train|rail|sncf|amtrak|eurostar/i`)
4. `'flight'` when origin or destination looks like an IATA airport code (`^[A-Z]{3}$`)
5. `'flight'` as the default whenever the data came from `flightSelection.legs` (the presence of a flight selection implies a flight)

This matches the user's stated rule: "trust whatever Step 2 says" — and Step 2 here recorded a flight (`flight_selection.legs` with airport codes), not a train.

The fallback branch that reads `d.departureTransportDetails` (non-flight Step 2 selection) is untouched, so users who do enter a real train transfer keep their TRAIN card.

## Verification

- Reload trip `eb9ec034` — final card should now show `Flight to Home · FLIGHT` (or similar) with the plane icon.
- Manually test by editing Step 2 to a train transfer with no carrier — card should still render TRAIN (departure metadata branch is unchanged).
- Existing `InterCityTransportCard` tests and `terminalCleanup` tests are not touched; no risk of regression there.

## Files Touched

- `src/components/itinerary/EditorialItinerary.tsx` — single resolver block (~10 lines)

No backend, no DB, no data migration. UI-only.
