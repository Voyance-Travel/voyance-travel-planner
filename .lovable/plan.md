# Plan — Last-day departure anchor reaches the prompt

## Root cause

The Day-1 arrival path has 3 defenses (hardened picker, `parseFailed` flag, Day-1 soft floor in `compile-day-facts.ts`). The last-day departure path has **none** of them:

1. `pickDestinationDepartureLeg` (`flight-leg-pick.ts`) → `normalizeFlightSelection` only reads `ret.departure.time`. It misses the shapes `action-generate-trip-day.ts` already falls back to: `return.departureTime`, top-level `returnDepartureTime`, `returnDepartureTime24`. Those flat/legacy shapes return `source:'none'` or pick the outbound leg's `departure.time` (home airport, not destination).
2. `getFlightHotelContext` only sets `parseFailed` for arrival. When `returnDeparture` is undefined the LAST-DAY constraint block at lines 425–430 is silently skipped — the prompt has no departure anchor.
3. `compile-day-facts.ts` has the Day-1 SOFT FALLBACK (lines 527–545) but no last-day equivalent.

Net: `action-generate-trip-day._depTime24Raw` knows the departure (so post-hoc anchor-guard can trim/cap), but the prompt itself never told the LLM — it invents an early checkout and skips the flight block. Anchor-guard cleans up the flight leg later, but cannot retroactively turn an arbitrary 6 AM checkout into a believable late-morning checkout-then-transfer sequence.

## Changes

### 1. Harden the departure picker — `supabase/functions/_shared/normalize-flight-selection.ts`

In the legacy `{ departure, return }` branch (~line 200), when constructing the return leg, also read alternate keys:
- `ret.departure?.time ?? ret.departureTime ?? data.returnDepartureTime`
- `ret.departure?.airport ?? ret.departureAirport`

In the flat branch (~line 222), additionally accept `data.returnDepartureTime` / `data.returnDepartureTime24` and synthesize a second leg so the picker can mark `isDestinationDeparture` on it. Keep behavior identical when those fields are absent.

### 2. Picker safety — `supabase/functions/_shared/flight-leg-pick.ts`

In `pickDestinationDepartureLeg`, when `legs.length === 1` and no `isDestinationDeparture` marker exists, return `{ source: 'none', leg: undefined }` instead of pretending the single (outbound) leg's `departure.time` is the destination departure. This prevents silent home-airport-as-destination-departure errors.

### 3. Surface `departureParseFailed` — `supabase/functions/generate-itinerary/flight-hotel-context.ts`

- Extend `FlightHotelContextResult` with `departureParseFailed?: boolean` and `legDeparturePickSource?: string`.
- In the parsing block (after line 358), mirror the Day-1 `parseFailed` pattern: if `flightRaw` is present AND the picker indicates a return-leg shape (legs.length>=2, legacy `return` object, or any `returnDeparture*` field) AND `returnDeparture` is still undefined, set `departureParseFailed=true` and log `[FLIGHT_INGEST_PARSE_FAIL] last_day tripId=… shape=… legPick=…`.
- Return both new fields in the result envelope (line 563-589).

### 4. Last-day soft fallback — `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts`

Add a block mirroring the Day-1 fallback (lines 527–545), after the existing arrival fallback:

```ts
if (
  isLastDay &&
  !flightContext.returnDepartureTime24 &&
  (flightContext as any).departureParseFailed &&
  (flightContext as any).rawFlightSelection
) {
  const SOFT_DEP_FLOOR = '18:00';
  const latest = addMinutesToHHMM(SOFT_DEP_FLOOR, -180); // 15:00
  flightContext = {
    ...flightContext,
    returnDepartureTime24: SOFT_DEP_FLOOR,
    latestLastActivityTime: latest,
    context: (flightContext.context || '') +
      `\n\n⚠️ LAST DAY SOFT DEPARTURE FALLBACK — flight_selection was provided but the return-departure time could not be parsed. Treat departure as ${SOFT_DEP_FLOOR}; latest non-logistics activity must end by ${latest}. Do NOT emit a checkout earlier than 10:00 unless you have a credible reason.`,
  };
  console.warn(`[compile-day-facts] Last-day soft-departure fallback applied — floor=${SOFT_DEP_FLOOR}`);
}
```

Also add a `[FLIGHT_INGEST] day=N isLast=true …` trace mirroring the Day-1 trace at lines 549–555.

### 5. Tests

- `supabase/functions/_shared/__tests__/flight-leg-pick.parity.test.ts` — add cases:
  - Legacy `{ return: { departureTime: '22:00', departureAirport: 'CDG' } }` (flat departure keys) returns picked leg with `departureTime: '22:00'`.
  - Flat `{ returnDepartureTime: '22:00', arrivalTime: '14:00' }` returns picked leg with `departureTime: '22:00'`.
  - Single-leg `{ legs: [outbound] }` returns `source: 'none'` for departure (no false picks).
- New `compile-day-facts.last-day-soft-fallback.test.ts` — assert the soft-departure block fires only when `isLastDay && departureParseFailed && rawFlightSelection` and skipped otherwise.

### 6. Memory

Create `mem/constraints/itinerary/last-day-departure-anchor-parity.md` documenting the 3-defense parity with Day-1 arrival, and add a one-liner to `mem/index.md` Core (mirrors the existing flight-anchor-truth entry).

## Files touched

- `supabase/functions/_shared/normalize-flight-selection.ts`
- `supabase/functions/_shared/flight-leg-pick.ts`
- `supabase/functions/generate-itinerary/flight-hotel-context.ts`
- `supabase/functions/generate-itinerary/pipeline/compile-day-facts.ts`
- `supabase/functions/_shared/__tests__/flight-leg-pick.parity.test.ts` (extend)
- `supabase/functions/generate-itinerary/__tests__/compile-day-facts.last-day-soft-fallback.test.ts` (new)
- `mem/constraints/itinerary/last-day-departure-anchor-parity.md` (new)
- `mem/index.md` (append)

## Out of scope

- `action-generate-trip-day._depTime24Raw` fallback chain — already covers what we need post-prompt. Not touching anchor-guard / executioner.
- UI / FE normalizer — already correct, BE is the lagging side.
