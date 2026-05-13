## Bug

Osaka trip header shows: `Days ¥105,488 + Hotel ¥206,720 = Trip Total ¥105,488` — same `Days + Hotel = Days` symptom Casablanca/Tokyo had, but a **different root cause** the previous safe-fold can't catch.

## Real root cause (this trip is different)

The Osaka hotel row sits on **Day N (≥1)**, not Day 0, and there is **no manual hotel payment**. Walk through the data:

1. `useTripDayBreakdown` (line 120–138) folds **every** hotel row into `byDay[N].totalCents` whenever `includeHotel=true` (`shouldCountRow` allows hotels through; it doesn't care about `day_number`).
2. `daysSubtotalCents` (EditorialItinerary.tsx:3785) sums `byDay[N]` for every visible day → already includes the Day-N hotel = ¥105,488.
3. In the snapshot, `committedHotelCents = canonical.hotelCents` (`useTripFinancialSnapshot.ts:268`) which is the sum of **all** hotel rows (Day 0 + Day N) = ¥206,720.
4. Strip chip = `effectiveHotelCents = includeHotel ? committedHotelCents + manualHotelDelta : 0` = ¥206,720 + 0.
5. `tripTotalCents = canonical.effectiveTotalCents` correctly counts the Day-N hotel exactly **once** = ¥105,488 (= daysSubtotal).

Result: hotel is counted once inside Trip Total (correct), but the strip displays it a second time as a separate Hotel chip (wrong). The user sees Days + Hotel ≠ Trip Total.

The previous safe-fold (`safeTripTotalUsd = chipSumUsd` when drift detected) doesn't help here — applying it would push Trip Total to ¥312,208, **double-counting** the hotel that is already inside the day badges. The fold is the wrong remedy when the leak is on the chip side, not the total side.

## Fix

The Hotel/Flight chips were originally designed to surface **logistics-day costs** (Day 0 hotel, Day 0 flight) and **manual overrides** that don't belong to a specific itinerary day. They must NOT include Day-N hotel rows that already live inside their day's badge.

### Step 1 — Restrict `committedHotelCents` / `committedFlightCents` to Day 0

In `src/hooks/useTripFinancialSnapshot.ts` (lines 268–272), replace:

```ts
committedHotelCents  = canonical.hotelCents;          // ALL hotel rows
committedFlightCents = canonical.flightCents;         // ALL flight rows
```

with:

```ts
committedHotelCents  = canonical.canonicalDay0HotelCents;
committedFlightCents = canonical.canonicalDay0FlightCents;
```

Day-N hotel/flight rows continue to count in `totalCents` (canonical resolver already does this) and in `daysSubtotalCents` (via `byDay[N]`). They simply no longer appear as a duplicate top-level chip.

Cases after fix:
- **Day-0 hotel only** (logistics): chip = ¥X, days excludes Day 0, total = days + ¥X. Equation balances.
- **Day-N hotel, no manual** (Osaka pattern): chip = 0 → suppressed. Hotel cost shows only inside its day badge. Total = days. Equation balances.
- **Manual hotel override**: `manualHotelDelta = manual − canonicalDay0`, chip = manual, total = baseDays + manual. Equation balances. Already works.
- **Day-0 hotel + manual override**: same as above, manual replaces canonical. Equation balances.

### Step 2 — Tighten the previous safe-fold gate

The Casablanca/Tokyo safe-fold in `EditorialItinerary.tsx` (lines 6100–6111) is now over-broad: in the Osaka pattern it would have inflated Trip Total. Add a guard so the fold only fires when the chip values are NOT already inside `daysSubtotal`:

Replace the drift detection with an asymmetric check that requires the snapshot total to be lower than what `committedHotelCents/Flight` (now Day-0 only) plus daysSubtotal would imply. With Step 1 in place, the original Casablanca/Tokyo cases (Day-0 hotel missing from total, or manual delta dropped) still trigger; the Osaka case (Day-N hotel inside days) does not.

Concretely: keep the existing `tripTotalUsd + 1 < chipSumUsd` test but only apply when `effectiveHotelCents > 0 || effectiveFlightCents > 0` — which after Step 1 means a Day-0 or manual hotel/flight only, not Day-N. Drop the safe-fold entirely if Step 1 makes the original regressions unreachable, but keep the `[STRIP_DRIFT]` warn telemetry as a tripwire.

### Step 3 — Tests

- `src/hooks/__tests__/useTripFinancialSnapshot.dayNHotel.test.ts` (new) — given a fixture trip with one hotel row at `day_number=2`, no Day-0 hotel, no manual payment, `includeHotel=true`:
  - `committedHotelCents === 0`
  - `effectiveHotelCents === 0`
  - `tripTotalCents` includes the hotel (verified against `daysSubtotal` parity)
- `src/hooks/__tests__/useTripFinancialSnapshot.day0Hotel.test.ts` (new) — Day-0 hotel row:
  - `committedHotelCents === <day-0 amount>`
  - `effectiveHotelCents === <day-0 amount>`
  - Equation `daysSubtotal + effectiveHotelCents === tripTotalCents`
- `src/components/itinerary/__tests__/EditorialItinerary.stripFold.test.tsx` — add a Day-N hotel case asserting the safe-fold does NOT fire and Trip Total is rendered as `tripTotalCents` (not `chipSumUsd`).

### Step 4 — Memory update

Append to `mem://constraints/finance/header-strip-mirrors-snapshot`:

> Recurrence guard (Osaka): Hotel/Flight chips show **Day-0 + manual only**, never Day-N rows (those are already inside the per-day badges via `useTripDayBreakdown`). Setting `committedHotelCents = canonical.hotelCents` (the sum of all rows) re-displays Day-N hotel as a duplicate chip and breaks the strip equation in the opposite direction (`Days + Hotel = Days`, where Days already includes Hotel). Bind `committedHotelCents = canonicalDay0HotelCents` in `useTripFinancialSnapshot`.

## Files

- `src/hooks/useTripFinancialSnapshot.ts` — change lines 268–269 to expose Day-0 only
- `src/components/itinerary/EditorialItinerary.tsx` — narrow the safe-fold gate (Step 2)
- `src/hooks/__tests__/useTripFinancialSnapshot.dayNHotel.test.ts` (new)
- `src/hooks/__tests__/useTripFinancialSnapshot.day0Hotel.test.ts` (new)
- `src/components/itinerary/__tests__/EditorialItinerary.stripFold.test.tsx` — add Day-N case
- `mem://constraints/finance/header-strip-mirrors-snapshot` — recurrence note
