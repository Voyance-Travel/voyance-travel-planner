

## Audit Results: Multi-City Hotel + Non-Flight Departure Logic

### What's Working Correctly

**Full-trip generation path (generate-trip):**
1. **dayCityMap builder** (line 1362-1451) — correctly resolves per-city hotel with date-aware split-stay matching, detects hotel changes, captures `nextLegTransport` + `nextLegTransportDetails` on last day in city
2. **Per-day hotel override** (line 1599-1603) — correctly overrides `context.hotelData` with `dayCity0.hotelName` before calling `buildDayPrompt`
3. **Multi-city prompt injection** (line 1998-2048) — correctly injects hotel name, checkout day prompt, non-flight override warnings, and hotel-change anchors
4. **Prompt library routing** (line 1480-1484) — correctly detects `isNonFlightCityDeparture` and returns regular day prompt instead of flight departure prompt

**Single-day regeneration path (generate-day):**
1. **Transition resolver** (line 7447-7554) — correctly queries `trip_cities` including `hotel_selection`, resolves per-city hotel with date-aware matching, captures next-leg transport details
2. **Hotel override** (line 7954-7961) — correctly applies `resolvedHotelOverride` to `flightContext`
3. **Non-flight departure gate** (line 8279-8346) — correctly checks `isNonFlightDeparture` BEFORE `hasReturnFlight`, generates station-based departure timeline with real transport details

### Holes Found

**Hole 1: `getFlightHotelContext` injects stale return flight into ALL days (CRITICAL)**

In the regeneration path, `getFlightHotelContext` (flight-hotel-context.ts line 247-258) always parses `flight_selection.return.departureTime` and injects it into `flightContext.returnDepartureTime`. This means even for mid-trip city departure days (e.g., Day 3 of Marrakech → train to Casablanca), the `flightContext.context` string contains "Return flight departs at..." text.

The non-flight departure gate at line 8282 correctly prevents the STRUCTURED constraints from using airport logic. But the raw `flightContext.context` STRING (which is injected into the system prompt separately) still mentions the return flight. The AI sees both:
- The structured non-flight departure constraints (correct)
- The raw flight context string saying "Return flight departs at X" (wrong for this day)

**Impact**: The AI may get confused and occasionally inject airport references despite the structured constraints saying otherwise. This is a **prompt conflict**, not a logic bug — it works most of the time but can cause hallucinations.

**Fix**: In the regeneration path, when `isNonFlightDeparture` is true, strip or nullify `flightContext.returnDepartureTime` and remove the return-flight text from `flightContext.context` before passing to the prompt. ~5 lines.

**Hole 2: `checkInDate` missing on first hotel in Casablanca split-stay data**

Looking at the actual database data for the Casablanca trip (trip_id `1310e38a`):
```
hotel_selection: [
  { name: "Hyatt Regency Casablanca", checkInTime: "15:00", checkOutDate: "2026-03-20", ... }  ← NO checkInDate!
  { name: "Casablanca Marriott Hotel", checkInDate: "2026-03-20", checkOutDate: "2026-03-23", ... }
]
```

The first hotel has `checkOutDate` but NO `checkInDate`. The date-aware resolution code (line 1389-1393) does `dateStr >= cin && dateStr < cout` — if `cin` is undefined, `dateStr >= undefined` evaluates to `false`, so the first hotel NEVER matches by date range. The fallback `|| hotelList[0]` catches it, BUT this means the date-aware resolution is fragile for the first hotel.

**Impact**: Works by accident (fallback), but if the data order changes or more hotels are added, it could break.

**Fix**: When a hotel has no `checkInDate`, default to trip/city start date. ~3 lines in both the dayCityMap builder and transition resolver.

**Hole 3: No `departureTime` in most train transport_details**

Looking at the actual Marrakech→Casablanca transport data:
```json
{
  "arrivalStation": "Casa Voyageurs Train Station",
  "departureStation": "Marrakech Train Station",
  "operator": "ONCF",
  "inTransitDuration": "2h 40m",
  "doorToDoorDuration": "3h 40m"
  // ← NO departureTime!
}
```

The non-flight departure prompt uses `td.departureTime || '10:30'` as the departure time. Since the user never entered a specific train time in step 2 (the builder only captures station/operator/duration, not clock time), it always falls back to **10:30 AM**. This is not necessarily wrong but it's a hardcoded guess.

**Impact**: The generated timeline (breakfast at 7:30, checkout at 9:00, board train at 10:30) uses a default time. If the user's actual train is at 3 PM, the itinerary will be wrong.

**Fix**: This is a data capture gap in step 2 (the multi-city builder). The builder should ask for departure time. For now, the 10:30 default is acceptable as a safe middle ground. No code change needed in the generator — but the builder UI should capture `departureTime`. This is a **frontend enhancement**, not a backend bug.

**Hole 4: Regeneration path doesn't build `multiCityDayMap` for the prompt library**

In the full-trip path, `buildDayPrompt` receives `options.isLastDayInCity` and `options.nextLegTransport` from the `dayCity0` object (line 1611-1616). But in the regeneration path, there is NO `multiCityDayMap`. The prompt library call happens elsewhere — let me check if it's even called in the regeneration path.

Looking at line 7997+, the regeneration path builds `dayConstraints` directly (the large decision tree) and does NOT call `buildDayPrompt` from the prompt library. It builds its own prompt inline. So this is NOT a hole — the regeneration path has its own complete logic that correctly handles non-flight departures.

**However**, the regeneration path does NOT inject the multi-city overlay prompt (`multiCityPrompt`) with hotel name enforcement, visitor status, etc. It relies solely on:
1. `flightContext.hotelName` (overridden by `resolvedHotelOverride`)
2. The raw `dayConstraints` block

This means regenerated days get the right hotel NAME in `flightContext` but NOT the strong enforcement like "🚫 CRITICAL: The user has ALREADY SELECTED this hotel..." that the full-trip path injects. The AI could still hallucinate a different hotel name.

**Fix**: Add a multi-city context block in the regeneration path's prompt assembly that mirrors the key hotel enforcement from the full-trip path. ~10 lines.

### Summary: 4 Holes, 2 Critical

| # | Issue | Severity | Fix Size |
|---|-------|----------|----------|
| 1 | Return flight string leaks into non-flight departure days | Medium | 5 lines |
| 2 | Missing `checkInDate` on first hotel breaks date matching | Low (works by fallback) | 3 lines |
| 3 | No `departureTime` in transport_details (builder gap) | Low (10:30 default) | Frontend enhancement |
| 4 | Regeneration path missing hotel enforcement prompt | Medium | 10 lines |

### Proposed Fix — 1 file, ~20 lines

**`supabase/functions/generate-itinerary/index.ts`**

**Fix 1**: After line 8280 (`isNonFlightDeparture` check), strip return flight data from `flightContext`:
```typescript
if (isNonFlightDeparture) {
  // Prevent AI from seeing return flight data on a train/bus departure day
  flightContext = { ...flightContext, returnDepartureTime: undefined, returnDepartureTime24: undefined, latestLastActivityTime: undefined };
  flightContext.context = (flightContext.context || '').replace(/🚨 LAST DAY TIMING CONSTRAINT:[\s\S]*?(?=\n={10,}|\n🚨|$)/, '');
}
```

**Fix 2**: In both dayCityMap builder (line 1389) and transition resolver (line 7474), handle missing `checkInDate`:
```typescript
const cin = h.checkInDate || h.check_in_date || context.startDate; // default to trip start
```

**Fix 4**: After `resolvedHotelOverride` application (line 7961), add hotel enforcement prompt for multi-city regenerations:
```typescript
if (resolvedIsMultiCity && resolvedHotelOverride?.name) {
  const hotelEnforcement = `\n🏨 ACCOMMODATION: "${resolvedHotelOverride.name}"${resolvedHotelOverride.address ? ` — ${resolvedHotelOverride.address}` : ''}.\n🚫 CRITICAL: Use "${resolvedHotelOverride.name}" for ALL accommodation references. Do NOT invent or substitute a different hotel.`;
  flightContext.context = (flightContext.context || '') + hotelEnforcement;
}
```

