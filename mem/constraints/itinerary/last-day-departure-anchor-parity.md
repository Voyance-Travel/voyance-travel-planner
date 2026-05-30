---
name: Last-Day Departure Anchor Parity
description: Last-day return-departure flows through the same 3-defense pipeline as Day-1 arrival — hardened picker, departureParseFailed flag, and soft 18:00 floor — so the prompt always carries a believable departure anchor
type: constraint
---

The Day-1 arrival path has three defenses (hardened picker, `parseFailed`
flag, Day-1 SOFT FALLBACK in `compile-day-facts.ts`). Before this fix the
**last-day departure had none of them**, so when the return-leg shape
didn't match the normalizer's narrow `ret.departure.time` lookup, the
LAST-DAY constraint block in `flight-hotel-context.ts` rendered empty and
the LLM was observed inventing a 6 AM checkout with no flight anchor at
all. The Executioner's anchor-guard then trimmed the flight leg correctly
but couldn't retroactively re-time the checkout.

## The three layers (mirrored)

### 1. Hardened picker — `_shared/normalize-flight-selection.ts`

The legacy `{ departure, return }` branch and the flat branch now read the
same alternate keys `action-generate-trip-day.ts` already falls back to:

- `ret.departure?.time ?? ret.departureTime`
- `ret.departure?.airport ?? ret.departureAirport`
- top-level `data.returnDepartureTime ?? data.returnDepartureTime24` /
  `data.returnDepartureAirport` — synthesizes a second leg so the picker
  can mark `isDestinationDeparture` on it.

`detectShape` recognizes the same top-level return keys as `'flat'`.

### 2. Picker safety — `_shared/flight-leg-pick.ts`

When `legs.length === 1` AND no `isDestinationDeparture` marker exists,
`pickDestinationDepartureLeg` returns `{ source: 'none', leg: undefined }`
instead of returning the single outbound leg's `departure.time` (the
HOME airport time, which would silently corrupt the last-day anchor).

### 3. `departureParseFailed` + last-day soft fallback

`FlightHotelContextResult` carries `departureParseFailed` and
`legDeparturePickSource`. `getFlightHotelContext` sets the flag when
`flight_selection` is present, contains any return-leg signal
(legs.length ≥ 2, legacy `return` object, or any `returnDeparture*`
field), AND `returnDeparture` is still undefined. Logged as
`[FLIGHT_INGEST_PARSE_FAIL] last_day tripId=… shape=… legPick=…`.

`compile-day-facts.ts` adds a block mirroring the Day-1 SOFT FALLBACK:
when `isLastDay && !returnDepartureTime24 && departureParseFailed &&
rawFlightSelection`, it floors departure at `18:00` (latest activity
`15:00`) and appends a LAST DAY SOFT DEPARTURE FALLBACK directive to the
prompt context with an explicit "no checkout before 10:00" rule.

## Sentinels

- `[FLIGHT_INGEST_PARSE_FAIL] last_day …` — picker couldn't extract a
  return-departure time despite return-leg evidence
- `[compile-day-facts] Last-day soft-departure fallback applied — floor=18:00 …`
- `[FLIGHT_INGEST] day=N isLast=true … legDeparturePick=… returnDepartureTime24=… constraintWillRender=…`

## Tests

- `supabase/functions/_shared/__tests__/flight-leg-pick.parity.test.ts`
  - legacy `{ return: { departureTime, departureAirport } }` (flat keys on return)
  - flat top-level `{ returnDepartureTime, returnDepartureAirport }`
  - single-leg `{ legs: [outbound] }` → departure picker returns `source:'none'`

## Closes

The "Day 4 checkout at 6 AM with no departure flight" class: a return
flight was entered but stored in a shape (`return.departureTime`,
top-level `returnDepartureTime`, or single-leg outbound) the picker
didn't recognize → `returnDepartureTime24=undefined` → LAST-DAY prompt
block silently skipped → AI emitted an early checkout with no flight
block.
