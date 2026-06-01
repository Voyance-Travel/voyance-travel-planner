# Header Trip Total ≠ Payments Trip Total ($231 vs $219)

## Root cause

Both surfaces already share `composeDisplayedTripTotal` (per the
`displayed-trip-total-single-source` rule), so they read the same snapshot.
The drift is in the **dayNumbers filter passed to the composer**:

- `EditorialItinerary.tsx` (header) — `dayNumbersForStrip = days.map(d => d.dayNumber)`. No `> 0` filter. If `days` includes a Day 0 entry (logistics/arrival day), its `byDay[0].totalCents` gets folded into `daysSubtotalCents`.
- `PaymentsTab.tsx` — `useDisplayedTripTotal(tripId)` with no dayNumbers. Composer falls through to the default branch (`useDisplayedTripTotal.ts:70-72`) which explicitly skips `Number(k) > 0`, i.e. excludes Day 0.

Because the displayed total is `max(snapshot, daysGroup + hotel + flight)`,
header `daysGroup` silently includes the Day-0 logistics cost (already
captured by the hotel/flight chips and the snapshot's day-0 row policy).
Header clamps UP to that inflated chipSum; Payments uses the clean
`>0` sum, so it stays at the snapshot total.

Symptom: header `$231` (= snapshot `$219` + Day-0 `$12`), Payments `$219`.

## Fix (frontend only, single surgical edit)

`src/components/itinerary/EditorialItinerary.tsx` around line 4044:

```ts
const dayNumbersForStrip = useMemo(
  () => days.map(d => d.dayNumber).filter(n => n > 0),
  [days],
);
```

That makes the header's composer input match the PaymentsTab default
branch exactly: both sum `byDay[k]` only for `k > 0`. Day-0 logistics
remain represented through the hotel/flight chips (which the composer
already adds via `effectiveHotelCents` + `effectiveFlightCents`), so the
equation `Days + Hotel + Flight + Reserve = Trip Total` stays balanced
and the "Matches itinerary" badge can latch.

## Defense-in-depth (same file, `useDisplayedTripTotal.ts`)

Also harden `composeDisplayedTripTotal` so a future caller can't reintroduce
the bug by passing a `dayNumbers` array that includes 0:

```ts
if (dayNumbers && dayNumbers.length > 0) {
  for (const d of dayNumbers) {
    if (d <= 0) continue;            // Day 0 is logistics — never in daysGroup
    const b = breakdown.byDay[d];
    if (b) daysSubtotalCents += b.totalCents;
  }
}
```

This mirrors the existing default-branch `Number(k) > 0` guard and means
both branches behave identically with respect to Day 0.

## Out of scope

- No changes to `useTripFinancialSnapshot`, `useTripDayBreakdown`, or
  `activity_costs` writers. The remaining $12 may still be a real
  cost-inclusion mismatch worth investigating separately, but it must
  NEVER again surface as a divergent number between two surfaces — that
  was the user-visible bug.
- No backend / migration changes.
- No new memory entry needed; this is already covered by
  `mem://constraints/finance/displayed-trip-total-single-source` and
  `mem://constraints/finance/header-strip-mirrors-snapshot` — the fix
  re-aligns the header to those existing contracts.

## Verification

1. Reload the affected trip — header Trip Total should drop from $231 to
   $219 and match the Payments tab.
2. "Matches itinerary" badge in Payments should turn green (no longer
   "Reconciling…").
3. Existing parity tests in `src/hooks/__tests__/useDisplayedTripTotal.parity.test.ts`
   should still pass; add one fixture where `breakdown.byDay[0]` is
   non-zero and both code paths return the same `displayedTotalCents`.

## Files touched

- `src/components/itinerary/EditorialItinerary.tsx` (1-line filter on `dayNumbersForStrip`)
- `src/hooks/useDisplayedTripTotal.ts` (`continue` guard in `composeDisplayedTripTotal`)
- `src/hooks/__tests__/useDisplayedTripTotal.parity.test.ts` (new Day-0 parity fixture)
