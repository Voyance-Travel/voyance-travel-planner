

## Fix: Arrival Time Extraction in the Orchestrator

### Root Cause

The orchestrator (`action-generate-trip-day.ts` line 845) extracts the arrival time from `flight_selection` using wrong property paths:

```
flightSel.arrivalTime24 || flightSel.arrivalTime || flightSel.outbound?.arrivalTime
```

But the actual `flight_selection` structure stores it at `departure.arrival.time` (or `legs[0].arrival.time`). None of the checked paths exist, so `arrTime24` is always `undefined`.

This means:
- `repairDay()` receives no arrival time → its pre-arrival filter never fires
- `deriveMealPolicy()` receives no arrival time → wrong meal expectations for Day 1
- The per-day generator (`action-generate-day.ts`) works correctly because it uses `getFlightHotelContext()` which checks the right paths

### The Fix

**File: `action-generate-trip-day.ts` (~line 845)**

Replace the arrival/departure time extraction with the same logic used by `getFlightHotelContext`:

```typescript
// Current (broken):
const arrTime24 = isFirstDay ? (flightSel.arrivalTime24 || flightSel.arrivalTime || flightSel.outbound?.arrivalTime || undefined) : undefined;
const depTime24Raw = isLastDay ? (flightSel.returnDepartureTime24 || flightSel.returnDepartureTime || flightSel.return?.departureTime || undefined) : undefined;

// Fixed — check all known flight_selection shapes:
const nestedDep = flightSel.departure as Record<string, any> | undefined;
const nestedRet = flightSel.return as Record<string, any> | undefined;
const arrTime24Raw = isFirstDay
  ? (flightSel.arrivalTime24
    || flightSel.arrivalTime
    || flightSel.outbound?.arrivalTime
    || nestedDep?.arrival?.time          // ← manual entry format
    || flightSel.legs?.[0]?.arrival?.time // ← legs format
    || undefined)
  : undefined;
const arrTime24 = arrTime24Raw ? normalizeTo24h(arrTime24Raw) : undefined;

const depTime24Raw = isLastDay
  ? (flightSel.returnDepartureTime24
    || flightSel.returnDepartureTime
    || nestedRet?.departure?.time         // ← manual entry format
    || nestedRet?.departureTime
    || flightSel.legs?.[flightSel.legs.length - 1]?.departure?.time // ← legs format
    || undefined)
  : undefined;
const depTime24 = depTime24Raw ? normalizeTo24h(depTime24Raw) : undefined;
```

Apply the same fix at the **second extraction point** (~line 1255) where `savedArrivalTime24` / `savedDepartureTime24` are extracted for the meal-slot recalculation pass.

**Add a diagnostic log** after extraction so we can verify it works:
```typescript
if (isFirstDay) console.log(`[generate-trip-day] Day ${dayNumber} arrival time: ${arrTime24 || 'NONE'} (raw: ${arrTime24Raw || 'none found'})`);
if (isLastDay) console.log(`[generate-trip-day] Day ${dayNumber} departure time: ${depTime24 || 'NONE'} (raw: ${depTime24Raw || 'none found'})`);
```

### Files to Edit

| File | Change |
|------|--------|
| `action-generate-trip-day.ts` | Fix arrival/departure time extraction at lines ~845 and ~1255 to check `departure.arrival.time` and `legs[0].arrival.time` paths |

### What We're NOT Changing
- `action-generate-day.ts` — already works correctly via `getFlightHotelContext()`
- `repair-day.ts` — already has correct logic, just receives `undefined` due to the orchestrator bug
- `flight-hotel-context.ts` — already handles all formats correctly

