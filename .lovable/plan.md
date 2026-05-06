## Problem

In the Itinerary tab the per-day "Day Total" badges do not visibly add up to the headline **Trip Total**. Two structural reasons:

1. **Per-person vs group mismatch.** Each day badge renders `breakdownPerPersonUsd` and appends `/pp` when `travelers > 1`. The Trip Total above is the **group** total. A 2-traveler trip therefore appears to be "missing" roughly half the activities cost when a user sums day badges by eye.
2. **Day-0 + reserve bucket is hidden until non-zero in the right way.** `tripLevelCents = tripTotal − Σ day(d≥1) group totals` already captures hotel, flights, transfers and the misc reserve, and we render a "Days subtotal + Hotel, flight & reserve" strip — but it only appears when `tripLevelCents > 0 AND daysSubtotalCents > 0`, uses **group** numbers while the badges users see are **/pp**, and is visually a faint muted strip easy to miss. It also lumps reserve into the same line as hotel/flight, so users can't tell where the gap is.

Net effect: the user sees `Σ /pp day badges ≠ group trip total` and the reconciliation strip neither matches the badge numbers nor itemises the gap.

## Goal

Make the math obvious: a user reading the itinerary tab can trace every dollar from the day badges up to the Trip Total without opening the Budget tab.

## Changes (UI only — no business logic)

All edits in `src/components/itinerary/EditorialItinerary.tsx`.

### 1. Day badge tooltip — add the per-person → group bridge

In the existing day-total tooltip (around lines 10526–10549), when `travelers > 1`, append two rows after "Day total /pp":

```
× N travelers      $X
Day total (group)  $Y
```

This uses values already in scope (`totalCost`, `travelers`, `dayBreakdown.totalCents`). No new data fetching.

### 2. Always show the reconciliation strip when there is *any* gap

Replace the current gating `tripLevelCents > 0 && daysSubtotalCents > 0` (line 5728) with: render whenever `financialSnapshot.tripTotalCents > 0` AND (`tripLevelCents > 0` OR `travelers > 1`).

### 3. Itemise the strip so day badges literally sum to Trip Total

Render the strip as a single horizontal equation, group-cost throughout, with line items conditional on non-zero:

```
Days (group)  $A   +   Hotel  $H   +   Flights  $F   +   Reserve & adjustments  $R   =   Trip Total  $T
```

Rules:
- `Days (group) = daysSubtotalCents/100` (already computed).
- `Hotel`, `Flights` come from `hotelCost` / `flightCost` already in scope; only render the chip when > 0.
- `Reserve & adjustments = tripLevelCents/100 − hotelCost − flightCost`, clamped at 0; only render when > 0.
- Right-most chip is the Trip Total so the equation visibly closes.
- When `travelers > 1`, prepend a small helper line under the strip:
  `Day badges show /pp · multiply by ${travelers} for group cost`.

### 4. Remove the now-redundant "Days / Hotel / Flights" strip at lines 5707–5723

That strip currently uses `totalActivityCost * travelers` (a different code path than `daysSubtotalCents`) and can drift from the reconciliation strip. Collapse to the single itemised equation from step 3 so there is exactly **one** breakdown view and it is by construction self-consistent.

### 5. Keep, but rename, the dev-warning at lines 3540–3551

No behaviour change; rename the log tag to `[Itinerary reconcile]` for grepability.

## Out of scope

- No changes to `useTripFinancialSnapshot`, `tripDayBreakdown`, `activity_costs`, or any cost computation.
- No changes to Budget tab, payments, or PDF export.
- No currency-conversion changes; the new strip uses `displayCost` + `tripCurrency` exactly like the existing one.

## Acceptance

- On a 2+ traveler trip, the day-badge tooltip shows the `/pp → × travelers → group` bridge.
- The header strip always renders an equation whose left-hand items sum to the right-hand Trip Total (within $1 rounding).
- Hotel-only / empty-itinerary trips still render sensibly (Days $0 + Hotel + Flights = Trip Total).
- No console warning from the dev guard on a normal trip.
