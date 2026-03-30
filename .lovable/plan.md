

## Fix: Missing Departure Card on Last Day (Single-City Trips)

### Root Cause

The departure card ("Transfer to Airport" / "Flight Home") is only injected on the last day when **either** the day has `isDepartureDay + departureTo` flags set **or** `flightSelection` contains a parseable return leg.

For **single-city trips**, `cityInfo` is `null` (line 402 of `itineraryAPI.ts`), so `isDepartureDay` and `departureTo` are **never set** on the day data. This means:

- `isFinalHomeDeparture` (line 1774 of `EditorialItinerary.tsx`) is always `false`
- If `flightSelection` exists but has no parseable return leg (e.g., one-way, or unexpected data shape), `hasReturnData` stays `false`
- The synthetic departure card block at line 1835 never fires → no airport/departure card

The backend `repair-day.ts` does inject a transport card via the "Departure Transport Guarantee" (line 616), but this relies on the AI not already generating a transport-category activity with "transfer to" in the title — which can cause false-positive detection and skip the injection.

### Fix (Two Changes)

**1. `src/services/itineraryAPI.ts` (line 400–413)**

After the `if (cityInfo)` block, add a fallback for the absolute last day: always set `isDepartureDay = true` and `departureTo = '__home__'` on the final day, even without `cityInfo`.

```typescript
if (cityInfo) {
  // ... existing code ...
}
// Fallback: ensure the absolute last day always has departure flags
if (dayNumber === totalDays && !data.day.isDepartureDay) {
  data.day.isDepartureDay = true;
  data.day.departureTo = '__home__';
}
```

**2. `src/components/itinerary/EditorialItinerary.tsx` (line 1776)**

Relax the guard so the last day ALWAYS attempts departure card injection, even without explicit flight data. If neither `flightSelection` nor departure metadata provides return data, inject a generic "Departure" placeholder card.

Change the condition from:
```
if (isAbsoluteLastDay && !d.isTransitionDay && isLastCity && hasFinalDepartureInfo)
```
to:
```
if (isAbsoluteLastDay && !d.isTransitionDay && isLastCity)
```

Then inside the block, after the existing `if (hasReturnData)` section, add an `else` fallback that injects a generic departure card (e.g., "Head to the Airport" at a default time like checkout + 3 hours).

---

### Summary

| File | Change |
|---|---|
| `src/services/itineraryAPI.ts` (~line 413) | Always set `isDepartureDay=true` and `departureTo='__home__'` on the last day |
| `src/components/itinerary/EditorialItinerary.tsx` (~line 1776) | Remove `hasFinalDepartureInfo` guard; add generic departure card fallback when no flight/transport metadata exists |

