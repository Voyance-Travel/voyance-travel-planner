## Bug
Day 1 badge shows `(incl. €130 airport taxi)` for a trip whose departure flight is Day 3. The arrival-day breakdown is rolling a cost into the "airport taxi" slot that shouldn't be there.

## Root Cause Hypothesis
In `src/components/itinerary/EditorialItinerary.tsx` (lines ~9929-9939), `airportTransferSubtotal` sums every transit-category activity on the day whose title/name/description merely **mentions** "airport". This catches:

1. Arrival-day "Land at VCE / water taxi from airport" rows (legit, but on Day 1 the user expects only the explicit Day-3 departure transfer to be priced).
2. Generic transit rows whose description mentions the airport in passing ("walk from hotel — 20 min from airport district") — false positives priced via fallback.
3. Transit legs whose `cost` came from the cost engine's airport-transfer fallback even though the leg isn't actually a paid taxi (e.g., a public-transport leg).

So two separate fixes are needed: a **labeling fix** (don't claim "airport taxi" for arrival walks/public transit) and a **diagnostic** confirming whether the €130 row is a real paid taxi or a stub.

## Plan

### 1. Tighten the "airport taxi" detection (UI only)
In `EditorialItinerary.tsx` around lines 9929-9940, replace the loose `/\bairport\b/` test with a stricter predicate that requires **all three**:
- Transit category (already checked).
- Title (not description) matches `/airport.*(taxi|transfer|shuttle|car|ride|water taxi|alilaguna|private)|(taxi|transfer|shuttle|car|water taxi).*airport/i`.
- A positive non-walking, non-zero `cost` that came from a paid source (skip rows whose `cost.basis` is `'estimated'` with no booking, and skip rows matching `isWalkingLeg`).

Activities that just *mention* the airport (sightseeing, walks, generic transit without a vehicle keyword) fall through to "Local transit" or are excluded entirely.

### 2. Diagnostic note in the dev-only sanity check
Extend the existing `process.env.NODE_ENV !== 'production'` block (~line 9944) to log, for each day, the activities counted under `airportTransferSubtotal` (id, title, dayNumber, cost, source). This makes future regressions of "wrong-day airport cost" visible in the console without needing user reports.

### 3. Verify on the reported trip
After deploying, the user re-runs the Venice itinerary. Expected outcome:
- Day 1 badge no longer shows `(incl. €130 airport taxi)` unless Day 1 actually contains a paid airport-taxi/water-taxi/transfer activity.
- Day 3 badge correctly shows the departure transfer subtotal.

### Files touched
- `src/components/itinerary/EditorialItinerary.tsx` — only the two `reduce` blocks at lines 9917-9940 and the dev sanity-check block.

### Out of scope
- Backend cost-engine logic (airport transfers are correctly costed there).
- Cross-day reassignment of airport-transfer activities (that's a generation-pipeline concern, not a label bug).
- Changes to the day-total math itself — only the inline "incl. X" annotation is affected.
