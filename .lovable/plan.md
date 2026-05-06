# Reconcile Day Totals → Trip Total

## Problem

The €2,035 gap comes from three independent sources of truth that report different things:

| Surface | Source | Includes |
|---|---|---|
| **Trip total badge** (header) | `useTripFinancialSnapshot` → `activity_costs` table | Activity rows + day-0 hotel/flight + misc reserve + manual-payment overrides + orphan filter |
| **Per-day badge** (Day card) | `getDayTotalCost` → `itinerary_data.days[].activities` JSON, per-person | Confirmed-cost activities only; **excludes** estimates, hotel, flight, misc reserve, transit micro-rows that aren't on cards, day-0 logistics |
| **Budget tab** | `useTripDayBreakdown` → `activity_costs` table | Everything in snapshot, grouped by `day_number` |

So summing the visible day badges and comparing to the trip total is guaranteed to drift by:

1. **Hotel + flight + misc reserve** — booked at `day_number = 0`, attributed to no day card.
2. **Estimated-cost activities** — excluded from day badge, included in trip total whenever `activity_costs` has a row.
3. **Per-person vs group cost** — day badge renders the per-person figure (`/pp` suffix), trip total is group cost.
4. **Orphan filter mismatch** — snapshot drops `activity_costs` rows whose `activity_id` is missing from live JSON; day badge sums whatever is in JSON, including activities that may not have a cost row yet.
5. **Manual payment override delta** — applied only in snapshot, never visible per-day.

Users see "the math doesn't add up" because nothing in the UI exposes items 1, 4, or 5.

## Fix — single canonical day source + a visible "Trip-level" line

Make day badges read from the same table the trip total reads from, then surface the unallocated bucket as its own line so the arithmetic always closes.

### 1. Day card badge: switch to `useTripDayBreakdown`

In `src/components/itinerary/EditorialItinerary.tsx`:

- Lift one `useTripDayBreakdown(tripId, visibleActivityIds)` call into `EditorialItinerary` (alongside the existing `useTripFinancialSnapshot`) and pass `byDay[dayNumber]` into each `DayCard` via props.
- Inside `DayCard`, when `byDay[day.dayNumber]` is present, prefer `breakdown.totalCents / 100` over `getDayTotalCost(...)` for the badge. Fall back to the JS calc only while the hook is loading or for clean previews.
- Group cost is already in `totalUsdCents` — drop the misleading `/pp` suffix when we use the snapshot value (or divide by `travelers` when `travelers > 1` if we want to keep the per-person UI; either way the sum-of-days will match the snapshot).
- Replace the existing tooltip rows (Activities / Airport / Local transit) with `breakdown.visibleCents` + `breakdown.otherCents`, where `otherCents` is rendered as "Transit & fees" with the existing `breakdown.otherRows` available for an optional expansion.

### 2. New "Trip-level costs" row in the trip total breakdown

In the same file, build a `tripLevelCents` value from the snapshot:

```text
tripLevelCents = tripTotalCents − Σ byDay[d].totalCents     (for d ≥ 1)
```

This bucket is exactly Day-0 logistics (hotel, flight, transfers tagged `day_number = 0`), the unspent misc reserve, and the manual-payment override delta. Render it as a single line below the day list inside `TripTotalDeltaIndicator` / wherever the header total is expanded:

```text
Day 1   $410
Day 2   $295
…
Day 7   $380
─────────────
Days subtotal   $2,140
Hotel, flight & reserve   $2,035
─────────────
Trip total   $4,175   ✓
```

If the toggles `budget_include_hotel` / `budget_include_flight` are off, the row label collapses to "Reserve & adjustments".

### 3. Reconciliation guard (dev assertion)

Add a `useEffect` in `EditorialItinerary` that compares
`Σ byDay[d].totalCents (d ≥ 1) + day0Cents` against `tripTotalCents`.
If they disagree by more than 1 cent, `console.warn` with both totals and the per-day vector. This catches future regressions silently introduced by the snapshot or repair pipeline.

### 4. No backend changes

`activity_costs` already carries `day_number`, the snapshot already tracks `canonicalHotelCents` / `canonicalFlightCents` / misc reserve. The fix is entirely in the React layer plus passing one prop into `DayCard`. No migration, no edge function changes.

## Files

- `src/components/itinerary/EditorialItinerary.tsx` — lift `useTripDayBreakdown`, replace `getDayTotalCost` consumer in `DayCard`, add the trip-level row + reconciliation guard.
- `src/hooks/useTripDayBreakdown.ts` — expose `dayNumber` on `DayBreakdownRow` (currently attached as `any`); minor typing tidy.
- (Optional) `src/components/itinerary/TripTotalDeltaIndicator.tsx` — render the "Hotel, flight & reserve" line if it's the right host; otherwise inline near the existing total badge.

## Out of scope

- Reworking `getDayTotalCost` callers outside of `DayCard` (e.g. exports, share view) — they continue using the JSON-derived calc until a follow-up unifies them.
- Changing how hotel/flight rows are persisted (still `day_number = 0`).
