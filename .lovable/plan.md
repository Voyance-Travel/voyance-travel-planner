## Bug

Trip header strip shows: `Days ¥113,088 + Hotel ¥167,200 = ¥113,088` — same Casablanca pattern (`Days + Hotel = Days`). The previous Casablanca fix made `manualHotelDelta = 0 when no manual row exists`, but a new leak path is producing the same symptom on the Tokyo trip.

## What we know from code audit

The strip in `EditorialItinerary.tsx` (line 6091–6154) reads three values from the same `useTripFinancialSnapshot` hook:

- `daysSubtotalCents` — sum of `tripDayBreakdown.byDay[d.dayNumber]` for days ≥1 (excludes Day-0 hotel/flight by construction)
- `effectiveHotelCents` — `data.includeHotel ? committedHotelCents + manualHotelDelta : 0`
- `tripTotalCents` — `canonical.effectiveTotalCents` from `resolveCanonicalCostRows`

For the chip to show ¥167,200 **and** Trip Total to exclude it, exactly one of these must be true:

1. Day-0 hotel row exists (cents > 0), `includeHotel=true`, but `effectiveTotalCents` somehow drops it after counting (regression in the fold math).
2. Manual hotel payment exists with `manualHotelDelta = 167200`, `includeHotel=true`, but `effectiveTotalCents += manualHotelDelta` is being skipped (regression at `canonicalCostRows.ts:412–415`).
3. `data.committedHotelCents` and `data.tripTotalCents` are being set from different snapshots (e.g., one fresh, one stale via the optimistic-update event handler at `useTripFinancialSnapshot.ts:548`).
4. `setData` field swap — `committedHotelCents: canonicalHotelCents` (line 518) writes Day-0-only into the field named "committedHotelCents", while `effectiveTotalCents` was computed against `canonical.hotelCents` (all hotel rows). On a trip where the hotel is on a real day (not Day 0), the chip would silently be 0; not a fit. But if a fresh repair migrated the hotel to Day 0 between the resolver call and the field assignment, drift could bleed through.

The previous Casablanca fix is still in place (`canonicalCostRows.ts:406–411`). No code path I can find subtracts hotel from `effectiveTotalCents` post-fold. So the leak is likely either telemetry-blind state drift (stale optimistic field, or a second writer to `data`) or a new code path I haven't traced.

## Plan

### Step 1 — Add structured telemetry at the strip render boundary

In `EditorialItinerary.tsx` (around line 6091–6117, the existing dev `[Itinerary strip] reconciliation imbalance` block), tighten the imbalance check to:

- Always log (not only `Math.abs(balance) > 1`) whenever `effectiveHotelCents > 0 && Math.abs(tripTotalCents - daysSubtotalCents - effectiveHotelCents - effectiveFlightCents) > 1`.
- Log the **full snapshot field set**: `tripTotalCents`, `daysSubtotalCents`, `effectiveHotelCents`, `effectiveFlightCents`, `committedHotelCents`, `manualHotelDelta`, `includeHotel`, `tripCurrency`, plus `tripId`.
- Use `console.warn('[STRIP_DRIFT]', {...})` so it's greppable in production logs (memory pattern matches existing `[BOOKEND_*]` / `[VALIDATION_GATE]` sentinels).

This is the single piece of telemetry that will pin down which of the four hypotheses above is the actual cause on the Tokyo trip and any future occurrence.

### Step 2 — Add a single-resolver invariant assertion

In `resolveCanonicalCostRows` (`src/services/canonicalCostRows.ts`, after the `effectiveTotalCents` computation around line 416), assert the canonical invariant in DEV:

```
effectiveTotalCents >= max(canonicalDay0HotelCents * includeHotel, canonicalDay0FlightCents * includeFlight)
```

Plus, when `manualHotelCents > 0 && includeHotel`, assert `effectiveTotalCents >= manualHotelCents` (the manual override must be visible in the trip total).

If either fails, `console.error('[CANONICAL_INVARIANT_VIOLATED]', {...})` with the full set of inputs (totalCents, manualHotelCents, canonicalDay0HotelCents, manualHotelDelta, includeHotel). This catches future regressions at the source rather than at the display boundary.

### Step 3 — Strip-level safety fold (display fix)

In `EditorialItinerary.tsx` (line 6091–6154), if `[STRIP_DRIFT]` would fire (i.e., `tripTotalCents < daysSubtotal + effectiveHotel + effectiveFlight - 1`), display the **maximum** of the two as the equation RHS:

```
const safeTripTotalUsd = Math.max(
  tripTotalUsd,
  daysGroupUsd + hotelChipUsd + flightChipUsd
);
```

Render `safeTripTotalUsd` as the `Trip Total` value and recompute `reserveAdjustUsd` against it. This ensures the user-visible equation always balances even while telemetry catches the underlying drift.

This is a guarded display-only fold — it does not write back to the snapshot or change the persisted budget. The underlying snapshot field `tripTotalCents` continues to feed downstream consumers (BudgetTab, PaymentsTab) unchanged so we don't mask drift in those views.

### Step 4 — Tests

- `src/services/__tests__/canonicalCostRows.test.ts` — add 2 cases:
  - Day-0 hotel ¥167,200 + includeHotel=true + no manual → `effectiveTotalCents` includes hotel, no invariant violation.
  - Manual hotel ¥167,200 + includeHotel=true + no Day-0 row → `effectiveTotalCents` includes manual.
- `src/components/itinerary/__tests__/EditorialItinerary.stripFold.test.tsx` (new) — verify the safe-fold renders `Days + Hotel` as RHS when snapshot returns `tripTotal < days + hotel`.

### Step 5 — Memory update

Append to `mem://constraints/finance/header-strip-mirrors-snapshot`:

> Recurrence guard: `[STRIP_DRIFT]` warn at strip render + `[CANONICAL_INVARIANT_VIOLATED]` error at resolver. Display falls back to `max(tripTotal, days + hotel + flight)` so the equation always balances even while telemetry traces the source. Tokyo ¥113,088 + ¥167,200 = ¥113,088 was the last known recurrence.

## Files

- `src/components/itinerary/EditorialItinerary.tsx` — strip telemetry + safe-fold
- `src/services/canonicalCostRows.ts` — invariant assertion
- `src/services/__tests__/canonicalCostRows.test.ts` — 2 new cases
- `src/components/itinerary/__tests__/EditorialItinerary.stripFold.test.tsx` — new
- `mem://constraints/finance/header-strip-mirrors-snapshot` — recurrence note

## Why not "find and fix the source first"

I traced the four candidate leak paths (Day-0 cost=0, manual id mismatch, stale optimistic update, field-name swap) and none reproduces the exact `Days + Hotel = Days` symptom against the current code. The drift is either runtime state I can't see from static reading, or a writer outside the snapshot (`tripDayBreakdown` divergence, an optimistic event we haven't grepped). Step 1 telemetry will identify which on the next reproduction; Steps 2–3 prevent the user-visible regression in the meantime.