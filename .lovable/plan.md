## What the data says for this Monaco trip

Trip `0c8b2a37…` (Monaco, USD, 2 travelers, `budget_include_hotel=true`, `budget_include_flight=false`, `budget_allocations={}`).

`activity_costs` rolls up to:

```
Day 0 hotel (logistics-sync)   $700
Day 1+ paid activities  5×$20  $100
Day 1+ dining   $40 + $60 + $40 = $140
Day 1+ transport (1 taxi leg)    $4
                              ──────
Trip total                     $944
```

(Earlier note in chat said $924 — I miscounted one activity row; the table sum is **$944**, hotel $700 + days $244.)

Zero rows in `trip_payments`. `budget_allocations.misc_percent = 0`, so no spending-money reserve is folded.

Through the canonical pipeline this should resolve to:
- `snapshot.tripTotalCents = 944_00`
- `snapshot.effectiveHotelCents = 700_00`
- `daysSubtotalCents = 244_00` (days > 0)
- `chipSumUsd = 244 + 700 + 0 = 944`
- `displayedTripTotalUsd = max(944, 944) = 944`
- Payments `Trip Total = 944`, bucket sum `= 700 + 140 + 100 + 4 = 944`

So **the canonical resolver already reconciles this trip to $944 across all three surfaces**. The earlier "$985 / $1,120 / $1,066" snapshot is either pre-fix or pre-edit cached state. The remaining risk is that we don't *prove* it on every render — the [PaymentsTab] divergence log only fires once per (tripId, path) and the header strip silently clamps with `max(tripTotal, chipSum)`, so future regressions stay invisible until a user complains.

## Plan

### 1. Verify the live Monaco trip matches the DB

- Run a one-off check via `useTripFinancialSnapshot` + `useTripDayBreakdown` (Node script using the canonical resolver against the DB rows already in hand) to confirm the three numbers (`displayedTotalCents`, `bucketSumCents`, `daysSubtotal + hotel + flight`) equal $944.
- If they diverge, the gap will localize to one of: (a) JSON live-activity index dropping a costed row that activity_costs still references, (b) `shouldCountRow` filtering a row that the bucket sum still picks up, or (c) `computeHeaderStripValues` clamping silently. The script's output names the path.

No source changes from this step.

### 2. Always-on attributed drift log (replace once-per-fingerprint guard)

`src/components/itinerary/PaymentsTab.tsx` currently fingerprints `(tripId, path, totals)` and logs only on first divergence. Change to: **log every time `bucketDrift > $1 OR payableDrift > $2 OR paidDrift > $2` while `snapshotReady`**, but rate-limit to one log per 5 s per tripId. Include the three constituents (`snapshot.tripTotalCents`, `bucketSumCents`, `payableTotalCents`, `daysSubtotalCents`, `hotelCents`, `flightCents`, `reserveCents`) so the gap source is named in the console — no more "user sees X, we have no log".

### 3. Promote `snapshotOverChips` / `snapshotUnderChips` from silent to visible (dev only)

`computeHeaderStripValues` already detects both directions but only sets booleans. In `EditorialItinerary` header strip, when `import.meta.env.DEV` AND either flag is true, render a small amber chip "Δ = $X (snapshotOverChips|snapshotUnderChips)" next to the equation. Production stays unchanged. This catches the Casablanca/Kyoto pattern (snapshot==daysGroup with a hotel chip visible) before a user reports it.

### 4. Single equality assertion at the persist boundary

In `useTripFinancialSnapshot` after `resolveCanonicalCostRows` returns, assert `effectiveTotalCents === <sum of per-day buckets> + (manualOther) + (reserve if folded)`. On mismatch, `console.error('[snapshot] resolver invariant broken', {…})`. Already partly present in PaymentsTab; move it one level up so every consumer (Budget tab, header, Payments) benefits without each surface re-implementing it.

### 5. Document & memory

Update `mem://constraints/finance/displayed-trip-total-single-source` with the explicit Monaco case: "Header $944 = Days $244 + Hotel $700, no Flight, no Reserve. Reproduced via DB read on 2026-05-15." This anchors the expected-state baseline for the next time someone reports a similar 3-way drift.

## Out of scope

- Touching `resolveCanonicalCostRows`, `usePayableItems`, or `useTripFinancialSnapshot` logic — they already produce the right number for this trip. The plan is purely **observability + invariant guards** unless step 1's script proves an actual logic divergence, in which case I'll come back with a targeted patch instead of these guards.
- Payments tab visual redesign.
- Budget tab business logic.

## Technical notes

- The fingerprint guard at PaymentsTab L562–L575 (`driftReportedRef`) was added to avoid console spam during snapshot stabilization. Switching to a 5 s rate-limit keeps that benefit while restoring per-render visibility into post-stabilization drift.
- `computeHeaderStripValues` line 71 (`Math.max(tripTotalUsd, chipSumUsd)`) is the silent clamp — keeping it as the runtime fallback is correct (the equation must balance), but the dev chip in step 3 makes the clamp visible so we can fix the root cause instead of living with it.
- The Monaco snapshot will need a hard refresh after step 3 ships to clear the cached resolver result before the dev chip is meaningful.
